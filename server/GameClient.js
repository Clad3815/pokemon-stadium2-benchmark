const net = require('net');
const fs = require('fs');
const path = require('path');

class GameClient {
  /**
   * Client for communicating with the Pokemon Stadium server.
   * This client uses a unique ID system for each command sent
   * to ensure precise matching between commands and responses.
   * Each command generates a unique ID that is included in the request and returned in the response.
   * This allows correct handling of multiple commands sent in quick succession.
   */
  constructor(host = '127.0.0.1', port = 1766, options = {}) {
    this.host = host;
    this.port = port;
    this.client = new net.Socket();
    this.responseCallbacks = new Map();
    this.responseBuffer = '';
    this.commandIdCounter = 0;

    // Load Pokemon data
    this.pokemonDataFilePath = options.pokemonDataPath || './data/pokemon_data_en.json';
    this.pokemonData = this.loadPokemonData(this.pokemonDataFilePath);

    // Command queue
    this.commandQueue = [];
    // Indicates whether a command is currently being processed
    this.isProcessingCommand = false;

    // Reconnection options
    this.reconnectOptions = {
      enabled: options.reconnect !== false,
      maxAttempts: options.maxReconnectAttempts || 9999,
      delay: options.reconnectDelay || 3000,
      currentAttempt: 0,
      isReconnecting: false
    };

    // Connection state
    this.connected = false;
    this.reconnectTimer = null;

    this.setupEventListeners();
    this.connect();
  }

  /**
   * Loads Pokemon data from the JSON file
   * @param {string} filePath - Path to the JSON file
   * @returns {Object} - Loaded Pokemon data or empty object on error
   */
  loadPokemonData(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      console.log(`Pokemon data loaded from: ${filePath}`);
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading Pokemon data: ${error.message}`);
      return { pokemon: {}, moves: {} };
    }
  }

  /**
   * Reloads Pokemon data from the JSON file
   * @param {string} filePath - Path to the JSON file (optional, uses existing path if not provided)
   * @returns {boolean} - true if loading succeeded, false otherwise
   */
  reloadPokemonData(filePath = null) {
    try {
      const pathToUse = filePath || this.pokemonDataFilePath || './pokemon_data.json';
      this.pokemonData = this.loadPokemonData(pathToUse);
      this.pokemonDataFilePath = pathToUse;
      return true;
    } catch (error) {
      console.error(`Error reloading Pokemon data: ${error.message}`);
      return false;
    }
  }

  /**
   * Enriches team data with information from the JSON file
   * @param {Object} teamsData - Raw team data received from the server
   * @returns {Object} - Enriched data
   */
  enrichTeamsData(teamsData) {
    if (!teamsData) return teamsData;
    
    // Function to enrich a single Pokemon
    const enrichPokemon = (pokemon) => {
      if (!pokemon || !pokemon.id) return pokemon;
      
      const enrichedPokemon = { ...pokemon };
      
      // Add Pokemon data
      if (this.pokemonData.pokemon && this.pokemonData.pokemon[pokemon.id]) {
        const pokemonInfo = this.pokemonData.pokemon[pokemon.id];
        enrichedPokemon.name = pokemonInfo.name || `Unknown (ID: ${pokemon.id})`;
        enrichedPokemon.types = pokemonInfo.type || [];
      } else {
        enrichedPokemon.name = `Unknown (ID: ${pokemon.id})`;
        enrichedPokemon.types = [];
      }
      
      // Enrich moves
      if (pokemon.moves && Array.isArray(pokemon.moves)) {
        enrichedPokemon.moves = pokemon.moves.map(move => {
          const enrichedMove = { ...move };
          
          if (this.pokemonData.moves && this.pokemonData.moves[move.id]) {
            const moveInfo = this.pokemonData.moves[move.id];
            enrichedMove.name = moveInfo.name || `Unknown (ID: ${move.id})`;
            enrichedMove.description = moveInfo.description || "No description available.";
            enrichedMove.maxPP = moveInfo.pp || 0;
            enrichedMove.power = moveInfo.power || 0;
            enrichedMove.accuracy = moveInfo.accuracy || 0;
            enrichedMove.type = moveInfo.type || "Unknown";
            enrichedMove.category = moveInfo.category || "Unknown";
            enrichedMove.effect = moveInfo.effect || "No effect available.";
          } else {
            enrichedMove.name = `Unknown (ID: ${move.id})`;
            enrichedMove.description = "No description available.";
            enrichedMove.maxPP = 0;
            enrichedMove.power = 0;
            enrichedMove.accuracy = 0;
            enrichedMove.type = "Unknown";
            enrichedMove.category = "Unknown";
            enrichedMove.effect = "No effect available.";
          }
          
          return enrichedMove;
        });
      }
      
      return enrichedPokemon;
    };
    
    // Copy the original object to avoid modifying it directly
    const enrichedData = { ...teamsData };
    
    // Enrich each team
    if (enrichedData.playerTeam && Array.isArray(enrichedData.playerTeam)) {
      enrichedData.playerTeam = enrichedData.playerTeam.map(enrichPokemon);
    }
    
    if (enrichedData.opponentTeam && Array.isArray(enrichedData.opponentTeam)) {
      enrichedData.opponentTeam = enrichedData.opponentTeam.map(enrichPokemon);
    }
    
    if (enrichedData.initialPlayerTeam && Array.isArray(enrichedData.initialPlayerTeam)) {
      enrichedData.initialPlayerTeam = enrichedData.initialPlayerTeam.map(enrichPokemon);
    }
    
    if (enrichedData.initialOpponentTeam && Array.isArray(enrichedData.initialOpponentTeam)) {
      enrichedData.initialOpponentTeam = enrichedData.initialOpponentTeam.map(enrichPokemon);
    }
    
    return enrichedData;
  }

  setupEventListeners() {
    this.client.on('data', (data) => {
      this.responseBuffer += data.toString();

      // Try to process complete JSON responses
      this.processResponse();
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.reconnectOptions.currentAttempt = 0;
      console.log(`Connected to server ${this.host}:${this.port}`);
    });

    this.client.on('close', (hadError) => {
      this.connected = false;
      console.log("Connection closed" + (hadError ? " due to an error" : ""));

      if (this.reconnectOptions.enabled && !this.reconnectOptions.isReconnecting) {
        this.attemptReconnect();
      }
    });

    this.client.on('error', (err) => {
      console.error("Connection error:", err);
      // Reconnection will be handled by the 'close' event
    });
  }

  connect() {
    try {
      this.client.connect(this.port, this.host, () => {
        // Connection is handled by the 'connect' event

        // If we have pending commands, resume processing
        if (this.commandQueue.length > 0 && !this.isProcessingCommand) {
          this.processCommandQueue();
        }
      });
    } catch (err) {
      console.error("Error during connection attempt:", err);
      if (this.reconnectOptions.enabled) {
        this.attemptReconnect();
      }
    }
  }

  attemptReconnect() {
    if (this.connected) return;

    this.reconnectOptions.isReconnecting = true;
    this.reconnectOptions.currentAttempt++;

    if (this.reconnectOptions.currentAttempt <= this.reconnectOptions.maxAttempts) {
      console.log(`Reconnection attempt ${this.reconnectOptions.currentAttempt}/${this.reconnectOptions.maxAttempts} in ${this.reconnectOptions.delay}ms...`);

      // Clear any previous timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      // Schedule a reconnection attempt
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect to server ${this.host}:${this.port}...`);

