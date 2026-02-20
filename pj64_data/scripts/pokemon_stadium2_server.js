/* ============================================================
 *  Script: server_pokemon_stadium.js
 *  Description: Reads memory data from Pokémon Stadium
 *               and exposes a TCP server that responds to
 *               commands from external clients.
 *  ES5 syntax only (Duktape compatible).
 * ============================================================ */
// =======================================================================
// LOADING DATA FROM THE EXTRACTED JSON FILE
// =======================================================================

var collectedText = [];
var isCollecting = false;
// =======================================================================
// CONFIGURATION
// =======================================================================
var CONFIG = {
    port: 1766,
    maxConnections: 10,
    maxBufferSize: 8192, // 8KB maximum to prevent memory abuse
    injectionDelay: 250,
    expectedRom: {
        name: "POKEMON STADIUM 2",
        crc1: 56037762,
        crc2: 2301612141
    }
};

// Memory addresses
var MEMORY = {
    pifRamStart: 0xBFC007C0,
    playerTeamBase: 0x80145268,
    opponentTeamBase: 0x80145748,
    initialPlayerTeamBase: 0x80147390,
    initialOpponentTeamBase: 0x801475A0,
    turnNumber: 0x800D263B,
    playerMenuState: 0x801DD105,
    opponentMenuState: 0x801DD11D,
    p1ActivePokemonId: 0x801456B4,
    p2ActivePokemonId: 0x80145B94,
    textAddresses: [
        { start: 0x801E1C98, length: 64 },
        { start: 0x801E1D18, length: 64 }
    ]
};

/**
 * Reads text from memory between start and end addresses
 * @param {number} startAddress - Start memory address
 * @param {number} maxLength - Maximum length to read
 * @returns {string} - Text read from memory
 */
function readText(startAddress, maxLength) {
    try {
        // If first byte is 0, text is not used
        if (mem.u8[startAddress] === 0) {
            return "";
        }

        // Find real end address (first 0 byte)
        var realEndAddress = startAddress + maxLength;
        for (var i = startAddress; i < startAddress + maxLength; i++) {
            if (mem.u8[i] === 0) {
                realEndAddress = i;
                break;
            }
        }

        // Calculate length and read string
        var length = realEndAddress - startAddress;
        return mem.getstring(startAddress, length);
    } catch (err) {
        log("Error reading text from memory", err);
        return "";
    }
}

events.onwrite(MEMORY.textAddresses[0].start, function (e) {
    if (!isCollecting) return;
    var text = readText(MEMORY.textAddresses[0].start, MEMORY.textAddresses[0].length);
    if (text) {
        console.log("New text: " + text);
        collectedText.push(text);
        console.log(collectedText);
    }
});

events.onwrite(MEMORY.textAddresses[1].start, function (e) {
    if (!isCollecting) return;
    var text = readText(MEMORY.textAddresses[1].start, MEMORY.textAddresses[1].length);
    if (text) {
        console.log("New text: " + text);
        collectedText.push(text);
        console.log(collectedText);
    }
});

// Controller button mappings
var BUTTONS = {
    a: 0x80000000,
    b: 0x40000000,
    z: 0x20000000,
    start: 0x10000000,
    up: 0x08000000,
    down: 0x04000000,
    left: 0x02000000,
    right: 0x01000000,
    c_up: 0x00080000,
    c_down: 0x00040000,
    c_left: 0x00020000,
    c_right: 0x00010000,
    l: 0x00200000,
    r: 0x00100000
};

// =======================================================================
// GLOBAL VARIABLES
// =======================================================================
var server = null;
var isServerRunning = false;
var injectedInputs = [];
var lastInjectionTime = 0;


// =======================================================================
// UTILITY FUNCTIONS
// =======================================================================

/**
 * Logs a message to the console with optional error
 * @param {string} message - The message to log
 * @param {Error} [error] - Optional error object
 */
function log(message, error) {
    if (error) {
        console.log(message + ": " + (error.message || error));
    } else {
        console.log(message);
    }
}

