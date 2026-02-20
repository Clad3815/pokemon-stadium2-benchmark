/************************************************
 * FICHIER: statsTracker.js
 ************************************************/

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Statistics tracking system for battles.
 * Only stores raw battle data to be processed by a dashboard.
 */
const statsTracker = {
  battles: [],

  /**
   * Initialize a new battle entry
   * @param {string} player1Model - Name of Player 1's model
   * @param {string} player2Model - Name of Player 2's model
   * @returns {number} Battle ID
   */
  initBattle: function (player1Model, player2Model, battleType, battleFormat, modelMetadata = {}) {
    const battleId = this.battles.length + 1;
    const timestamp = new Date().toISOString();

    const player1ReasoningEffort = modelMetadata.player1ReasoningEffort || null;
    const player2ReasoningEffort = modelMetadata.player2ReasoningEffort || null;
    const player1ModelDisplayName = modelMetadata.player1ModelDisplayName || player1Model;
    const player2ModelDisplayName = modelMetadata.player2ModelDisplayName || player2Model;
    const player1ModelStatKey = modelMetadata.player1ModelStatKey || `${player1Model}::${player1ReasoningEffort || 'default'}`;
    const player2ModelStatKey = modelMetadata.player2ModelStatKey || `${player2Model}::${player2ReasoningEffort || 'default'}`;

    this.battles.push({
      id: battleId,
      battleType: battleType,
      battleFormat: battleFormat,
      timestamp: timestamp,
      player1: {
        model: player1Model,
        reasoningEffort: player1ReasoningEffort,
        modelDisplayName: player1ModelDisplayName,
        modelStatKey: player1ModelStatKey,
        initialTeam: [], // Will store the 6 initially generated Pokémon
        finalTeam: [], // Will store the 3 Pokémon chosen for battle
        decisions: [], // Will store all battle decisions
        bannedPokemon: [], // Will store banned Pokémon chosen by this player
        teamStateByTurn: [], // Will store team state at each turn
      },
      player2: {
        model: player2Model,
        reasoningEffort: player2ReasoningEffort,
        modelDisplayName: player2ModelDisplayName,
        modelStatKey: player2ModelStatKey,
        initialTeam: [],
        finalTeam: [],
        decisions: [],
        bannedPokemon: [], // Will store banned Pokémon chosen by this player
        teamStateByTurn: [], // Will store team state at each turn
      },
      winner: null, // Will be 1 or 2
      turns: 0,
      duration: 0, // In seconds
      battleLog: [], // Key events during battle
    });

    logger.info(
      `Stats: Initialized battle #${battleId} tracking (${player1ModelDisplayName} vs ${player2ModelDisplayName})`
    );
    return battleId;
  },

  /**
   * Record Pokémon chosen by an AI model
   * @param {number} battleId - ID of the current battle
   * @param {number} playerNumber - Player number (1 or 2)
   * @param {Array} pokemonList - List of Pokémon objects with IDs and names
   * @param {boolean} isFinalTeam - Whether this is the final 3-Pokémon team
   */
  recordTeamSelection: function (
    battleId,
    playerNumber,
    pokemonList,
    isFinalTeam = false
  ) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    const playerKey = `player${playerNumber}`;
    const teamKey = isFinalTeam ? 'finalTeam' : 'initialTeam';

    // Store the team selection
    battle[playerKey][teamKey] = pokemonList.map(pokemon => ({
      id: pokemon.id,
      name: pokemon.name,
      currentHP: pokemon.currentHP,
      maxHP: pokemon.maxHP,
      status: pokemon.status,
      level: pokemon.level,
      types: pokemon.types,
      moves: pokemon.moves ? pokemon.moves.map(move => ({
        id: move.id,
        name: move.name,
        currentPP: move.currentPP,
        maxPP: move.maxPP
      })) : []
    }));
  },

  /**
   * Record a battle decision
   * @param {number} battleId - ID of the current battle
   * @param {number} playerNumber - Player number (1 or 2)
   * @param {object} decision - Decision object with type, value, etc.
   * @param {number} turn - Turn number
   */
  recordDecision: function (battleId, playerNumber, decision, turn) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    const playerKey = `player${playerNumber}`;

    battle[playerKey].decisions.push({
      turn,
      type: decision.type,
      value: decision.value,
      analysis: decision.analysis,
      strategy: decision.battle_strategy,
      humanReadable: decision.humanReadable || null,
      moveData: decision.moveData || null,
      pokemonData: decision.pokemonData || null,
      oldPokemonData: decision.oldPokemonData || null,
      chat_message: decision.chat_message || null
    });

    // Update turn count if necessary
    battle.turns = Math.max(battle.turns, turn);
  },

  /**
   * Record an event in the battle log
   * @param {number} battleId - ID of the current battle
   * @param {string} event - Description of the event
   * @param {number} playerNumber - Player number (1 or 2), or null if neutral
   */
  logEvent: function (battleId, event, playerNumber = null) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    battle.battleLog.push({
      timestamp: new Date().toISOString(),
      player: playerNumber,
      event,
    });
  },

  /**
   * End a battle and record the winner
   * @param {number} battleId - ID of the current battle
   * @param {number} winner - Winner player number (1 or 2)
   * @param {Array} playerTeam - Final state of player 1's team
   * @param {Array} opponentTeam - Final state of player 2's team
   */
  endBattle: function (battleId, winner, playerTeam = null, opponentTeam = null) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    battle.winner = winner;

    // Calculate battle duration
    const startTime = new Date(battle.timestamp);
    const endTime = new Date();
    battle.duration = Math.floor((endTime - startTime) / 1000); // in seconds

    // Save the final teams' state if provided
    if (playerTeam && opponentTeam) {
      // Save complete final team data for both players
      battle.player1.finalTeamState = playerTeam.map(pokemon => ({
        id: pokemon.id,
        name: pokemon.name,
        currentHP: pokemon.currentHP,
        maxHP: pokemon.maxHP,
        status: pokemon.status,
        level: pokemon.level,
        types: pokemon.types,
        moves: pokemon.moves ? pokemon.moves.map(move => ({
          id: move.id,
          name: move.name,
          currentPP: move.currentPP,
          maxPP: move.maxPP
        })) : []
      }));

      battle.player2.finalTeamState = opponentTeam.map(pokemon => ({
        id: pokemon.id,
        name: pokemon.name,
        currentHP: pokemon.currentHP,
        maxHP: pokemon.maxHP,
        status: pokemon.status,
        level: pokemon.level,
        moves: pokemon.moves ? pokemon.moves.map(move => ({
          id: move.id,
          name: move.name,
          currentPP: move.currentPP,
          maxPP: move.maxPP
        })) : []
      }));
    }

    logger.success(
      `Stats: Battle #${battleId} completed - Winner: Player ${winner} (${battle[`player${winner}`].modelDisplayName || battle[`player${winner}`].model})`
    );
    logger.info(
      `Stats: Battle lasted ${battle.duration} seconds and ${battle.turns} turns`
    );

    // Save stats to file
    this.saveStats();
  },

  /**
   * Record banned Pokémon chosen by a player
   * @param {number} battleId - ID of the current battle
   * @param {number} playerNumber - Player number (1 or 2)
   * @param {Array} bannedPokemonList - List of banned Pokémon with IDs and names
   */
  recordBannedPokemon: function (battleId, playerNumber, bannedPokemonList) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    const playerKey = `player${playerNumber}`;
    
    // Store the banned Pokémon selection with reasoning
    battle[playerKey].bannedPokemon = {
      pokemonIds: bannedPokemonList.pokemonIds.map((p) => ({
        id: p.id,
        name: p.name,
      })),
      reasoning: bannedPokemonList.reasoning,
    };

    logger.info(
      `Stats: Recorded banned Pokémon for Player ${playerNumber} in battle #${battleId}`
    );
  },

  /**
   * Save statistics to a JSON file
   */
  saveStats: function () {
    try {
      const statsDir = path.join(__dirname, 'stats');
      if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir);
      }

      const statsPath = path.join(statsDir, 'battle_stats.json');
      const statsData = {
        lastUpdated: new Date().toISOString(),
        battles: this.battles
      };

      fs.writeFileSync(statsPath, JSON.stringify(statsData, null, 2));
      logger.success(`Stats: Data saved to ${statsPath}`);
    } catch (error) {
      logger.error('Error saving statistics:', error);
    }
  },

  /**
   * Load statistics from a JSON file (if available)
   */
  loadStats: function () {
    try {
      const statsPath = path.join(__dirname, 'stats', 'battle_stats.json');
      if (fs.existsSync(statsPath)) {
        const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

        this.battles = statsData.battles || [];

        logger.success(
          `Stats: Loaded ${this.battles.length} previous battles from ${statsPath}`
        );
      }
    } catch (error) {
      logger.error('Error loading statistics:', error);
    }
  },

  /**
   * Record the current state of both teams at a specific turn
   * @param {number} battleId - ID of the current battle
   * @param {number} turn - Current turn number
   * @param {Array} playerTeam - Current state of Player 1's team
   * @param {Array} opponentTeam - Current state of Player 2's team
   */
  recordTeamStateAtTurn: function (battleId, turn, playerTeam, opponentTeam) {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    // Format team data to store
    const player1TeamState = playerTeam.map(pokemon => ({
      id: pokemon.id,
      name: pokemon.name,
      currentHP: pokemon.currentHP,
      maxHP: pokemon.maxHP,
      status: pokemon.status,
      level: pokemon.level,
      types: pokemon.types,
      moves: pokemon.moves ? pokemon.moves.map(move => ({
        id: move.id,
        name: move.name,
        currentPP: move.currentPP,
        maxPP: move.maxPP
      })) : []
    }));

    const player2TeamState = opponentTeam.map(pokemon => ({
      id: pokemon.id,
      name: pokemon.name,
      currentHP: pokemon.currentHP,
      maxHP: pokemon.maxHP,
      status: pokemon.status,
      level: pokemon.level,
      types: pokemon.types,
      moves: pokemon.moves ? pokemon.moves.map(move => ({
        id: move.id,
        name: move.name,
        currentPP: move.currentPP,
        maxPP: move.maxPP
      })) : []
    }));

    // Add team state at this turn
    battle.player1.teamStateByTurn.push({
      turn: turn,
      teamState: player1TeamState,
      timestamp: new Date().toISOString()
    });

    battle.player2.teamStateByTurn.push({
      turn: turn,
      teamState: player2TeamState,
      timestamp: new Date().toISOString()
    });

    logger.info(`Stats: Recorded team state for turn ${turn} in battle #${battleId}`);
  },
};

module.exports = statsTracker;