        // Create a new socket if the old one is destroyed or in error
        if (this.client.destroyed) {
          this.client = new net.Socket();
          this.setupEventListeners();
        }

        try {
          this.connect();
        } catch (err) {
          console.error("Reconnection attempt failed:", err);
          // The next attempt will be handled by the 'close' event
        }

        this.reconnectOptions.isReconnecting = false;
      }, this.reconnectOptions.delay);
    } else {
      console.error(`Reconnection failed after ${this.reconnectOptions.maxAttempts} attempts.`);
      this.reconnectOptions.isReconnecting = false;
    }
  }

  // Process any complete responses in the buffer
  processResponse() {
    try {
      let currentIndex = 0;
      let scanningBuffer = this.responseBuffer;

      // Process each complete JSON object found in the buffer
      while (currentIndex < scanningBuffer.length) {
        // Find the start of the JSON object
        let startIndex = scanningBuffer.indexOf('{', currentIndex);
        if (startIndex === -1) break; // No JSON found

        // Find the matching end for this JSON object by counting nested braces
        let endIndex = -1;
        let openBraces = 0;

        for (let i = startIndex; i < scanningBuffer.length; i++) {
          if (scanningBuffer[i] === '{') openBraces++;
          else if (scanningBuffer[i] === '}') openBraces--;

          if (openBraces === 0) {
            endIndex = i;
            break;
          }
        }

        if (endIndex === -1) {
          // Incomplete JSON, wait for more data
          // If JSON is in progress (we found a start but no end),
          // keep the remaining part in the buffer
          if (startIndex > 0) {
            this.responseBuffer = this.responseBuffer.substring(startIndex);
          }
          return; // Exit and wait for more data
        }

        // Extract and parse the complete JSON
        let jsonStr = scanningBuffer.substring(startIndex, endIndex + 1);

        try {
          let data = JSON.parse(jsonStr);

          // Process the response
          this.handleResponse(data);

          // Advance the index to search for the next JSON
          currentIndex = endIndex + 1;
        } catch (e) {
          console.log("Error parsing JSON:", e.message);
          console.log("Problematic JSON:", jsonStr);
          // Invalid JSON, move to next character
          currentIndex = startIndex + 1;
        }
      }

      // Remove processed data from the buffer
      if (currentIndex > 0) {
        this.responseBuffer = this.responseBuffer.substring(currentIndex);
      }
    } catch (err) {
      console.error("Error processing responses:", err);
    }
  }

  // Method to process responses individually
  handleResponse(data) {
    try {
      // Check if the response contains a command ID
      if (data.command_id && this.responseCallbacks.has(data.command_id)) {
        const callback = this.responseCallbacks.get(data.command_id);
        callback(data);
        this.responseCallbacks.delete(data.command_id);
        return;
      }

      // Check if it's a generic error
      if (data.cmd_exec_error) {
        console.error("Command error:", data.message);

        // If we don't have a specific ID but have an error, notify all pending callbacks
        if (this.responseCallbacks.size > 0) {
          console.warn("Error without specific ID, notifying all pending callbacks");
          for (let [command, callback] of this.responseCallbacks.entries()) {
            callback(data);
            this.responseCallbacks.delete(command);
            break; // Only notify the first one to avoid cascading notifications
          }
        }
        return;
      }

      // If we reach here, we didn't find a match by ID
      // but we still received a response, so we try to associate it
      // with a pending command based on its content

      console.log("Response without matching ID, attempting content-based matching");

      // Legacy method for compatibility
      // Execute pending callbacks
      for (let [command, callback] of this.responseCallbacks.entries()) {
        // Check if this is the expected response
        if (command === 'teams' && data.playerTeam && data.opponentTeam) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'teams' response matched by content");
          return;
        }

        if (command === 'current_window' && data.window !== undefined) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'current_window' response matched by content");
          return;
        }

        if (command === 'screenshot' && data.image_full_path) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'screenshot' response matched by content");
          return;
        }

        if (command === 'end_text_collect' && data.textData) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'end_text_collect' response matched by content");
          return;
        }

        if (command === 'set_nickname' && data.success !== undefined) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'set_nickname' response matched by content");
          return;
        }

        if (command === 'get_all_text' && data.textData) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'get_all_text' response matched by content");
          return;
        }

        if (command === 'clean_text' && data.success) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'clean_text' response matched by content");
          return;
        }

        if (command === 'change_title' && data.success) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'change_title' response matched by content");
          return;
        }

        if (command === 'change_fight_description' && data.success) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'change_fight_description' response matched by content");
          return;
        }

        if (command === 'check_can_attack' && data.p1_can_attack !== undefined) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'check_can_attack' response matched by content");
          return;
        }

        if (command === 'check_need_change' && data.p1_need_change !== undefined) {
          callback(data);
          this.responseCallbacks.delete(command);
          console.log("'check_need_change' response matched by content");
          return;
        }
      }

      // If we reach here, no match was found
      console.log("Unmatched response:", data);

    } catch (error) {
      console.error("Error processing response:", error);
    }
  }

  // Generates the list of commands to select Pokemon
  selectEntriesPokemon(pokemonIds, playerNum = 1) {
    const commands = [];
    const numColumns = 4;
    // Enter Pokemon selection
    commands.push("wait", "right", "right", "a", "wait", "wait");
    if (playerNum === 1) {
      commands.push("c_right");
    }

    // Unavailable pokémons
    // Some pokemons are not available in the list
    // Mew, Mewtwo, Ho-Oh, Lugia, Celebi
    // const unavailablePokemons = [150, 151, 249, 250, 251];

    // New list of unavailable pokemons
    // Caterpie, Metapod, Weedle, Kakuna, and Magikarp
    const unavailablePokemons = [10, 11, 13, 14, 129];
    // Function to adjust Pokemon index considering unavailable Pokemon
    const adjustPokemonIndex = (pokemonId) => {
      // Count how many unavailable Pokemon have an ID lower than the requested one
      const unavailableBefore = unavailablePokemons.filter(id => id < pokemonId).length;
      // Return adjusted index (pokemonId - number of unavailable Pokemon before it)
      return pokemonId - unavailableBefore;
    };

    // Sort IDs in ascending order
    pokemonIds.sort((a, b) => a - b);

    // Function to get coordinates (row, col) from a 1-indexed position
    const getCoordinates = (pos) => ({
      row: Math.floor((pos - 1) / numColumns),
      col: (pos - 1) % numColumns
    });

    let currentPos = 1;
    let currentCoord = getCoordinates(currentPos);

    for (const targetId of pokemonIds) {
      // Adjust index to account for unavailable Pokemon
      const adjustedTarget = adjustPokemonIndex(targetId);
      const targetCoord = getCoordinates(adjustedTarget);
      const diffRow = targetCoord.row - currentCoord.row;
      const diffCol = targetCoord.col - currentCoord.col;

      // Choose movement order based on starting column
      if (currentCoord.col === 0) {
        if (diffCol > 0) {
          for (let i = 0; i < diffCol; i++) commands.push("right");
        } else if (diffCol < 0) {
          for (let i = 0; i < Math.abs(diffCol); i++) commands.push("left");
        }
        if (diffRow > 0) {
          for (let i = 0; i < diffRow; i++) commands.push("down");
        } else if (diffRow < 0) {
          for (let i = 0; i < Math.abs(diffRow); i++) commands.push("up");
        }
      } else {
        if (diffRow > 0) {
          for (let i = 0; i < diffRow; i++) commands.push("down");
        } else if (diffRow < 0) {
          for (let i = 0; i < Math.abs(diffRow); i++) commands.push("up");
        }
        if (diffCol > 0) {
          for (let i = 0; i < diffCol; i++) commands.push("right");
        } else if (diffCol < 0) {
          for (let i = 0; i < Math.abs(diffCol); i++) commands.push("left");
        }
      }

      // Confirm Pokemon selection (double press "a")
      // Only do this for targets at position "4" (4/8/12/16/...)
      if (adjustedTarget % numColumns === 0) {
        commands.push("down", "up");
      }
      commands.push("a", "a");

      // Update cursor position
      currentPos = adjustedTarget + 1;
      currentCoord = getCoordinates(currentPos);
      //   console.log("New position:", currentPos, currentCoord);
    }

    // Final confirmation for the 6 Pokemon selection
    commands.push("a", "a");
    return commands;
  }

  // Returns the commands to select an attack
  selectAttack(attackIndex) {
    const attackCommands = {
      1: "c_up",
      2: "c_right",
      3: "c_down",
      4: "c_left",
    };
    return ["a", "r", attackCommands[attackIndex]];
  }


  changePokemon(pokemonIndex) {
    let changeCommands;
    if (global.battleType === '3vs3') {
      changeCommands = {
        1: "c_left",
        2: "c_up",
        3: "c_right"
      };
    } else {
      changeCommands = {
        1: "b",
        2: "c_left",
        3: "c_up",
        4: "a",
        5: "c_down",
        6: "c_right"
      };
    }
    return ["b", "r", changeCommands[pokemonIndex]];
  }

  // Returns the commands to select 3 Pokemon out of 6
  select3Pokemons(pokemonIndexes) {
    const commandsList = {
      1: "B",
      2: "c_left",
      3: "c_up",
      4: "A",
      5: "c_down",
      6: "c_right"
    };

    const commands = pokemonIndexes.map(index => commandsList[index]);
    commands.push("wait", "a");
    return commands;
  }

  // Sends commands one by one with a delay between each
  async sendCommandsSequentially(commands, playerNumber = 1, delay = 1000) {
    const results = [];

    try {
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        // console.log(`Sending command ${i+1}/${commands.length}: ${command} (Player ${playerNumber})`);

        try {
          const response = await this.sendCommand('send_input', `${playerNumber} ${command}`);
          results.push({ command, response, success: true });
        } catch (error) {
          console.error(`Error sending command ${command}:`, error);
          results.push({ command, error: error.message, success: false });
        }

        // Wait the specified delay before the next command
        if (i < commands.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error("Global error during sequential command sending:", error);
      throw error;
    }

    return results;
  }

  // Utility method to send a command with an ID and set up the callback
  sendCommand(command, args = '', timeout = 30000) {
    return new Promise((resolve, reject) => {
      // Generate a unique ID for this command
      const commandId = this.generateCommandId();

      // Create the command object to be queued
      const commandObj = {
        command,
        args,
        commandId,
        timeout,
        resolveCallback: resolve,
        rejectCallback: reject,
        timestamp: Date.now()
      };

      // Add the command to the queue
      this.commandQueue.push(commandObj);

      // If not connected and reconnection is enabled, attempt to reconnect
      if (!this.connected && this.reconnectOptions.enabled && !this.reconnectOptions.isReconnecting) {
        console.log("Attempting reconnection before sending command...");
        this.attemptReconnect();
        return;
      }

      // Process the queue if no command is currently being processed
      if (!this.isProcessingCommand) {
        this.processCommandQueue();
      }
    });
  }

  // Processes queued commands one by one
  async processCommandQueue() {
    // If already processing the queue or if the queue is empty
    if (this.isProcessingCommand || this.commandQueue.length === 0) {
      return;
    }

    // If not connected, wait for reconnection
    if (!this.connected) {
      console.log("Not connected, putting command processing on hold...");
      return;
    }

    // Mark as currently processing
    this.isProcessingCommand = true;

    try {
      // Take the first command from the queue
      const cmdObj = this.commandQueue.shift();
      const cmdId = cmdObj.commandId;

      // Check if the command has expired (in case of long wait due to connection issues)
      const currentTime = Date.now();
      if (cmdObj.timestamp + cmdObj.timeout < currentTime) {
        console.error(`Command "${cmdObj.command}" expired before being sent`);
        cmdObj.rejectCallback(new Error(`Command expired after ${currentTime - cmdObj.timestamp}ms of waiting`));

        // Continue with the next command
        this.isProcessingCommand = false;
        this.processCommandQueue();
        return;
      }

      // Create a timeout timer
      const timeoutId = setTimeout(() => {
        console.error(`Timeout for command "${cmdObj.command}" (ID: ${cmdId})`);
        this.responseCallbacks.delete(cmdId);
        cmdObj.rejectCallback(new Error(`Timeout for command "${cmdObj.command}" after ${cmdObj.timeout}ms`));

        // Continue processing the queue even on timeout
        this.isProcessingCommand = false;
        this.processCommandQueue();
      }, cmdObj.timeout);

      // Set up the response callback
      const callbackWithTimeout = (data) => {
        clearTimeout(timeoutId);
        cmdObj.resolveCallback(data);

        // Once the command is processed, release the flag and move to the next one
        this.isProcessingCommand = false;
        this.processCommandQueue();
      };

      // Register the callback with the command ID
      this.responseCallbacks.set(cmdId, callbackWithTimeout);

      // Build and send the command with the ID
      const fullCommand = `${cmdObj.command} ${cmdObj.args} ${cmdId}\n`;
      // console.log(`Sending command: ${fullCommand.trim()}`);
      this.client.write(fullCommand);

    } catch (error) {
      console.error(`Error processing command queue:`, error);

      // On error, release the flag to allow new attempts
      this.isProcessingCommand = false;

      // If we lost connection, don't continue immediately
      if (this.connected) {
        this.processCommandQueue();
      }
    }
  }

  setNickname(playerNumber, nickname) {
    return this.sendCommand('set_nickname', `${playerNumber} ${nickname}`);
  }

  teams() {
    return this.sendCommand('teams')
      .then(teamsData => this.enrichTeamsData(teamsData));
  }

  currentWindow() {
    return this.sendCommand('current_window');
  }

  screenshot() {
    return this.sendCommand('screenshot');
  }

  startTextCollection() {
    return this.sendCommand('start_text_collect');
  }

  endTextCollection() {
    return this.sendCommand('end_text_collect');
  }

  getAllText() {
    return this.sendCommand('get_all_text');
  }

  cleanText() {
    return this.sendCommand('clean_text');
  }

  changeTitle(title) {
    return this.sendCommand('change_title', `${title.substring(0, 20)}`);
  }

  changeFightDescription(description) {
    return this.sendCommand('change_fight_description', `${description.substring(0, 56)}`);
  }

  checkCanAttack() {
    return this.sendCommand('check_can_attack');
  }

  checkNeedChange() {
    return this.sendCommand('check_need_change');
  }

  checkBadMoves() {
    return this.sendCommand('check_bad_move');
  }

  // Method to close the connection
  disconnect() {
    // Disable automatic reconnection
    this.reconnectOptions.enabled = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Cleanly close the connection
    if (!this.client.destroyed) {
      this.client.destroy();
    }
  }



  // Reset reconnection attempts
  resetReconnection(enable = true) {
    this.reconnectOptions.currentAttempt = 0;
    this.reconnectOptions.isReconnecting = false;
    this.reconnectOptions.enabled = enable;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Utility method to generate a unique command ID
  generateCommandId() {
    return `cmd_${Date.now()}_${this.commandIdCounter++}`;
  }
}

module.exports = GameClient;