/**
 * Safe memory read with error handling
 * @param {function} readFn - Function to read memory (e.g., mem.u8)
 * @param {number} address - Memory address to read
 * @param {*} defaultValue - Default value if read fails
 * @returns {*} - The read value or default
 */
function safeMemRead(readFn, address, defaultValue) {
    try {
        return readFn[address] || defaultValue;
    } catch (err) {
        return defaultValue;
    }
}

/**
 * Checks if the currently loaded ROM matches Pokemon Stadium
 * @returns {boolean} - Whether the ROM is Pokemon Stadium
 */
function isCorrectRom() {
    if (!pj64 || !pj64.romInfo) return false;
    return (
        pj64.romInfo.name === CONFIG.expectedRom.name &&
        pj64.romInfo.crc1 === CONFIG.expectedRom.crc1 &&
        pj64.romInfo.crc2 === CONFIG.expectedRom.crc2
    );
}

// =======================================================================
// POKEMON DATA FUNCTIONS
// =======================================================================

function readPokemonMoves(baseAddress) {
    var moves = [];
    for (var i = 0; i < 4; i++) {
        var moveId = mem.u8[baseAddress + 0x02 + i];
        var currentPP = mem.u8[baseAddress + 0x18 + i];

        // Return only raw data
        if (moveId > 0) {
            moves.push({
                id: moveId,
                currentPP: currentPP
            });
        }
    }
    return moves;
}

/**
 * Reads Pokemon details from a memory address
 * @param {number} baseAddress - Memory address where Pokemon data starts
 * @returns {Object} - Pokemon details
 */
function getPokemonDetails(baseAddress) {
    try {
        var id = mem.u8[baseAddress] || 0;
        var currentHP = mem.u16[baseAddress + 0x26] || 0;
        var maxHP = mem.u16[baseAddress + 0x28] || 0;
        var level = mem.u8[baseAddress + 0x1D] || 0;
        var status = mem.u8[baseAddress + 0x24] || 0;
        var attack = mem.u16[baseAddress + 0x2A] || 0;
        var defense = mem.u16[baseAddress + 0x2C] || 0;
        var speed = mem.u16[baseAddress + 0x2E] || 0;
        var specialAttack = mem.u16[baseAddress + 0x30] || 0;
        var specialDefense = mem.u16[baseAddress + 0x32] || 0;

        // Return only raw data without enrichment
        return {
            id: id,
            currentHP: currentHP,
            maxHP: maxHP,
            level: level,
            status: status,
            attack: attack,
            defense: defense,
            speed: speed,
            specialAttack: specialAttack,
            specialDefense: specialDefense,
            moves: readPokemonMoves(baseAddress),
        };
    } catch (err) {
        log("Error reading Pokemon data", err);
        return {
            id: 0,
            currentHP: 0,
            maxHP: 0,
            level: 0,
            status: 0,
            attack: 0,
            defense: 0,
            speed: 0,
            specialAttack: 0,
            specialDefense: 0,
            moves: [],
        };
    }
}

/**
 * Gets both teams' Pokemon information
 * @returns {Object} - Player and opponent team data
 */
function getTeamsInfo() {
    try {
        var playerTeam = getTeamInfo(MEMORY.playerTeamBase, 6);
        var opponentTeam = getTeamInfo(MEMORY.opponentTeamBase, 6);

        var initPlayerTeam = getTeamInfo(MEMORY.initialPlayerTeamBase, 6);
        var initOpponentTeam = getTeamInfo(MEMORY.initialOpponentTeamBase, 6);

        return {
            p1ActivePokemonId: mem.u16[MEMORY.p1ActivePokemonId],
            p2ActivePokemonId: mem.u16[MEMORY.p2ActivePokemonId],
            playerTeam: playerTeam,
            opponentTeam: opponentTeam,
            initialPlayerTeam: initPlayerTeam,
            initialOpponentTeam: initOpponentTeam
        };
    } catch (err) {
        log("Error retrieving teams", err);
        return {
            playerTeam: [],
            opponentTeam: []
        };
    }
}

/**
 * Gets a single team's Pokemon information
 * @param {number} baseAddress - Team's base memory address
 * @param {number} teamSize - Maximum team size
 * @returns {Array} - Team's Pokemon data
 */
function getTeamInfo(baseAddress, teamSize) {
    var team = [];
    for (var i = 0; i < teamSize; i++) {
        var pokeAddress = baseAddress + (0x58 * i);
        var pokeId = mem.u8[pokeAddress] || 0;
        if (pokeId > 0) {
            var details = getPokemonDetails(pokeAddress);
            team.push(details);
        }
    }
    return team;
}


// =======================================================================
// INPUT INJECTION FUNCTIONS
// =======================================================================

/**
 * Processes and validates controller input commands
 * @param {string} cmd - Raw command string
 * @returns {string} - Result message
 */
function processInputCommand(cmd) {
    var parts = cmd.split(" ");

    if (parts.length < 2) {
        return "Usage: send_input [player] <button1> [button2] ...\nExample: send_input 1 a left\nOr: send_input a left (for player 1 by default)";
    }

    var playerNumber = 1;
    var buttonStartIndex = 1;

    // Check if player number is specified
    if (parts.length >= 3 && (parts[1] === "1" || parts[1] === "2" || parts[1] === "player1" || parts[1] === "player2")) {
        if (parts[1] === "2" || parts[1] === "player2") {
            playerNumber = 2;
        }
        buttonStartIndex = 2;
    }

    // Validate player number
    if (playerNumber < 1 || playerNumber > 2) {
        return "Invalid player number: " + playerNumber + " (must be 1 or 2)";
    }

    var bitmask = 0;
    var buttonList = [];

    // Process each button
    for (var i = buttonStartIndex; i < parts.length; i++) {
        var key = parts[i].toLowerCase();

        if (key === "wait") {
            injectedInputs.push({ player: playerNumber, input: -1 });
            buttonList.push("wait");
            continue;
        }

        if (BUTTONS[key] === undefined) {
            return "Unknown button: " + parts[i] + "\nValid buttons: " + Object.keys(BUTTONS).join(", ");
        }

        bitmask |= BUTTONS[key];
        buttonList.push(key);
    }

    log("Sending input for Player " + playerNumber + ": " + buttonList.join(", ") + " => bitmask: " + bitmask.toString(16));

    if (bitmask !== 0) {
        injectedInputs.push({ player: playerNumber, input: bitmask });
    }

    return "Input injected for player " + playerNumber + ": " + buttonList.join(", ");
}

/**
 * Handles PIF RAM reads for input injection
 */
function injectInput() {
    try {
        var now = Date.now();
        if (now - lastInjectionTime < CONFIG.injectionDelay) return;

        // Process queued inputs
        if (injectedInputs.length > 0) {
            var input = injectedInputs.shift();
            if (!input || typeof input.player !== 'number') {
                log("Invalid input ignored");
                return;
            }

            // Special case for title change
            if (input.type === "change_title") {
                lastInjectionTime = now;

                if (input.stage === 1) {
                    // First wait completed, now change the title
                    log("Changing title to: " + input.title);
                    for (var i = 0; i < 24; i++) {
                        mem.u8[0x80225CFF + i] = 0;
                    }
                    mem.setstring(0x80225CFF, input.title);



                    // Queue the second wait
                    injectedInputs.unshift({
                        player: input.player,
                        type: "change_title",
                        stage: 2,
                        title: input.title
                    });

                    CONFIG.injectionDelay = 1000; // Wait 1 second
                    return;
                }

                if (input.stage === 2) {
                    // Second wait completed, we're done
                    log("Title change sequence completed for: " + input.title);
                    CONFIG.injectionDelay = 250; // Reset to normal delay
                    return;
                }

                // Initial state - queue the first wait then the actual change
                injectedInputs.unshift({
                    player: input.player,
                    type: "change_title",
                    stage: 1,
                    title: input.title
                });

                CONFIG.injectionDelay = 1000; // Wait 1 second
                return;
            }

            // Validate player number
            if (input.player < 1 || input.player > 2) {
                log("Invalid player number ignored: " + input.player);
                return;
            }

            // Calculate player's PIF block offset
            var blockStart = MEMORY.pifRamStart + ((input.player - 1) * 8);

            // Check if player's command block is ready for injection
            if (mem.u32[blockStart] === 0xFF010401) {
                // Handle wait command (-1)
                if (input.input === -1) {
                    log("'Wait' command injected for player " + input.player + " - Waiting 1 second");
                    lastInjectionTime = now;
                    CONFIG.injectionDelay = 1000;
                } else {
                    lastInjectionTime = now;
                    CONFIG.injectionDelay = 250;
                    // Inject input into player's data block
                    mem.u32[blockStart + 4] = input.input;
                    log("Input injected into PIF RAM for Player " + input.player + ": " + input.input.toString(16));
                }
            } else {
                // If block not ready, requeue the input
                log("PIF block not ready for Player " + input.player + ", input requeued");
                injectedInputs.unshift(input);
            }
        }
    } catch (err) {
        log("Error during input injection", err);
    }
}

// =======================================================================
// TEXT COLLECTION FUNCTIONS
// =======================================================================

function getCurrentWindow() {
    // Define window constants
    var WINDOWS = {
        SELECT_TEAM: 8,
        SELECT_POKEMON: 16,
        BATTLE: 32,
        GAME_OVER: 64,
        UNKNOWN: 0
    };

    try {

        // Check for "Try Again" at 0x8018A936
        if (mem.getstring(0x8018A936, 9) === "Try Again") {
            return WINDOWS.GAME_OVER;
        }


        // Check for "Select team" window
        // 8028BA05: 59657300
        // 8028BA09: 52652D73
        // 8028BA0D: 656C6563
        // 8028BA11: 74
        if (
            safeMemRead(mem.u32, 0x8028BA05, 0) === 0x59657300 &&
            safeMemRead(mem.u32, 0x8028BA09, 0) === 0x52652D73 &&
            safeMemRead(mem.u32, 0x8028BA0D, 0) === 0x656C6563 &&
            safeMemRead(mem.u8, 0x8028BA11, 0) === 0x74
        ) {
            return WINDOWS.SELECT_TEAM;
        }

        // Check for "Select Pokemon" window
        // 8028B965: 9F9F9F7F
        // 8028B969: 6F6F6F8F
        // 8028B96D: 8F8F7F6F
        if (
            safeMemRead(mem.u32, 0x8028B965, 0) === 0x9F9F9F7F &&
            safeMemRead(mem.u32, 0x8028B969, 0) === 0x6F6F6F8F &&
            safeMemRead(mem.u32, 0x8028B96D, 0) === 0x8F8F7F6F
        ) {
            return WINDOWS.SELECT_POKEMON;
        }

        // Check for battle/fight window
        // 8028B961: 10F3C000
        // 8028B965: 00153000
        // 8028B969: 00000000
        // 8028B96D: 00000000
        // 8028B971: 1108F000
        // 8028B975: 00153000
        if (
            safeMemRead(mem.u32, 0x8028B961, 0) === 0x10F3C000 &&
            safeMemRead(mem.u32, 0x8028B965, 0) === 0x00153000 &&
            safeMemRead(mem.u32, 0x8028B969, 0) === 0x00000000 &&
            safeMemRead(mem.u32, 0x8028B96D, 0) === 0x00000000 &&
            safeMemRead(mem.u32, 0x8028B971, 0) === 0x1108F000 &&
            safeMemRead(mem.u32, 0x8028B975, 0) === 0x00153000
        ) {
            return WINDOWS.BATTLE;
        }

        // Couldn't identify window
        return WINDOWS.UNKNOWN;
    } catch (err) {
        log("Error detecting current window", err);
        return WINDOWS.UNKNOWN;
    }
}


// =======================================================================
// COMMAND PROCESSING
// =======================================================================

/**
 * Processes commands from clients
 * @param {string} cmd - Command string to process
 * @returns {string} - Command result
 */
function processCommand(cmd) {
    if (!cmd || typeof cmd !== 'string') {
        return "Invalid command";
    }

    // Extract the command ID if present (format: cmd_timestamp_counter)
    var commandParts = cmd.split(' ');
    var commandId = null;

    // Check if the last part looks like a command ID
    if (commandParts.length > 1 && commandParts[commandParts.length - 1].startsWith('cmd_')) {
        commandId = commandParts.pop(); // Remove and save the command ID
        cmd = commandParts.join(' '); // Reconstruct the command without ID
    }

    var input = cmd.trim().toLowerCase();

    try {
        // Team information command
        if (input === "teams") {
            var teams = getTeamsInfo();
            log("Teams retrieved");
            var result = JSON.stringify(teams, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }
        // Current window command
        else if (input === "current_window") {
            var result = JSON.stringify({
                window: getCurrentWindow() || 0
            }, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }
        // Turn number command
        else if (input === "turn_number") {
            var result = JSON.stringify({
                turn: mem.u8[MEMORY.turnNumber] || 0
            }, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }

        // Check if player done a bad move
        else if (input === "check_bad_move") {
            // P1 try to switch pokemon but not allowed to do (Trapped, etc...)
            // P1 menu state: 9
            // P2 menu state: 11
            var result = JSON.stringify({
                p1_bad_move: mem.u8[MEMORY.playerMenuState] === 9,
                p2_bad_move: mem.u8[MEMORY.opponentMenuState] === 9,
                error_message: "This action is not possible right now"
            }, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }

        // Check if a player have finished choosing their team
        else if (input === "check_team_choice") {
            // 8015A82C: If this is not 0, player 1 have finished choosing their team
            // 8015A830: If this is not 0, player 2 have finished choosing their team
            var result = JSON.stringify({
                player1_team_choice: mem.u8[0x8015A82C] || 0,
                player2_team_choice: mem.u8[0x8015A830] || 0
            }, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }
        // Change title command
        else if (input.indexOf("change_title") === 0) {
            var parts = cmd.trim().split(" ");

            if (parts.length < 2) {
                return "Usage: change_title [title]\nExample: change_title GPT-4o";
            }

            // Join all parts after "change_title" as the title
            var title = parts.slice(1).join(" ");

            // Queue the title change in the input system
            injectedInputs.push({
                player: 1, // Default to player 1
                type: "change_title",
                stage: 0, // Initial stage
                title: title
            });

            var result = JSON.stringify({
                success: true,
                message: "Title change queued: " + title
            }, null, 2);

            // Add command ID to response if available
            if (commandId) {
                var jsonObj = JSON.parse(result);
                jsonObj.command_id = commandId;
                return JSON.stringify(jsonObj, null, 2);
            }
            return result;
        }
        // Set nickname command
        else if (input.indexOf("set_nickname") === 0) {
            var parts = cmd.trim().split(" ");

            if (parts.length < 3) {
                return "Usage: set_nickname [player] [nickname]\nExample: set_nickname 1 GPT-4o";
            }

            var playerNum = parts[1];
            // Join remaining parts as the nickname (allows spaces in nicknames)
            var nickname = parts.slice(2).join(" ");

            // Validate player number
            if (playerNum !== "1" && playerNum !== "2") {
                return "Invalid player number: " + playerNum + " (must be 1 or 2)";
            }

            // Validate nickname length (maximum 12 characters for Stadium)
            if (nickname.length > 12) {
                return "Nickname too long: maximum 12 characters allowed";
            }

            try {
                // Set nickname based on player number
                var jsonResponse;
                if (playerNum === "1") {
                    mem.setstring(0x80165D58, nickname);
                    log("Player 1 nickname changed to: " + nickname);
                    jsonResponse = {
                        success: true,
                        message: "Player 1 nickname changed to: " + nickname
                    };
                } else {
                    mem.setstring(0x80174590, nickname);
                    log("Player 2 nickname changed to: " + nickname);
                    jsonResponse = {
                        success: true,
                        message: "Player 2 nickname changed to: " + nickname
                    };
                }

                // Add command ID to response if available
                if (commandId) {
                    jsonResponse.command_id = commandId;
                }

                return JSON.stringify(jsonResponse, null, 2);
            } catch (err) {
                var errorResponse = {
                    success: false,
                    message: "Error changing nickname: " + err.message
                };

                // Add command ID to response if available
                if (commandId) {
                    errorResponse.command_id = commandId;
                }

                return JSON.stringify(errorResponse, null, 2);
            }
        }

        else if (input.indexOf("change_fight_description") === 0) {
            var parts = cmd.trim().split(" ");

            if (parts.length < 2) {
                console.log("Usage: change_fight_description [description]\nExample: change_fight_description Please select three Pokémon using the indicated buttons.");
                console.log("parts.length: " + parts.length);
                var errorResponse = {
                    success: false,
                    message: "Usage: change_fight_description [description]\nExample: change_fight_description Please select three Pokémon using the indicated buttons."
                };

                // Add command ID to response if available
                if (commandId) {
                    errorResponse.command_id = commandId;
                }

                return JSON.stringify(errorResponse, null, 2);
            }

            // Join all parts after "change_fight_description" as the fight description
            var fightDescription = parts.slice(1).join(" ");

            console.log("Fight description changed to: " + fightDescription);
            for (var i = 0x8028B959; i < 0x8028B98F; i++) {
                mem.u8[i] = 0;
            }
            // Then, set the new title
            mem.setstring(0x8028B959, fightDescription);

            var successResponse = {
                success: true,
                message: "Fight description changed to: " + fightDescription
            };

            // Add command ID to response if available
            if (commandId) {
                successResponse.command_id = commandId;
            }

            return JSON.stringify(successResponse, null, 2);
        }
        // Input sending command
        else if (input.indexOf("send_input") === 0) {
            var inputResult = processInputCommand(cmd);

            // If it's a string (non-JSON) response, wrap it in a JSON object
            if (typeof inputResult === 'string' && !inputResult.startsWith('{')) {
                var response = {
                    message: inputResult,
                    success: !inputResult.includes("Error") && !inputResult.includes("Unknown") && !inputResult.includes("Invalid")
                };

                // Add command ID to response if available
                if (commandId) {
                    response.command_id = commandId;
                }

                return JSON.stringify(response, null, 2);
            }

            // If it's already JSON, add command ID
            if (typeof inputResult === 'string' && inputResult.startsWith('{') && commandId) {
                try {
                    var jsonObj = JSON.parse(inputResult);
                    jsonObj.command_id = commandId;
                    return JSON.stringify(jsonObj, null, 2);
                } catch (e) {
                    // If parsing fails, just return the original
                    return inputResult;
                }
            }

            return inputResult;
        }

        else if (input === "get_all_text") {
            var response = { textData: collectedText };

            // Add command ID to response if available
            if (commandId) {
                response.command_id = commandId;
            }

            return JSON.stringify(response, null, 2);
        }
        else if (input === "clean_text") {
            collectedText = [];
            var response = {
                success: true,
                message: "Text cleaned"
            };

            // Add command ID to response if available
            if (commandId) {
                response.command_id = commandId;
            }

            return JSON.stringify(response, null, 2);
        }
        // Command to check if P1 / P2 can attack / change pokemon
        else if (input === "check_can_attack") {
            var response = {
                success: true,
                p1_can_attack: mem.u8[MEMORY.playerMenuState] === 1,
                p2_can_attack: mem.u8[MEMORY.opponentMenuState] === 1
            };

            // Add command ID to response if available
            if (commandId) {
                response.command_id = commandId;
            }

            return JSON.stringify(response, null, 2);
        }
        else if (input === "check_need_change") {
            var response = {
                success: true,
                p1_need_change: mem.u8[MEMORY.playerMenuState] === 12 || mem.u8[MEMORY.playerMenuState] === 5,
                p1_need_change_status: mem.u8[MEMORY.playerMenuState],
                p2_need_change: mem.u8[MEMORY.opponentMenuState] === 12 || mem.u8[MEMORY.opponentMenuState] === 5,
                p2_need_change_status: mem.u8[MEMORY.opponentMenuState]
            };

            // Add command ID to response if available
            if (commandId) {
                response.command_id = commandId;
            }

            return JSON.stringify(response, null, 2);
        }
        else if (input === "start_text_collect") {
            isCollecting = true;
            return JSON.stringify({
                success: true,
                message: "Text collection started",
                command_id: commandId
            }, null, 2);
        } else if (input === "end_text_collect") {
            isCollecting = false;
            return JSON.stringify({
                success: true,
                message: "Text collection ended",
                command_id: commandId
            }, null, 2);
        }
        // Quit command
        else if (input === "quit" || input === "exit") {
            return "__CLOSE__";
        }
        // Unknown command
        else {
            return "Unknown command: " + input + "\nType 'help' for command list.";
        }
    } catch (err) {
        log("Error processing command: " + cmd, err);
        // Create error response object
        var errorResponse = {
            cmd_exec_error: true,
            message: "Error processing command: " + err.message
        };

        // Add command ID to error response if available
        if (commandId) {
            errorResponse.command_id = commandId;
        }

        return JSON.stringify(errorResponse, null, 2);
    }
}

// =======================================================================
// TCP SERVER MANAGEMENT
// =======================================================================

/**
 * Sets up TCP server event handlers
 * @param {Server} server - TCP server instance
 */
function setupServerEvents(server) {
    if (!server) {
        log("Error: server is null in setupServerEvents");
        return;
    }

    // Track active connections
    var activeConnections = [];

    server.on('listening', function () {
        log("Server listening: " + server.address + ":" + server.port);
    });

    server.on('connection', function (socket) {
        if (!socket) {
            log("Error: invalid socket connection");
            return;
        }

        var clientId = socket.remoteAddress + ":" + socket.remotePort;
        log("Client connected: " + clientId);

        // Add socket to active connections
        activeConnections.push(socket);

        try {
            socket.write("Welcome to Pokemon Stadium Server!\nType 'help' for command list.\n");
        } catch (err) {
            log("Error writing initial welcome to socket", err);
            cleanupSocket(socket);
            return;
        }

        // Initialize data buffer for partial data
        socket._dataBuffer = "";

        socket.on('data', function (data) {
            try {
                // Validate data
                if (!data || !data.toString) {
                    log("Invalid data received from " + clientId);
                    cleanupSocket(socket);
                    return;
                }

                var dataStr = data.toString();

                // Buffer size protection
                if (socket._dataBuffer.length + dataStr.length > CONFIG.maxBufferSize) {
                    log("Buffer too large for client " + clientId + ", connection closed");
                    socket.end("Error: too much data sent without processing\n");
                    cleanupSocket(socket);
                    return;
                }

                // Add received data to buffer
                socket._dataBuffer += dataStr;

                // Split commands by newline
                var parts = socket._dataBuffer.split("\n");
                // Last element may be incomplete, keep in buffer
                socket._dataBuffer = parts.pop() || "";

                for (var i = 0; i < parts.length; i++) {
                    var commandStr = parts[i].trim();
                    if (commandStr.length === 0) {
                        continue;
                    }

                    log("Command received from " + clientId + ": " + commandStr);

                    var result;
                    try {
                        result = processCommand(commandStr);
                    } catch (err) {
                        result = "Error processing command: " + err.message;
                        log("Processing error for " + clientId, err);
                    }

                    if (result === "__CLOSE__") {
                        try {
                            socket.write("Closing connection...\n");
                            cleanupSocket(socket);
                        } catch (writeErr) {
                            log("Error closing socket for " + clientId, writeErr);
                            cleanupSocket(socket);
                        }
                        return;
                    }

                    try {
                        socket.write(result + "\n");
                    } catch (writeErr) {
                        log("Error writing to socket for " + clientId, writeErr);
                        cleanupSocket(socket);
                        return;
                    }
                }
            } catch (generalErr) {
                log("Global error in 'data' event for " + clientId, generalErr);
                cleanupSocket(socket);
            }
        });

        socket.on('end', function () {
            log("Client disconnected normally: " + clientId);
            cleanupSocket(socket);
        });

        socket.on('error', function (err) {
            log("Socket error for " + clientId, err);
            cleanupSocket(socket);
        });

        // Utility function to clean up a connection
        function cleanupSocket(socket) {
            try {
                // Remove socket from active connections
                var index = activeConnections.indexOf(socket);
                if (index !== -1) {
                    activeConnections.splice(index, 1);
                }

                // Check if socket is still valid and writable before ending it
                if (socket && socket.writable) {
                    socket.end();
                }
            } catch (err) {
                log("Error cleaning up socket for " + clientId, err);
            }
        }
    });

    server.on('error', function (err) {
        log("Server error", err);
        isServerRunning = false;

        // Clean up all connections on server error
        while (activeConnections.length > 0) {
            try {
                var socket = activeConnections.pop();
                socket.end();
            } catch (err) {
                log("Error closing a connection", err);
            }
        }
    });

    // Limit simultaneous connections
    server.maxConnections = CONFIG.maxConnections;
}

/**
 * Starts the TCP server
 */
function startServer() {
    if (isServerRunning) {
        log("Server is already running");
        return;
    }

    try {
        // Use server API specific to the environment
        server = new Server();
        setupServerEvents(server);
        script.keepalive(true);
        server.listen(CONFIG.port, "0.0.0.0");
        log("TCP server started on port " + CONFIG.port);
        isServerRunning = true;
    } catch (err) {
        log("Error starting server", err);
        stopServer();
    }
}

/**
 * Stops the TCP server
 */
function stopServer() {
    if (!isServerRunning || !server) {
        log("Server is not running");
        return;
    }

    try {
        server.close();
        log("TCP server stopped");
    } catch (err) {
        log("Error stopping server", err);
    } finally {
        isServerRunning = false;
        server = null;
        script.keepalive(false);
    }
}

/**
 * Restarts the TCP server
 */
function restartServer() {
    if (isServerRunning) {
        stopServer();
    }
    startServer();
}

// =======================================================================
// EVENT HANDLERS
// =======================================================================

// Handle PIF read events (for input injection)
events.onpifread(function () {
    injectInput();
});

// Handle emulator state changes
events.onstatechange(function (e) {
    try {
        if (e && e.state === EMU_STARTED) {
            log("Emulation started");
            if (isCorrectRom()) {
                if (!isServerRunning) {
                    log("Correct ROM detected: Pokemon Stadium 2");
                    startServer();
                }
            } else {
                log("Incorrect ROM - Server will not start");
                stopServer();
            }
        } else if (e && e.state === EMU_STOPPED) {
            log("Emulation stopped");
            stopServer();
        }
    } catch (err) {
        log("Error in statechange event", err);
    }
});

// =======================================================================
// INITIALIZATION
// =======================================================================

// Initial ROM check
try {
    if (pj64 && pj64.romInfo && isCorrectRom()) {
        log("Pokemon Stadium 2 ROM already loaded on script startup");
        startServer();
    } else {
        log("Waiting for Pokemon Stadium 2 ROM to be loaded...");
    }
} catch (err) {
    log("Error during initial ROM check", err);
}