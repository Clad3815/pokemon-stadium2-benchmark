/************************************************
 * FILE: battle.js
 ************************************************/

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Jimp } = require('jimp');
const chalk = require('./chalk');
const logger = require('./logger');
const statsTracker = require('./statsTracker');
const { getModelRuntimeInfo } = require('./modelUtils');

// Import the game client and PokeAPIClient
const GameClient = require('./GameClient');
const PokeAPIClient = require('./PokeAPIClient');

// Instantiate the game client and PokeAPI
const gameClient = new GameClient();
const pokeApi = new PokeAPIClient('en');

/**
 * Global variables for battle state tracking.
 */
let initialTeamsInfo = null;
let lastTeamsInfo = null;
let logsHistory = [];
let canAttack = true;
let activePlayerPokemon = null;
let activeOpponentPokemon = null;
let currentBattleId = null;

let battleHistory = {
    turns: [],
    texts: [],
    currentTurn: 0,
};

let lastBattleHistory = null;

// Chat message lists
let chatMessagesPlayer1 = [];
let chatMessagesPlayer2 = [];

/*******************************************************************
 *                          UTILITIES
 *******************************************************************/

/**
 * Wait (ms)
 */
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates waiting in the game (by sending "wait" commands to the GameClient).
 */
async function waitInGame(player, count = 1) {
    const commands = Array(count).fill('wait');
    await gameClient.sendCommandsSequentially(commands, player, 1);
}

/**
 * Waits until a specific window is displayed in the game.
 */
async function waitForWindow(expectedWindow) {
    let current = await gameClient.currentWindow();
    console.log(`Waiting for window ${expectedWindow}... Currently: ${current.window}`);
    while (current.window !== expectedWindow) {
        await wait(1000);
        current = await gameClient.currentWindow();
    }
    console.log(`Window ${expectedWindow} found`);
}


/**
 * Retrieves team information and adjusts it based on the battle type.
 * If global.battleType is '3vs3', limits teams to 3 Pokemon.
 * If global.battleType is '6vs6', keeps full teams.
 * @returns {Promise<Object>} Team data adjusted according to battle type
 */
async function getTeamsData() {
    const teamsData = await gameClient.teams();

    // If battle type is 3vs3, limit teams to 3 Pokemon
    if (global.battleType === '3vs3') {
        teamsData.playerTeam = teamsData.playerTeam.slice(0, 3);
        teamsData.opponentTeam = teamsData.opponentTeam.slice(0, 3);
    }

    return teamsData;
}

function getTeamSize() {
    return global.battleType === '3vs3' ? 3 : 6;
}

function getPlayerRuntimeModelInfo(playerNumber) {
    const modelName = playerNumber === 1 ? global.modelPlayer1 : global.modelPlayer2;
    const reasoningEffort = playerNumber === 1
        ? global.modelPlayer1ReasoningEffort
        : global.modelPlayer2ReasoningEffort;

    return getModelRuntimeInfo(modelName, reasoningEffort);
}

function getPlayerDisplayModelName(playerNumber, preferredField = 'name') {
    const runtimeInfo = getPlayerRuntimeModelInfo(playerNumber);
    if (preferredField === 'shortName') {
        return runtimeInfo.modelShortDisplayName;
    }
    if (preferredField === 'chatUsername') {
        return runtimeInfo.modelChatDisplayName;
    }
    return runtimeInfo.modelDisplayName;
}

/*******************************************************************
 *                     TEAM & POKEMON UTILITIES
 *******************************************************************/

/**
 * Formats Pokemon details for console display.
 */
async function formatPokemonDetails(
    details,
    pokeApiInstance,
    { includeIndex = false, index = null } = {},
    showMoves = true
) {
    if (!details || details.id === 0) {
        return includeIndex ? `#${index} No Pokémon` : 'No Pokémon';
    }

    const [type1Name, type2Name] = details.types;
    const lang = pokeApiInstance.language;

    // Localized labels
    const labels = {
        level: lang === 'fr' ? 'Niv.' : 'Lvl.',
        hp: lang === 'fr' ? 'PV' : 'HP',
        status: lang === 'fr' ? 'Statut' : 'Status',
        attack: lang === 'fr' ? 'Attaque' : 'Attack',
        defense: lang === 'fr' ? 'Défense' : 'Defense',
        speed: lang === 'fr' ? 'Vitesse' : 'Speed',
        special: lang === 'fr' ? 'Spécial' : 'Special',
        specialAttack: lang === 'fr' ? 'Atq. Spéciale' : 'Sp. Atk',
        specialDefense: lang === 'fr' ? 'Def. Spéciale' : 'Sp. Def',
        moves: lang === 'fr' ? 'ATTAQUES' : 'MOVES',
        fainted: lang === 'fr' ? '(K.O.)' : '(Fainted)',
        notVisible: lang === 'fr' ? '[Non visible]' : '[Not visible]',
        power: lang === 'fr' ? 'Puissance' : 'Power',
        accuracy: lang === 'fr' ? 'Précision' : 'Accuracy',
        type: lang === 'fr' ? 'Type' : 'Type',
        category: lang === 'fr' ? 'Catégorie' : 'Category',
        effect: lang === 'fr' ? 'Effet' : 'Effect',
        pp: lang === 'fr' ? 'PP' : 'PP',
        stats: lang === 'fr' ? 'STATISTIQUES' : 'STATS'
    };

    const typeColors = {
        normal: chalk.hex('#A8A878').bold,
        fire: chalk.hex('#F08030').bold,
        water: chalk.hex('#6890F0').bold,
        electric: chalk.hex('#F8D030').bold,
        grass: chalk.hex('#78C850').bold,
        ice: chalk.hex('#98D8D8').bold,
        fighting: chalk.hex('#C03028').bold,
        poison: chalk.hex('#A040A0').bold,
        ground: chalk.hex('#E0C068').bold,
        flying: chalk.hex('#A890F0').bold,
        psychic: chalk.hex('#F85888').bold,
        bug: chalk.hex('#A8B820').bold,
        rock: chalk.hex('#B8A038').bold,
        ghost: chalk.hex('#705898').bold,
        dragon: chalk.hex('#7038F8').bold,
        dark: chalk.hex('#705848').bold,
        steel: chalk.hex('#B8B8D0').bold,
        fairy: chalk.hex('#EE99AC').bold,
    };

    const formatType = (typeName) => {
        const colorFn = typeColors[typeName.toLowerCase()];
        return colorFn ? colorFn(typeName) : typeName;
    };

    // Type and value coloring
    const typeStr = type2Name
        ? `${formatType(type1Name)}/${formatType(type2Name)}`
        : formatType(type1Name);

    const hpPercentage = (details.currentHP / details.maxHP) * 100;
    const hpColor =
        hpPercentage > 50
            ? chalk.green.bold
            : hpPercentage > 25
                ? chalk.yellow.bold
                : chalk.red.bold;

    const statusText = pokeApiInstance.getStatusText(details.status);
    const statusColor =
        details.status === 0 ? chalk.green.bold : chalk.yellow.bold;

    // Pokemon information
    const pokemonName = chalk.bold.white(pokeApiInstance.getPokemonName(details.id));

    // Pokemon stats
    const stats = {
        level: `${labels.level} ${details.level}`,
        hp: `${labels.hp}: ${hpColor(details.currentHP + '/' + details.maxHP)}${details.currentHP === 0 ? ` ${labels.fainted}` : ''}`,
        status: `${labels.status}: ${statusColor(statusText)}`,
        attack: `${labels.attack}: ${details.attack}`,
        defense: `${labels.defense}: ${details.defense}`,
        speed: `${labels.speed}: ${details.speed}`,
        specialAttack: `${labels.specialAttack}: ${details.specialAttack}`,
        specialDefense: `${labels.specialDefense}: ${details.specialDefense}`
    };

    // Build the formatted base text
    let header = includeIndex
        ? `${chalk.bold.magenta('#' + index)} ${pokemonName} (${stats.level}) [${typeStr}]`
        : `${chalk.bold.cyan('#' + details.id)} ${pokemonName} (${stats.level}) [${typeStr}]`;

    let baseStr = `${header}\n`;
    baseStr += `${stats.hp}\n${stats.status}`;

    // Format moves if needed
    if (showMoves) {
        // Add stats section
        baseStr += `\n\n${chalk.bold('━━━')} ${chalk.bold(labels.stats)} ${chalk.bold('━━━')}`;
        baseStr += `\n${stats.attack.padEnd(20)} ${stats.specialAttack}`;
        baseStr += `\n${stats.defense.padEnd(20)} ${stats.specialDefense}`;
        baseStr += `\n${stats.speed}`;

        // Add moves section
        baseStr += `\n\n${chalk.bold('━━━')} ${chalk.bold(labels.moves)} ${chalk.bold('━━━')}`;

        if (!details.moves || details.moves.length === 0) {
            baseStr += `\n${labels.notVisible}`;
        } else {
            details.moves.forEach(function (move, idx) {
                const moveType = move.type ? formatType(move.type) : 'Unknown';
                baseStr += `\n[${chalk.cyan.bold(idx + 1)}] ${chalk.white.bold(move.name.toUpperCase())} (${labels.pp}: ${move.currentPP}${move.maxPP ? '/' + move.maxPP : ''})`;

                if (move.type && move.category && move.power !== undefined && move.accuracy !== undefined) {
                    baseStr += `\n  • ${labels.type}: ${moveType.padEnd(15)} | ${labels.category}: ${(move.category || '').padEnd(10)} | ${labels.power}: ${String(move.power || 0).padEnd(3)} | ${labels.accuracy}: ${move.accuracy || 0}`;
                }

                if (move.description) {
                    baseStr += `\n  • ${move.description}`;
                }

                baseStr += '\n';
            });
        }
    }

    return baseStr;
}

/**
 * Formats teams (player & opponent) for console display.
 */
async function formatTeamsInfo(rawData, pokeApiInstance) {
    const formattedTeams = { playerTeam: [], opponentTeam: [] };

    if (rawData.playerTeam && Array.isArray(rawData.playerTeam)) {
        for (let i = 0; i < rawData.playerTeam.length; i++) {
            const pokemon = rawData.playerTeam[i];
            if (pokemon && pokemon.id > 0) {
                formattedTeams.playerTeam.push(
                    await formatPokemonDetails(pokemon, pokeApiInstance)
                );
            }
        }
    }
    if (rawData.opponentTeam && Array.isArray(rawData.opponentTeam)) {
        for (let i = 0; i < rawData.opponentTeam.length; i++) {
            const pokemon = rawData.opponentTeam[i];
            if (pokemon && pokemon.id > 0) {
                formattedTeams.opponentTeam.push(
                    await formatPokemonDetails(pokemon, pokeApiInstance)
                );
            }
        }
    }
    return formattedTeams;
}

async function formatInitialTeamsInfo(rawData, pokeApiInstance) {
    const formattedTeams = { initialPlayerTeam: [], initialOpponentTeam: [] };

    if (rawData.initialPlayerTeam && Array.isArray(rawData.initialPlayerTeam)) {
        for (let i = 0; i < rawData.initialPlayerTeam.length; i++) {
            const pokemon = rawData.initialPlayerTeam[i];
            if (pokemon && pokemon.id > 0) {
                formattedTeams.initialPlayerTeam.push(
                    await formatPokemonDetails(pokemon, pokeApiInstance)
                );
            }
        }
    }
    if (rawData.initialOpponentTeam && Array.isArray(rawData.initialOpponentTeam)) {
        for (let i = 0; i < rawData.initialOpponentTeam.length; i++) {
            const pokemon = rawData.initialOpponentTeam[i];
            if (pokemon && pokemon.id > 0) {
                formattedTeams.initialOpponentTeam.push(
                    await formatPokemonDetails(pokemon, pokeApiInstance)
                );
            }
        }
    }
    return formattedTeams;
}

/**
 * Compares two team snapshots and returns detected changes.
 */
function getTeamChanges(oldTeam, newTeam) {
    if (!oldTeam || !newTeam) return [];

    const changes = [];
    newTeam.forEach((newPokemon) => {
        const oldPokemon = oldTeam.find((p) => p.id === newPokemon.id);
        if (!oldPokemon) return;

        const hpChanged = oldPokemon.currentHP !== newPokemon.currentHP;
        const statusChanged = oldPokemon.status !== newPokemon.status;

        const ppChanges = [];
        for (let i = 0; i < 4; i++) {
            if (oldPokemon.moves[i] > 0 && oldPokemon.pp[i] !== newPokemon.pp[i]) {
                ppChanges.push({
                    moveIndex: i,
                    oldPP: oldPokemon.pp[i],
                    newPP: newPokemon.pp[i],
                    moveId: newPokemon.moves[i],
                });
            }
        }

        if (hpChanged || statusChanged || ppChanges.length > 0) {
            changes.push({
                id: newPokemon.id,
                oldHP: oldPokemon.currentHP,
                newHP: newPokemon.currentHP,
                oldStatus: oldPokemon.status,
                newStatus: newPokemon.status,
                ppChanges,
            });
        }
    });
    return changes;
}

/**
 * Displays detected team changes and logs them.
 */
function logTeamsChanges(oldTeamsInfo, newTeamsInfo, pokeApiInstance) {
    if (!oldTeamsInfo || !newTeamsInfo) return false;

    const changesPlayer = getTeamChanges(oldTeamsInfo.playerTeam, newTeamsInfo.playerTeam);
    const changesOpponent = getTeamChanges(
        oldTeamsInfo.opponentTeam,
        newTeamsInfo.opponentTeam
    );

    if (changesPlayer.length === 0 && changesOpponent.length === 0) return false;

    let changesDetected = false;
    if (changesPlayer.length > 0 || changesOpponent.length > 0) {
        logger.sectionHeader('Battle Updates');
        changesDetected = true;
    }

    // Player 1
    changesPlayer.forEach((change) => {
        const name = pokeApiInstance.getPokemonName(change.id);

        if (change.newHP === 0 && change.oldHP > 0) {
            console.log(chalk.bgRed.white(' KO '));
            logger.pokemon(1, `${chalk.bold.white(name)} ${chalk.red.bold('fainted!')} 💀`);
            logsHistory.push(`[Player 1] ${name} just got knocked out!`);

            // statsTracker.logEvent(currentBattleId, `${name} fainted!`, 1);
        } else if (change.oldHP > change.newHP) {
            const damage = change.oldHP - change.newHP;
            const hpPercentage = Math.round((change.newHP / change.oldHP) * 100);
            const hpColor =
                hpPercentage > 50
                    ? chalk.green.bold
                    : hpPercentage > 25
                        ? chalk.yellow.bold
                        : chalk.red.bold;

            console.log(chalk.bgRed.white(' DAMAGE '));
            logger.pokemon(
                1,
                `${chalk.bold.white(name)} lost ${chalk.red.bold(
                    damage + ' HP'
                )} (${hpColor(change.newHP + ' HP')} remaining)`
            );

            // statsTracker.logEvent(
            //     currentBattleId,
            //     `${name} lost ${damage} HP (${change.newHP}/${change.oldHP} HP remaining)`,
            //     1
            // );

            if (change.oldStatus !== change.newStatus && change.newStatus !== 0) {
                const statusText = pokeApiInstance.getStatusText(change.newStatus);
                logger.pokemon(
                    1,
                    `${chalk.bold.white(name)} is now ${chalk.yellow.bold(statusText)}!`
                );

                // statsTracker.logEvent(
                //     currentBattleId,
                //     `${name} is now affected by ${statusText}`,
                //     1
                // );
            }
            logsHistory.push(
                `[Player 1] Change for ${name}: HP ${change.oldHP} -> ${change.newHP}, Status: ${change.oldStatus} -> ${change.newStatus}`
            );
        } else if (change.oldStatus !== change.newStatus) {
            const statusText = pokeApiInstance.getStatusText(change.newStatus);
            const statusChanged =
                change.newStatus === 0
                    ? `${chalk.green.bold('recovered')} from ${pokeApiInstance.getStatusText(
                        change.oldStatus
                    )}`
                    : `is now ${chalk.yellow.bold(statusText)}!`;

            console.log(chalk.bgYellow.black(' STATUS '));
            logger.pokemon(1, `${chalk.bold.white(name)} ${statusChanged}`);
            logsHistory.push(
                `[Player 1] Change for ${name}: Status: ${change.oldStatus} -> ${change.newStatus}`
            );

            // if (change.newStatus === 0) {
            //     statsTracker.logEvent(
            //         currentBattleId,
            //         `${name} recovered from ${pokeApiInstance.getStatusText(change.oldStatus)}`,
            //         1
            //     );
            // } else {
            //     statsTracker.logEvent(
            //         currentBattleId,
            //         `${name} is now affected by ${statusText}`,
            //         1
            //     );
            // }
        }

        if (change.ppChanges && change.ppChanges.length > 0) {
            change.ppChanges.forEach((ppChange) => {
                const moveName = pokeApiInstance.getMoveName(ppChange.moveId);
                logger.pokemon(
                    1,
                    `${chalk.bold.white(name)} used ${chalk.cyan.bold(moveName)} (${ppChange.newPP} PP remaining)`
                );
                logsHistory.push(
                    `[Player 1] ${name} - ${moveName}: PP ${ppChange.oldPP} -> ${ppChange.newPP}`
                );

                // if (ppChange.oldPP > ppChange.newPP) {
                //     statsTracker.logEvent(
                //         currentBattleId,
                //         `${name} used ${moveName} (${ppChange.newPP}/${ppChange.oldPP} PP remaining)`,
                //         1
                //     );
                // }
            });
        }
    });

    // Player 2
    changesOpponent.forEach((change) => {
        const name = pokeApiInstance.getPokemonName(change.id);

        if (change.newHP === 0 && change.oldHP > 0) {
            console.log(chalk.bgRed.white(' KO '));
            logger.pokemon(2, `${chalk.bold.white(name)} ${chalk.red.bold('fainted!')} 💀`);
            logsHistory.push(`[Player 2] ${name} just got knocked out!`);

            // statsTracker.logEvent(currentBattleId, `${name} fainted!`, 2);
        } else if (change.oldHP > change.newHP) {
            const damage = change.oldHP - change.newHP;
            const hpPercentage = Math.round((change.newHP / change.oldHP) * 100);
            const hpColor =
                hpPercentage > 50
                    ? chalk.green.bold
                    : hpPercentage > 25
                        ? chalk.yellow.bold
                        : chalk.red.bold;

            console.log(chalk.bgRed.white(' DAMAGE '));
            logger.pokemon(
                2,
                `${chalk.bold.white(name)} lost ${chalk.red.bold(
                    damage + ' HP'
                )} (${hpColor(change.newHP + ' HP')} remaining)`
            );

            // statsTracker.logEvent(
            //     currentBattleId,
            //     `${name} lost ${damage} HP (${change.newHP}/${change.oldHP} HP remaining)`,
            //     2
            // );

            if (change.oldStatus !== change.newStatus && change.newStatus !== 0) {
                const statusText = pokeApiInstance.getStatusText(change.newStatus);
                logger.pokemon(
                    2,
                    `${chalk.bold.white(name)} is now ${chalk.yellow.bold(statusText)}!`
                );

                // statsTracker.logEvent(
                //     currentBattleId,
                //     `${name} is now affected by ${statusText}`,
                //     2
                // );
            }
            logsHistory.push(
                `[Player 2] Change for ${name}: HP ${change.oldHP} -> ${change.newHP}, Status: ${change.oldStatus} -> ${change.newStatus}`
            );
        } else if (change.oldStatus !== change.newStatus) {
            const statusText = pokeApiInstance.getStatusText(change.newStatus);
            const statusChanged =
                change.newStatus === 0
                    ? `${chalk.green.bold('recovered')} from ${pokeApiInstance.getStatusText(
                        change.oldStatus
                    )}`
                    : `is now ${chalk.yellow.bold(statusText)}!`;

            console.log(chalk.bgYellow.black(' STATUS '));
            logger.pokemon(2, `${chalk.bold.white(name)} ${statusChanged}`);
            logsHistory.push(
                `[Player 2] Change for ${name}: Status: ${change.oldStatus} -> ${change.newStatus}`
            );

            // if (change.newStatus === 0) {
            //     statsTracker.logEvent(
            //         currentBattleId,
            //         `${name} recovered from ${pokeApiInstance.getStatusText(change.oldStatus)}`,
            //         2
            //     );
            // } else {
            //     statsTracker.logEvent(
            //         currentBattleId,
            //         `${name} is now affected by ${statusText}`,
            //         2
            //     );
            // }
        }

        if (change.ppChanges && change.ppChanges.length > 0) {
            change.ppChanges.forEach((ppChange) => {
                const moveName = pokeApiInstance.getMoveName(ppChange.moveId);
                logger.pokemon(
                    2,
                    `${chalk.bold.white(name)} used ${chalk.cyan.bold(moveName)} (${ppChange.newPP} PP remaining)`
                );
                logsHistory.push(
                    `[Player 2] ${name} - ${moveName}: PP ${ppChange.oldPP} -> ${ppChange.newPP}`
                );

                // if (ppChange.oldPP > ppChange.newPP) {
                //     statsTracker.logEvent(
                //         currentBattleId,
                //         `${name} used ${moveName} (${ppChange.newPP}/${ppChange.oldPP} PP remaining)`,
                //         2
                //     );
                // }
            });
        }
    });

    if (changesDetected) {
        logger.divider();
    }

    return changesDetected;
}

/**
 * Sets player nicknames (up to 11 characters) for in-game display.
 */
async function setPlayerNicknames() {
    console.log('\n🏷️ Setting player nicknames...');

    const player1Model = getPlayerDisplayModelName(1, 'shortName');
    const player2Model = getPlayerDisplayModelName(2, 'shortName');

    function formatTitle(title) {
        let titleFormatted = title.split('/')[1] ? title.split('/')[1].trim() : title;
        titleFormatted = titleFormatted.replace(/-/g, '.');
        return titleFormatted;
    }
    const p1ModelName = formatTitle(player1Model);
    const p2ModelName = formatTitle(player2Model);

    const player1Nickname = p1ModelName.substring(0, 11).toUpperCase();
    const player2Nickname = p2ModelName.substring(0, 11).toUpperCase();

    await gameClient.setNickname(1, player1Nickname);
    console.log(`Player 1 nickname set to: ${player1Nickname}`);

    await gameClient.setNickname(2, player2Nickname);
    console.log(`Player 2 nickname set to: ${player2Nickname}`);
}

/*******************************************************************
 *              TEXT COLLECTION LOGIC (BATTLES)
 *******************************************************************/

/**
 * Checks if a player needs to switch Pokemon by combining checkNeedChange and HP verification.
 * @returns {Promise<{p1_need_change: boolean, p2_need_change: boolean}>}
 */
async function checkNeedChangeWithHP() {
    // Get checkNeedChange results
    const { p1_need_change, p1_need_change_status, p2_need_change, p2_need_change_status } = await gameClient.checkNeedChange();

    const newTeamsInfo = await getTeamsData();


    // Check if playerTeam or opponentTeam are empty, if so we don't save the teams info (Can happen in case of a menu or anything)
    if (newTeamsInfo.playerTeam.length === 0 || newTeamsInfo.opponentTeam.length === 0) {
        return {
            p1_need_change: false,
            p2_need_change: false
        };
    }

    logTeamsChanges(lastTeamsInfo, newTeamsInfo, pokeApi);
    lastTeamsInfo = JSON.parse(JSON.stringify(newTeamsInfo));
    activePlayerPokemon = newTeamsInfo.p1ActivePokemonId;
    activeOpponentPokemon = newTeamsInfo.p2ActivePokemonId;

    if (global.clientData) {
        global.clientData.player1Data.activePokemon = newTeamsInfo.p1ActivePokemonId;
        global.clientData.player2Data.activePokemon = newTeamsInfo.p2ActivePokemonId;
        global.clientData.player1Data.team = newTeamsInfo.playerTeam;
        global.clientData.player2Data.team = newTeamsInfo.opponentTeam;
    }

    // Find active Pokemon to check their HP
    const activeP1Pokemon = lastTeamsInfo.playerTeam.find(
        (p) => p.id === activePlayerPokemon
    ) || lastTeamsInfo.playerTeam[0];

    const activeP2Pokemon = lastTeamsInfo.opponentTeam.find(
        (p) => p.id === activeOpponentPokemon
    ) || lastTeamsInfo.opponentTeam[0];

    // Check if Player 1's active Pokemon has 0 HP and if they have at least one other Pokemon with HP > 0
    let p1NeedChange = false;
    if (p1_need_change && activeP1Pokemon.currentHP === 0) {
        const hasAlivePokemon = lastTeamsInfo.playerTeam.some(p => p.id !== activePlayerPokemon && p.currentHP > 0);
        p1NeedChange = hasAlivePokemon;
    }

    // Same logic for Player 2
    let p2NeedChange = false;
    if (p2_need_change && activeP2Pokemon.currentHP === 0) {
        const hasAlivePokemon = lastTeamsInfo.opponentTeam.some(p => p.id !== activeOpponentPokemon && p.currentHP > 0);
        p2NeedChange = hasAlivePokemon;
    }

    return {
        p1_need_change: p1NeedChange || p1_need_change_status === 5,
        p2_need_change: p2NeedChange || p2_need_change_status === 5
    };
}

/**
 * Starts text collection, waits for the next "turn state" (where a player
 * can attack or must switch), then stops collection.
 */
async function waitForTurn() {
    let currentWindow = await gameClient.currentWindow();
    if (currentWindow.window === 64) {
        return;
    }
    // logger.info('Starting text collection for this turn...');

    let textCollected = null;
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    let loadingInterval = setInterval(() => {
        process.stdout.write(
            `\r${chalk.yellow(frames[i++ % frames.length])} Waiting for next turn...`
        );
    }, 80);

    try {
        while (true) {
            currentWindow = await gameClient.currentWindow();
            if (currentWindow.window === 64) {
                clearInterval(loadingInterval);
                process.stdout.write('\r');
                // logger.info('Turn ready! Ending text collection...');
                textCollected = await gameClient.getAllText();
                return;
            }


            const { p1_need_change: p1MustChange, p2_need_change: p2MustChange } = await checkNeedChangeWithHP();

            if (p1MustChange || p2MustChange) {
                clearInterval(loadingInterval);
                process.stdout.write('\r');

                if (p1MustChange) {
                    // Mark P1 as ready since we're performing an action
                    p1TurnReady = true;
                }
                if (p2MustChange) {
                    // Mark P2 as ready since we're performing an action
                    p2TurnReady = true;
                }

                if (p1MustChange) logger.pokemon(1, chalk.yellow('Must select a new Pokémon!'));
                if (p2MustChange) logger.pokemon(2, chalk.yellow('Must select a new Pokémon!'));

                // logger.info('Turn ready! Ending text collection...');
                textCollected = await gameClient.getAllText();

                if (textCollected && textCollected.textData) {
                    lastBattleHistory = textCollected.textData;
                } else {
                    logger.warning('No text collected or invalid format');
                }

                const newTeamsInfo = await getTeamsData();
                logTeamsChanges(lastTeamsInfo, newTeamsInfo, pokeApi);
                lastTeamsInfo = JSON.parse(JSON.stringify(newTeamsInfo));

                if (global.clientData) {
                    global.clientData.player1Data.activePokemon = newTeamsInfo.p1ActivePokemonId;
                    global.clientData.player2Data.activePokemon = newTeamsInfo.p2ActivePokemonId;
                    global.clientData.player1Data.team = newTeamsInfo.playerTeam;
                    global.clientData.player2Data.team = newTeamsInfo.opponentTeam;
                }
                if (
                    newTeamsInfo.p1ActivePokemonId &&
                    newTeamsInfo.p1ActivePokemonId !== activePlayerPokemon
                ) {
                    activePlayerPokemon = newTeamsInfo.p1ActivePokemonId;
                    logger.pokemon(
                        1,
                        `Active Pokémon changed to: ${chalk.bold(
                            pokeApi.getPokemonName(activePlayerPokemon)
                        )}`
                    );
                }
                if (
                    newTeamsInfo.p2ActivePokemonId &&
                    newTeamsInfo.p2ActivePokemonId !== activeOpponentPokemon
                ) {
                    activeOpponentPokemon = newTeamsInfo.p2ActivePokemonId;
                    logger.pokemon(
                        2,
                        `Active Pokémon changed to: ${chalk.bold(
                            pokeApi.getPokemonName(activeOpponentPokemon)
                        )}`
                    );
                }
                await wait(2000);
                await handleForcedSwitch(p1MustChange, p2MustChange);

                i = 0;
                loadingInterval = setInterval(() => {
                    process.stdout.write(
                        `\r${chalk.yellow(frames[i++ % frames.length])} Waiting after Pokémon change...`
                    );
                }, 80);

                await wait(5000);
            }

            const { p1_bad_move, p2_bad_move } = await gameClient.checkBadMoves();

            if (p1_bad_move || p2_bad_move) {
                clearInterval(loadingInterval);
                process.stdout.write('\r');

                if (p1_bad_move) {
                    // Mark P1 as ready since we're performing an action
                    p1TurnReady = true;
                }
                if (p2_bad_move) {
                    // Mark P2 as ready since we're performing an action
                    p2TurnReady = true;
                }

                if (p1_bad_move) logger.warning('The player 1 did a not allowed move! (Example: Switching Pokémon while being trapped, etc ...)');
                if (p2_bad_move) logger.warning('The player 2 did a not allowed move! (Example: Switching Pokémon while being trapped, etc ...)');


                // Handle bad moves directly
                if (p1_bad_move) {
                    logger.sectionHeader(`Player 1 made a bad move`);
                    // statsTracker.logEvent(currentBattleId, `Made a bad move`, 1);
                    await decideNextMoveForPlayer(1, false, true);
                }

                if (p2_bad_move) {
                    logger.sectionHeader(`Player 2 made a bad move`);
                    // statsTracker.logEvent(currentBattleId, `Made a bad move`, 2);
                    await decideNextMoveForPlayer(2, false, true);
                }

                i = 0;
                loadingInterval = setInterval(() => {
                    process.stdout.write(
                        `\r${chalk.yellow(frames[i++ % frames.length])} Waiting after bad move handling...`
                    );
                }, 80);

                await wait(5000);
            }

            const { p1_can_attack: p1CanAttack, p2_can_attack: p2CanAttack } = await gameClient.checkCanAttack();
            // const { p1CanAttack, p2CanAttack } = await checkPlayersCanAttack(screenshotPath);

            // Check if players are already ready. For example if P1 used a move like "Fly", next turn they'll automatically be ready to attack. (Two-turn move)
            // const { p1Ready, p2Ready } = await checkReady(screenshotPath);

            // if (p1Ready) {
            //     p1TurnReady = true;
            // }
            // if (p2Ready) {
            //     p2TurnReady = true;
            // }

            if (p1CanAttack || p2CanAttack) {
                clearInterval(loadingInterval);
                process.stdout.write('\r');

                if (p1CanAttack) {
                    // Mark P1 as ready since we're performing an action
                    p1TurnReady = true;
                }
                if (p2CanAttack) {
                    // Mark P2 as ready since we're performing an action
                    p2TurnReady = true;
                }


                // logger.info('Turn ready! Ending text collection...');
                textCollected = await gameClient.getAllText();

                if (textCollected && textCollected.textData) {
                    lastBattleHistory = textCollected.textData;
                } else {
                    logger.warning('No text collected or invalid format');
                }

                logger.info('Checking for team changes...');
                const newTeamsInfo = await getTeamsData();

                if (global.clientData) {
                    global.clientData.player1Data.activePokemon = newTeamsInfo.p1ActivePokemonId;
                    global.clientData.player2Data.activePokemon = newTeamsInfo.p2ActivePokemonId;
                    global.clientData.player1Data.team = newTeamsInfo.playerTeam;
                    global.clientData.player2Data.team = newTeamsInfo.opponentTeam;
                }
                if (
                    newTeamsInfo.p1ActivePokemonId &&
                    newTeamsInfo.p1ActivePokemonId !== activePlayerPokemon
                ) {
                    activePlayerPokemon = newTeamsInfo.p1ActivePokemonId;
                    logger.pokemon(
                        1,
                        `Active Pokémon changed to: ${chalk.bold(
                            pokeApi.getPokemonName(activePlayerPokemon)
                        )}`
                    );
                }
                if (
                    newTeamsInfo.p2ActivePokemonId &&
                    newTeamsInfo.p2ActivePokemonId !== activeOpponentPokemon
                ) {
                    activeOpponentPokemon = newTeamsInfo.p2ActivePokemonId;
                    logger.pokemon(
                        2,
                        `Active Pokémon changed to: ${chalk.bold(
                            pokeApi.getPokemonName(activeOpponentPokemon)
                        )}`
                    );
                }

                logTeamsChanges(lastTeamsInfo, newTeamsInfo, pokeApi);
                lastTeamsInfo = JSON.parse(JSON.stringify(newTeamsInfo));
                canAttack = true;
                logger.success('Turn preparation complete');
                return;
            }


            await wait(5000);
        }
    } catch (error) {
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        logger.error('Error while waiting for turn:', error);
        throw error;
    }
}

/**
 * Handles the case where a player (or both) must switch Pokemon.
 */
async function handleForcedSwitch(p1MustChange, p2MustChange) {
    const activeP1Pokemon = lastTeamsInfo.playerTeam.find(
        (p) => p.id === activePlayerPokemon
    ) || lastTeamsInfo.playerTeam[0];
    const activeP2Pokemon = lastTeamsInfo.opponentTeam.find(
        (p) => p.id === activeOpponentPokemon
    ) || lastTeamsInfo.opponentTeam[0];

    if (p1MustChange) {
        logger.sectionHeader(`Player 1 must switch Pokémon`);
        if (global.clientData) {
            global.clientData.player1Data.isThinking = true;
        }
        const chooseNextAttackP1 = await global.chooseNextAttack(
            global.modelPlayer1,
            global.modelPlayer2,
            activeP1Pokemon,
            lastTeamsInfo.playerTeam,
            activeP2Pokemon,
            1,
            true,
            lastBattleHistory,
            chatMessagesPlayer2,
            false,
            lastTeamsInfo.opponentTeam,
            false,
            global.modelPlayer1ReasoningEffort
        );
        logger.analysis(1, chooseNextAttackP1.analysis);
        logger.strategy(1, chooseNextAttackP1.battle_strategy);
        logger.chat(1, chooseNextAttackP1.chat_message);
        chatMessagesPlayer1.push(chooseNextAttackP1.chat_message);

        const clientChoice = { ...chooseNextAttackP1 };
        if (global.clientData) {
            if (chooseNextAttackP1.type === 'attack') {
                const attackIndex = parseInt(chooseNextAttackP1.value) - 1;
                const activeMove = activeP1Pokemon.moves[attackIndex];
                if (activeMove) {
                    clientChoice.humanReadable = `${activeMove.name}`;
                    clientChoice.moveData = activeMove;
                }
            } else if (chooseNextAttackP1.type === 'switch_pokemon') {
                const switchIndex = parseInt(chooseNextAttackP1.value) - 1;
                if (lastTeamsInfo.playerTeam[switchIndex]) {
                    clientChoice.humanReadable = `${lastTeamsInfo.playerTeam[switchIndex].name}`;
                    clientChoice.pokemonData = lastTeamsInfo.playerTeam[switchIndex];
                    clientChoice.oldPokemonData = activeP1Pokemon;
                }
            }

            global.clientData.player1Data.history.push(clientChoice);
        }
        if (global.clientData) {
            global.clientData.player1Data.isThinking = false;
        }

        statsTracker.recordDecision(
            currentBattleId,
            1,
            clientChoice || chooseNextAttackP1,
            battleHistory.currentTurn
        );

        if (chooseNextAttackP1.type === 'switch_pokemon') {
            logger.decision(
                1,
                `Switching to Pokémon ${chalk.bold.cyan('#' + chooseNextAttackP1.value)}`
            );
            const commandsChangeP1 = gameClient.changePokemon(
                parseInt(chooseNextAttackP1.value)
            );

            const switchIndex = parseInt(chooseNextAttackP1.value) - 1;
            if (lastTeamsInfo.playerTeam[switchIndex]) {
                const pokemonName = pokeApi.getPokemonName(
                    lastTeamsInfo.playerTeam[switchIndex].id
                );
            }

            await gameClient.sendCommandsSequentially(commandsChangeP1, 1, 1);
        }
        logger.divider();
    }

    if (p2MustChange) {
        logger.sectionHeader(`Player 2 must switch Pokémon`);
        if (global.clientData) {
            global.clientData.player2Data.isThinking = true;
        }
        const chooseNextAttackP2 = await global.chooseNextAttack(
            global.modelPlayer2,
            global.modelPlayer1,
            activeP2Pokemon,
            lastTeamsInfo.opponentTeam,
            activeP1Pokemon,
            2,
            true,
            lastBattleHistory,
            chatMessagesPlayer1,
            false,
            lastTeamsInfo.playerTeam,
            false,
            global.modelPlayer2ReasoningEffort
        );
        if (global.clientData) {
            global.clientData.player2Data.isThinking = false;
        }
        logger.analysis(2, chooseNextAttackP2.analysis);
        logger.strategy(2, chooseNextAttackP2.battle_strategy);
        logger.chat(2, chooseNextAttackP2.chat_message);
        chatMessagesPlayer2.push(chooseNextAttackP2.chat_message);

        const clientChoice = { ...chooseNextAttackP2 };
        if (global.clientData) {
            if (chooseNextAttackP2.type === 'attack') {
                const attackIndex = parseInt(chooseNextAttackP2.value) - 1;
                const activeMove = activeP2Pokemon.moves[attackIndex];
                if (activeMove) {
                    clientChoice.humanReadable = `${activeMove.name}`;
                    clientChoice.moveData = activeMove;
                }
            } else if (chooseNextAttackP2.type === 'switch_pokemon') {
                const switchIndex = parseInt(chooseNextAttackP2.value) - 1;
                if (lastTeamsInfo.opponentTeam[switchIndex]) {
                    clientChoice.humanReadable = `${lastTeamsInfo.opponentTeam[switchIndex].name}`;
                    clientChoice.pokemonData = lastTeamsInfo.opponentTeam[switchIndex];
                    clientChoice.oldPokemonData = activeP2Pokemon;
                }
            }

            global.clientData.player2Data.history.push(clientChoice);

            statsTracker.recordDecision(
                currentBattleId,
                2,
                clientChoice || chooseNextAttackP2,
                battleHistory.currentTurn
            );
        } else {
            statsTracker.recordDecision(
                currentBattleId,
                2,
                chooseNextAttackP2,
                battleHistory.currentTurn
            );
        }

        if (chooseNextAttackP2.type === 'switch_pokemon') {
            logger.decision(
                2,
                `Switching to Pokémon ${chalk.bold.cyan('#' + chooseNextAttackP2.value)}`
            );
            const commandsChangeP2 = gameClient.changePokemon(
                parseInt(chooseNextAttackP2.value)
            );

            const switchIndex = parseInt(chooseNextAttackP2.value) - 1;
            if (lastTeamsInfo.opponentTeam[switchIndex]) {
                const pokemonName = pokeApi.getPokemonName(
                    lastTeamsInfo.opponentTeam[switchIndex].id
                );
            }

            await gameClient.sendCommandsSequentially(commandsChangeP2, 2, 1);
        }
        logger.divider();
    }
}

/*******************************************************************
 *                      BATTLE LOOP LOGIC
 *******************************************************************/

/**
 * Sub-function to decide the next action for a player.
 */
async function decideNextMoveForPlayer(playerNumber, isAlreadyReady = false, badMove = false) {
    const modelName = playerNumber === 1 ? global.modelPlayer1 : global.modelPlayer2;
    const opponentModelName = playerNumber === 1 ? global.modelPlayer2 : global.modelPlayer1;
    const reasoningEffort = playerNumber === 1 ? global.modelPlayer1ReasoningEffort : global.modelPlayer2ReasoningEffort;
    const displayModelName = getPlayerDisplayModelName(playerNumber, 'name');

    let activePokemonId, team, opponentTeam;
    if (playerNumber === 1) {
        activePokemonId = activePlayerPokemon;
        team = lastTeamsInfo.playerTeam;
        opponentTeam = lastTeamsInfo.opponentTeam;
    } else {
        activePokemonId = activeOpponentPokemon;
        team = lastTeamsInfo.opponentTeam;
        opponentTeam = lastTeamsInfo.playerTeam;
    }

    const activePokemon = team.find((p) => p.id === activePokemonId) || team[0];

    const activeOpponent =
        opponentTeam.find(
            (p) =>
                p.id ===
                (playerNumber === 1 ? activeOpponentPokemon : activePlayerPokemon)
        ) || opponentTeam[0];

    let formattedOpponent = await formatPokemonDetails(activeOpponent, pokeApi, {}, false);
    formattedOpponent = formattedOpponent.split('\n').join('\n');

    const thinkingFrames = ['🤔 ', '🧠 ', '💭 ', '🔍 '];
    let t = 0;
    const thinkingInterval = setInterval(() => {
        const colorFn = playerNumber === 1 ? chalk.blue : chalk.red;
        process.stdout.write(
            `\r${colorFn(thinkingFrames[t++ % thinkingFrames.length])} Player ${playerNumber} (${displayModelName}) is thinking...`
        );
    }, 200);

    if (global.clientData) {
        if (playerNumber === 1) {
            global.clientData.player1Data.isThinking = true;
        } else {
            global.clientData.player2Data.isThinking = true;
        }
    }
    const choice = await global.chooseNextAttack(
        modelName,
        opponentModelName,
        activePokemon,
        team,
        activeOpponent,
        playerNumber,
        false,
        lastBattleHistory,
        (playerNumber === 1 ? chatMessagesPlayer2 : chatMessagesPlayer1),
        isAlreadyReady,
        (playerNumber === 1 ? lastTeamsInfo.opponentTeam : lastTeamsInfo.playerTeam),
        badMove,
        reasoningEffort
    );

    // Create a copy of choice for the client
    const clientChoice = { ...choice };
    if (global.clientData) {
        if (playerNumber === 1) {
            global.clientData.player1Data.isThinking = false;
        } else {
            global.clientData.player2Data.isThinking = false;
        }
    }
    clearInterval(thinkingInterval);
    process.stdout.write('\r');

    logger.analysis(playerNumber, choice.analysis);
    logger.strategy(playerNumber, choice.battle_strategy);
    logger.chat(playerNumber, choice.chat_message);
    if (playerNumber === 1) {
        if (global.clientData) {
            // Add human-readable action for client history
            if (choice.type === 'attack') {
                const attackIndex = parseInt(choice.value) - 1;
                const activeMove = activePokemon.moves[attackIndex];
                if (activeMove) {
                    clientChoice.humanReadable = `${activeMove.name}`;
                    clientChoice.moveData = activeMove;
                }
            } else if (choice.type === 'switch_pokemon') {
                const switchIndex = parseInt(choice.value) - 1;
                if (team[switchIndex]) {
                    clientChoice.humanReadable = `${team[switchIndex].name}`;
                    clientChoice.pokemonData = team[switchIndex];
                    clientChoice.oldPokemonData = activePokemon;
                }
            }

            global.clientData.player1Data.history.push(clientChoice);

            statsTracker.recordDecision(
                currentBattleId,
                playerNumber,
                clientChoice,
                battleHistory.currentTurn
            );
        } else {
            statsTracker.recordDecision(
                currentBattleId,
                playerNumber,
                choice,
                battleHistory.currentTurn
            );
        }
        chatMessagesPlayer1.push(choice.chat_message);
    } else {
        if (global.clientData) {
            // Add human-readable action for client history
            if (choice.type === 'attack') {
                const attackIndex = parseInt(choice.value) - 1;
                const activeMove = activePokemon.moves[attackIndex];
                if (activeMove) {
                    clientChoice.humanReadable = `${activeMove.name}`;
                    clientChoice.moveData = activeMove;
                }
            } else if (choice.type === 'switch_pokemon') {
                const switchIndex = parseInt(choice.value) - 1;
                if (team[switchIndex]) {
                    clientChoice.humanReadable = `${team[switchIndex].name}`;
                    clientChoice.pokemonData = team[switchIndex];
                    clientChoice.oldPokemonData = activePokemon;
                }
            }

            global.clientData.player2Data.history.push(clientChoice);

            statsTracker.recordDecision(
                currentBattleId,
                playerNumber,
                clientChoice,
                battleHistory.currentTurn
            );
        } else {
            statsTracker.recordDecision(
                currentBattleId,
                playerNumber,
                choice,
                battleHistory.currentTurn
            );
        }
        chatMessagesPlayer2.push(choice.chat_message);
    }

    let commands = [];

    if (badMove) {
        commands = [...commands, ...['B', 'L']]
    }

    if (choice.type === 'attack') {
        logger.decision(playerNumber, `Use attack ${chalk.bold.cyan('#' + choice.value)}`);
        const attackIndex = parseInt(choice.value) - 1;
        const activeMove = activePokemon.moves[attackIndex];
        if (activeMove) {
            logger.moveAnimation(playerNumber, `Using ${chalk.cyan.bold(activeMove.name)}!`);
        }

        commands = [...commands, ...gameClient.selectAttack(parseInt(choice.value))];
    } else if (choice.type === 'switch_pokemon') {
        logger.decision(playerNumber, `Switch to Pokémon ${chalk.bold.cyan('#' + choice.value)}`);
        const switchIndex = parseInt(choice.value) - 1;
        if (team[switchIndex]) {
            logger.moveAnimation(playerNumber, `Switching to ${chalk.cyan.bold(team[switchIndex].name)}!`);
        }
        commands = [...commands, ...gameClient.changePokemon(parseInt(choice.value))];
    } else if (choice.type === 'ready') {
        logger.decision(playerNumber, `Ready for the next turn`);
        commands = [...commands]; // No commands needed for ready
    }

    return {
        playerNumber,
        commands,
        choice
    };
}


/**
 * Main battle loop.
 */
async function battleLoop() {
    let turnCounter = 0;

    while (true) {
        let currentWindow = await gameClient.currentWindow();
        if (currentWindow.window === 64) {
            logger.success('Battle over!');

            let player1HasAlivePokemon = false;
            let player2HasAlivePokemon = false;

            for (const pokemon of lastTeamsInfo.playerTeam) {
                if (pokemon.currentHP > 0) {
                    player1HasAlivePokemon = true;
                    break;
                }
            }

            for (const pokemon of lastTeamsInfo.opponentTeam) {
                if (pokemon.currentHP > 0) {
                    player2HasAlivePokemon = true;
                    break;
                }
            }

            let winner;
            if (player1HasAlivePokemon && !player2HasAlivePokemon) {
                winner = 1;
                global.battleScores.player1++;
                logger.battle(
                    `${chalk.blue.bold('Player 1')} (${getPlayerDisplayModelName(1, 'name')}) wins the battle!`
                );
            } else if (!player1HasAlivePokemon && player2HasAlivePokemon) {
                winner = 2;
                global.battleScores.player2++;
                logger.battle(
                    `${chalk.red.bold('Player 2')} (${getPlayerDisplayModelName(2, 'name')}) wins the battle!`
                );
            } else {
                const player1TotalHPPercentage = lastTeamsInfo.playerTeam.reduce(
                    (total, pokemon) => total + pokemon.currentHP / pokemon.maxHP,
                    0
                );
                const player2TotalHPPercentage = lastTeamsInfo.opponentTeam.reduce(
                    (total, pokemon) => total + pokemon.currentHP / pokemon.maxHP,
                    0
                );

                if (player1TotalHPPercentage > player2TotalHPPercentage) {
                    winner = 1;
                    global.battleScores.player1++;
                    logger.battle(
                        `${chalk.blue.bold('Player 1')} (${getPlayerDisplayModelName(1, 'name')}) wins by HP percentage!`
                    );
                } else {
                    winner = 2;
                    global.battleScores.player2++;
                    logger.battle(
                        `${chalk.red.bold('Player 2')} (${getPlayerDisplayModelName(2, 'name')}) wins by HP percentage!`
                    );
                }
            }

            const usedPokemonPlayer1 = lastTeamsInfo.playerTeam.map(
                (p) => ({
                    id: p.id,
                    name: p.name
                })
            );
            const usedPokemonPlayer2 = lastTeamsInfo.opponentTeam.map(
                (p) => ({
                    id: p.id,
                    name: p.name
                })
            );
            global.bannedPokemonList = [...global.bannedPokemonList, ...usedPokemonPlayer1, ...usedPokemonPlayer2];
            // Clean duplicate from the list
            global.bannedPokemonList = global.bannedPokemonList.filter(
                (p, index, self) =>
                    index === self.findIndex((t) => t.id === p.id)
            );
            console.log("New banned pokemon list:", global.bannedPokemonList);
            statsTracker.endBattle(currentBattleId, winner, lastTeamsInfo.playerTeam, lastTeamsInfo.opponentTeam);

            // Get and record team state at the beginning of the turn
            statsTracker.recordTeamStateAtTurn(currentBattleId, turnCounter + 1, lastTeamsInfo.playerTeam, lastTeamsInfo.opponentTeam);

            if (global.clientData) {
                const endGameData = await calculateHPEvolution(currentBattleId);
                global.clientData.endGameData.push(endGameData);
            }

            return;
        }

        if (!canAttack) {
            await waitForTurn();
            continue;
        }

        turnCounter++;
        battleHistory.currentTurn = turnCounter;

        logger.sectionHeader(`Battle Turn ${turnCounter}`);
        console.log(chalk.yellow.bold(`⚡ TURN ${turnCounter} BEGINS ⚡`));
        logger.divider();

        statsTracker.logEvent(currentBattleId, `Turn ${turnCounter} begins`, null);

        // Get and record team state at the beginning of the turn
        const teamsData = await getTeamsData();
        statsTracker.recordTeamStateAtTurn(currentBattleId, turnCounter, teamsData.playerTeam, teamsData.opponentTeam);

        await gameClient.cleanText();

        const { p1_can_attack: p1CanAttack, p2_can_attack: p2CanAttack } = await gameClient.checkCanAttack();

        // Execute both decisions in parallel and collect commands
        let playerCommands = [];
        const [player1Result, player2Result] = await Promise.all([
            p1CanAttack ? decideNextMoveForPlayer(1, !p1CanAttack) : Promise.resolve(null),
            p2CanAttack ? decideNextMoveForPlayer(2, !p2CanAttack) : Promise.resolve(null)
        ]);

        if (player1Result && player1Result.commands.length > 0) {
            playerCommands.push({
                playerNumber: 1,
                commands: player1Result.commands
            });
        }

        if (player2Result && player2Result.commands.length > 0) {
            playerCommands.push({
                playerNumber: 2,
                commands: player2Result.commands
            });
        }

        // Send commands sequentially after both players have decided
        for (const playerCommand of playerCommands) {
            console.log("Send commands for player", playerCommand.playerNumber, playerCommand.commands);
            await gameClient.sendCommandsSequentially(
                playerCommand.commands,
                playerCommand.playerNumber,
                1
            );
        }

        logger.divider();

        canAttack = false;
        logger.turnDivider();

        await wait(4000);
    }
}


/*******************************************************************
 *                MAIN WORKFLOW FUNCTIONS
 *******************************************************************/

/**
 * Preloads Pokedex data (Pokemon, moves, types).
 */
async function preloadData() {
    logger.sectionHeader('Preloading Data');

    const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    // Load Pokemon
    let pokemonLoaded = false;
    const pokemonLoadingInterval = setInterval(() => {
        if (pokemonLoaded) {
            clearInterval(pokemonLoadingInterval);
            process.stdout.write(`\r${chalk.green('✓')} Pokémon data loaded         \n`);
            return;
        }
        process.stdout.write(
            `\r${chalk.yellow(loadingFrames[i++ % loadingFrames.length])} Loading Pokémon data...`
        );
    }, 80);

    try {
        await pokeApi.fetchPokemonList();
        pokemonLoaded = true;
    } catch (error) {
        clearInterval(pokemonLoadingInterval);
        process.stdout.write('\r');
        logger.error('Failed to load Pokémon data:', error);
        throw error;
    }

    // Load Moves
    let movesLoaded = false;
    i = 0;
    const movesLoadingInterval = setInterval(() => {
        if (movesLoaded) {
            clearInterval(movesLoadingInterval);
            process.stdout.write(`\r${chalk.green('✓')} Moves data loaded         \n`);
            return;
        }
        process.stdout.write(
            `\r${chalk.yellow(loadingFrames[i++ % loadingFrames.length])} Loading moves data...`
        );
    }, 80);

    try {
        await pokeApi.fetchMovesList();
        movesLoaded = true;
    } catch (error) {
        clearInterval(movesLoadingInterval);
        process.stdout.write('\r');
        logger.error('Failed to load moves data:', error);
        throw error;
    }

    // Load Types
    let typesLoaded = false;
    i = 0;
    const typesLoadingInterval = setInterval(() => {
        if (typesLoaded) {
            clearInterval(typesLoadingInterval);
            process.stdout.write(`\r${chalk.green('✓')} Types data loaded         \n`);
            return;
        }
        process.stdout.write(
            `\r${chalk.yellow(loadingFrames[i++ % loadingFrames.length])} Loading types data...`
        );
    }, 80);

    try {
        await pokeApi.fetchTypesList();
        typesLoaded = true;
    } catch (error) {
        clearInterval(typesLoadingInterval);
        process.stdout.write('\r');
        logger.error('Failed to load types data:', error);
        throw error;
    }

    logger.success('All data loaded successfully!');
}

async function generatePokemonLists(bannedPokemonListPlayer1, bannedPokemonListPlayer2, baseBannedPokemonList) {
    logger.sectionHeader('Generating Teams');

    try {
        const player1BannedList = [
            ...bannedPokemonListPlayer2.pokemonIds,
            ...bannedPokemonListPlayer1.pokemonIds,
            ...baseBannedPokemonList
        ];
        const player2BannedList = [
            ...bannedPokemonListPlayer1.pokemonIds,
            ...bannedPokemonListPlayer2.pokemonIds,
            ...baseBannedPokemonList
        ];

        const generateTeamForPlayer = async (playerNumber, modelName, bannedList, reasoningEffort = null) => {
            const clientPlayerKey = playerNumber === 1 ? 'player1Data' : 'player2Data';
            if (global.clientData) {
                global.clientData[clientPlayerKey].isThinking = true;
            }

            try {
                const list = await global.generatePokemonList(modelName, bannedList, reasoningEffort);
                list.team.pokemonIds.sort((a, b) => a.id - b.id);
                return list;
            } catch (error) {
                logger.error(
                    `Failed to generate team for Player ${playerNumber} (${modelName}):`,
                    error
                );
                throw error;
            } finally {
                if (global.clientData) {
                    global.clientData[clientPlayerKey].isThinking = false;
                }
            }
        };

        const [pokemonListPlayer1, pokemonListPlayer2] = await Promise.all([
            generateTeamForPlayer(1, global.modelPlayer1, player1BannedList, global.modelPlayer1ReasoningEffort),
            generateTeamForPlayer(2, global.modelPlayer2, player2BannedList, global.modelPlayer2ReasoningEffort)
        ]);

        // Log results for Player 1
        if (pokemonListPlayer1.reasoning) {
            logger.analysis(1, pokemonListPlayer1.reasoning);
        }
        logger.pokemon(
            1,
            `Team generated: ${pokemonListPlayer1.team.pokemonIds
                .map((p) => chalk.bold.white(p.name))
                .join(', ')}`
        );

        logger.divider();

        // Log results for Player 2
        if (pokemonListPlayer2.reasoning) {
            logger.analysis(2, pokemonListPlayer2.reasoning);
        }
        logger.pokemon(
            2,
            `Team generated: ${pokemonListPlayer2.team.pokemonIds
                .map((p) => chalk.bold.white(p.name))
                .join(', ')}`
        );

        logger.divider();
        return { pokemonListPlayer1: pokemonListPlayer1.team.pokemonIds, pokemonListPlayer2: pokemonListPlayer2.team.pokemonIds };

    } catch (error) {
        throw error;
    }
}

/**
 * Handles the Pokemon selection in the game.
 */
async function selectEntriesInGame(pokemonListPlayer1, pokemonListPlayer2) {
    logger.sectionHeader('Selecting Pokémon In Game');

    await gameClient.changeTitle(getPlayerDisplayModelName(1, 'name'));
    logger.info('Sending Player 1 selection to game...');
    const commandsPlayer1 = gameClient.selectEntriesPokemon(
        pokemonListPlayer1.map((p) => p.id),
        1
    );

    await gameClient.sendCommandsSequentially(commandsPlayer1, 1, 1);
    logger.success('Player 1 Pokémon selected');

    await gameClient.changeTitle(getPlayerDisplayModelName(2, 'name'));

    logger.info('Sending Player 2 selection to game...');
    const commandsPlayer2 = gameClient.selectEntriesPokemon(
        pokemonListPlayer2.map((p) => p.id),
        2
    );
    await gameClient.sendCommandsSequentially(commandsPlayer2, 2, 1);
    logger.success('Player 2 Pokémon selected');
}

/**
 * Waits for the team selection window (window=8).
 */
async function waitForTeamSelection() {
    logger.sectionHeader('Waiting for Team Selection');

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let loadingInterval = setInterval(() => {
        process.stdout.write(
            `\r${chalk.yellow(frames[i++ % frames.length])} Waiting for team selection screen...`
        );
    }, 80);

    function formatTitleDescription(title) {
        let titleFormatted = title.split('/')[0] ? title.split('/')[0].trim() : title;
        titleFormatted = titleFormatted.replace(/-/g, ' ');
        titleFormatted = titleFormatted.toUpperCase();
        return titleFormatted.substring(0, 15);
    }
    let teamsInfo;
    try {
        while (true) {
            teamsInfo = await getTeamsData();
            if (teamsInfo.initialPlayerTeam.length > 0 && teamsInfo.initialOpponentTeam.length > 0) {
                console.log(teamsInfo);
                console.log("Teams found, waiting for game to stabilize...");
                await waitForWindow(8);


                await gameClient.changeFightDescription(`PokeBench - ${getPlayerDisplayModelName(1, 'shortName') || formatTitleDescription(global.modelPlayer1)} vs ${getPlayerDisplayModelName(2, 'shortName') || formatTitleDescription(global.modelPlayer2)} !`);
                break;
            }
            await wait(2000);
        }
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        logger.success('Team selection screen found!');

        statsTracker.recordTeamSelection(currentBattleId, 1, teamsInfo.initialPlayerTeam);
        statsTracker.recordTeamSelection(currentBattleId, 2, teamsInfo.initialOpponentTeam);

        logger.info('Waiting for game to stabilize...');
        // Change the fight description
        await waitInGame(1, 5);
        await setPlayerNicknames();
        logger.success('Ready for team selection');
    } catch (error) {
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        logger.error('Error while waiting for team selection:', error);
        throw error;
    }
}

/**
 * Retrieves and displays the initial teams.
 */
async function getAndDisplayInitialTeams() {
    logger.sectionHeader('Initial Teams Selection');
    const teamsInfo = await getTeamsData();
    logger.success('Teams data retrieved successfully');

    if (global.clientData) {
        global.clientData.player1Data.pokemonList = teamsInfo.initialPlayerTeam;
        global.clientData.player2Data.pokemonList = teamsInfo.initialOpponentTeam;
    }
    const formattedTeams = await formatInitialTeamsInfo(teamsInfo, pokeApi);

    logger.teamHeader(1, getPlayerDisplayModelName(1, 'name'));
    formattedTeams.initialPlayerTeam.slice(0, 6).forEach((p) => console.log(p));

    logger.teamHeader(2, getPlayerDisplayModelName(2, 'name'));
    formattedTeams.initialOpponentTeam.slice(0, 6).forEach((p) => console.log(p));

    return teamsInfo;
}

/**
 * Each AI chooses its final Pokemon.
 */
async function chooseAndSelectFinalTeams(teamsInfo) {
    logger.sectionHeader('Final Team Selection');

    // Set both players as thinking
    if (global.clientData) {
        global.clientData.player1Data.isThinking = true;
        global.clientData.player2Data.isThinking = true;
    }

    logger.info(`Player 1 (${getPlayerDisplayModelName(1, 'name')}) is choosing final team...`);
    logger.info(`Player 2 (${getPlayerDisplayModelName(2, 'name')}) is choosing final team...`);

    let finalTeamPlayer1, finalTeamPlayer2;

    // If both players are AI, run selections in parallel
    [finalTeamPlayer1, finalTeamPlayer2] = await Promise.all([
        global.chooseFinalTeam(
            global.modelPlayer1,
            teamsInfo.initialPlayerTeam,
            teamsInfo.initialOpponentTeam,
            global.modelPlayer1ReasoningEffort
        ).then(result => {
            if (global.clientData) {
                global.clientData.player1Data.isThinking = false;
            }
            return result;
        }),
        global.chooseFinalTeam(
            global.modelPlayer2,
            teamsInfo.initialOpponentTeam,
            teamsInfo.initialPlayerTeam,
            global.modelPlayer2ReasoningEffort
        ).then(result => {
            if (global.clientData) {
                global.clientData.player2Data.isThinking = false;
            }
            return result;
        })
    ]);

    // Handle Player 1 results
    if (finalTeamPlayer1.reasoning) {
        logger.analysis(1, finalTeamPlayer1.reasoning);
    }
    logger.pokemon(
        1,
        `Selected: ${finalTeamPlayer1.pokemonIds
            .map((p) => chalk.bold.white(p.name) + ' ' + chalk.italic.gray(p.reason))
            .join('\n          ')}`
    );

    // Handle Player 2 results
    if (finalTeamPlayer2.reasoning) {
        logger.analysis(2, finalTeamPlayer2.reasoning);
    }
    console.log(finalTeamPlayer2);
    logger.pokemon(
        2,
        `Selected: ${finalTeamPlayer2.pokemonIds
            .map((p) => chalk.bold.white(p.name) + ' ' + chalk.italic.gray(p.reason))
            .join('\n          ')}`
    );

    // Send commands to game client one after another (since these are physical inputs)
    logger.info('Sending Player 1 selection to game client...');
    const commandsPick3P1 = gameClient.select3Pokemons(finalTeamPlayer1.pokemonIds.map((p) => p.id));
    await gameClient.sendCommandsSequentially(commandsPick3P1, 1, 1);
    logger.success('Player 1 team selected');

    await setPlayerNicknames();
    logger.divider();

    logger.info('Sending Player 2 selection to game client...');
    const commandsPick3P2 = gameClient.select3Pokemons(finalTeamPlayer2.pokemonIds.map((p) => p.id));
    await gameClient.sendCommandsSequentially(commandsPick3P2, 2, 1);
    logger.success('Player 2 team selected');

    await setPlayerNicknames();
    logger.divider();
}

/**
 * Waits for the battle screen (window=0) then detects the battle screen.
 */
async function waitForBattleStart() {
    logger.sectionHeader('Waiting for Battle');
    await wait(10000);

    logger.info('Searching for battle screen...');
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const loadingInterval = setInterval(() => {
        process.stdout.write(
            `\r${chalk.yellow(frames[i++ % frames.length])} Waiting for battle to start...`
        );
    }, 80);

    try {
        while (true) {
            // const screenshot = await gameClient.screenshot();
            // const screenshotPath = screenshot.image_full_path;
            // if (!screenshotPath) {
            //     logger.warning('Failed to capture screenshot, retrying...');
            //     await wait(5000);
            //     continue;
            // }
            // const { p1CanAttack, p2CanAttack } = await checkPlayersCanAttack(screenshotPath);


            // Check the window
            const { p1_can_attack: p1CanAttack, p2_can_attack: p2CanAttack } = await gameClient.checkCanAttack();
            if (p1CanAttack && p2CanAttack) {
                clearInterval(loadingInterval);
                process.stdout.write('\r');
                logger.success('Battle screen detected! Battle is starting!');
                logger.divider();
                await wait(10000);
                break;
            }
            await wait(5000);
        }
    } catch (error) {
        clearInterval(loadingInterval);
        process.stdout.write('\r');
        logger.error('Error while waiting for battle:', error);
        throw error;
    }
}

/**
 * Initializes teams for the start of the battle.
 */
async function initializeBattleTeams() {
    logger.sectionHeader('Battle Teams Initialization');
    const teamsInfo = await getTeamsData();
    logger.success('Battle teams data retrieved');

    initialTeamsInfo = JSON.parse(JSON.stringify(teamsInfo));
    lastTeamsInfo = JSON.parse(JSON.stringify(teamsInfo));


    if (global.clientData) {
        global.clientData.player1Data.pokemonList = teamsInfo.playerTeam;
        global.clientData.player2Data.pokemonList = teamsInfo.opponentTeam;
        global.clientData.player1Data.activePokemon = teamsInfo.p1ActivePokemonId;
        global.clientData.player2Data.activePokemon = teamsInfo.p2ActivePokemonId;
        global.clientData.player1Data.team = teamsInfo.playerTeam;
        global.clientData.player2Data.team = teamsInfo.opponentTeam;
    }

    statsTracker.recordTeamSelection(currentBattleId, 1, teamsInfo.playerTeam, true);
    statsTracker.recordTeamSelection(currentBattleId, 2, teamsInfo.opponentTeam, true);

    const p1ActivePokemonId = teamsInfo.p1ActivePokemonId;
    const p2ActivePokemonId = teamsInfo.p2ActivePokemonId;

    const formattedTeams = await formatTeamsInfo(teamsInfo, pokeApi);

    logger.teamHeader(1, getPlayerDisplayModelName(1, 'name'));
    formattedTeams.playerTeam.forEach((p) => console.log(p));
    console.log(chalk.blue.bold('─────────────────────────────────────────'));

    logger.teamHeader(2, getPlayerDisplayModelName(2, 'name'));
    formattedTeams.opponentTeam.forEach((p) => console.log(p));
    console.log(chalk.red.bold('─────────────────────────────────────────'));

    if (teamsInfo.playerTeam && teamsInfo.playerTeam.length > 0) {
        activePlayerPokemon = p1ActivePokemonId;
        logger.pokemon(
            1,
            `Active Pokémon: ${chalk.bold.white(pokeApi.getPokemonName(activePlayerPokemon))}`
        );
    }
    if (teamsInfo.opponentTeam && teamsInfo.opponentTeam.length > 0) {
        activeOpponentPokemon = p2ActivePokemonId;
        logger.pokemon(
            2,
            `Active Pokémon: ${chalk.bold.white(pokeApi.getPokemonName(activeOpponentPokemon))}`
        );
    }

    logger.battle(chalk.bold('Battle initialization complete! Let the battle begin!'));
    logger.divider();
    console.log(chalk.bgMagenta.white.bold(' 🏆 BATTLE BEGINS 🏆 '));
    logger.divider();

    lastBattleHistory = [
        "The battle has begun!",
    ]
}

/**
 * Provides a function to update the currentBattleId from outside.
 */
function setCurrentBattleId(battleId) {
    currentBattleId = battleId;
}

/**
 * Resets all battle-related variables to prepare for a new battle.
 * This function must be called before starting each new battle.
 */
function resetBattleVariables() {
    initialTeamsInfo = null;
    lastTeamsInfo = null;
    logsHistory = [];
    canAttack = true;
    activePlayerPokemon = null;
    activeOpponentPokemon = null;

    battleHistory = {
        turns: [],
        texts: [],
        currentTurn: 0,
    };

    lastBattleHistory = null;

    chatMessagesPlayer1 = [];
    chatMessagesPlayer2 = [];

    logger.info('Battle variables have been reset');
}
/**
 * Calculates the HP evolution of teams across turns.
 * @param {number} battleId - Battle ID
 * @returns {Promise<Object>} HP evolution data for the frontend
 */
async function calculateHPEvolution(battleId) {
    const battle = statsTracker.battles.find((b) => b.id === battleId);
    if (!battle) return { hpEvolutionData: [] };

    // Get team data per turn
    const player1TeamStateByTurn = battle.player1.teamStateByTurn;
    const player2TeamStateByTurn = battle.player2.teamStateByTurn;

    const hpEvolutionData = [];

    // For each turn, calculate total HP percentage for each team
    for (let i = 0; i < player1TeamStateByTurn.length; i++) {
        const turn = player1TeamStateByTurn[i].turn;
        const player1TeamState = player1TeamStateByTurn[i].teamState;
        const player2TeamState = player2TeamStateByTurn[i].teamState;

        // Calculate total max and current HP for Player 1's team
        const player1TotalMaxHP = player1TeamState.reduce((sum, pokemon) => sum + pokemon.maxHP, 0);
        const player1TotalCurrentHP = player1TeamState.reduce((sum, pokemon) => sum + pokemon.currentHP, 0);
        const player1HPPercentage = Math.round((player1TotalCurrentHP / player1TotalMaxHP) * 100);

        // Calculate total max and current HP for Player 2's team
        const player2TotalMaxHP = player2TeamState.reduce((sum, pokemon) => sum + pokemon.maxHP, 0);
        const player2TotalCurrentHP = player2TeamState.reduce((sum, pokemon) => sum + pokemon.currentHP, 0);
        const player2HPPercentage = Math.round((player2TotalCurrentHP / player2TotalMaxHP) * 100);

        hpEvolutionData.push({
            turn,
            blueHP: player1HPPercentage,  // Player 1 = blue
            redHP: player2HPPercentage    // Player 2 = red
        });
    }

    // Prepare final team data with full details
    let player1FinalTeam = [];
    let player2FinalTeam = [];

    // Use final state data if available, otherwise use finalTeam
    if (battle.player1.finalTeamState) {
        player1FinalTeam = battle.player1.finalTeamState.map(pokemon => ({
            id: pokemon.id,
            name: pokemon.name,
            currentHP: pokemon.currentHP,
            maxHP: pokemon.maxHP,
            status: pokemon.status || null,
            types: pokemon.types || []
        }));
    } else if (battle.player1.finalTeam) {
        player1FinalTeam = battle.player1.finalTeam.map(pokemon => ({
            id: pokemon.id,
            name: pokemon.name
        }));
    }

    if (battle.player2.finalTeamState) {
        player2FinalTeam = battle.player2.finalTeamState.map(pokemon => ({
            id: pokemon.id,
            name: pokemon.name,
            currentHP: pokemon.currentHP,
            maxHP: pokemon.maxHP,
            status: pokemon.status || null,
            types: pokemon.types || []
        }));
    } else if (battle.player2.finalTeam) {
        player2FinalTeam = battle.player2.finalTeam.map(pokemon => ({
            id: pokemon.id,
            name: pokemon.name
        }));
    }

    // Prepare end-of-game data with custom messages
    const winner = battle.winner;
    const winnerModel = winner === 1 ? battle.player1.modelDisplayName : battle.player2.modelDisplayName;

    // Initialize battle results
    const battleResult = {
        winnerColor: winner === 1 ? 'blue' : 'red',
        blueMessage: '',
        redMessage: '',
        blueTeam: player1FinalTeam,
        redTeam: player2FinalTeam
    };

    // Add battle statistics
    const battleStats = {
        turns: battle.turns,
        duration: battle.duration, // in seconds
        battleFormat: battle.battleFormat,
        battleType: battle.battleType,
        timestamp: battle.timestamp,
        winner: winner,
        winnerModel: winnerModel,
        player1Model: battle.player1.model,
        player2Model: battle.player2.model,
        player1ModelDisplayName: battle.player1.modelDisplayName || battle.player1.model,
        player2ModelDisplayName: battle.player2.modelDisplayName || battle.player2.model,
        player1ModelStatKey: battle.player1.modelStatKey || battle.player1.model,
        player2ModelStatKey: battle.player2.modelStatKey || battle.player2.model
    };

    try {
        // Generate end-of-battle messages asynchronously
        const [player1Message, player2Message] = await Promise.all([
            // Player 1 message (blue)
            global.generateEndOfBattleMessage(
                battle.player1.model,
                battle.player2.model,
                1,
                winner === 1, // isWinner = true if Player 1 won
                {
                    battleFormat: battle.battleFormat,
                    battleType: battle.battleType,
                    turns: battle.turns,
                    duration: battle.duration
                },
                battle.player1.reasoningEffort
            ),
            // Player 2 message (red)
            global.generateEndOfBattleMessage(
                battle.player2.model,
                battle.player1.model,
                2,
                winner === 2, // isWinner = true if Player 2 won
                {
                    battleFormat: battle.battleFormat,
                    battleType: battle.battleType,
                    turns: battle.turns,
                    duration: battle.duration
                },
                battle.player2.reasoningEffort
            )
        ]);

        // Add messages to results
        battleResult.blueMessage = player1Message.chat_message;
        battleResult.redMessage = player2Message.chat_message;


    } catch (error) {
        console.error('Error generating end-of-battle messages:', error);

        // On error, use default messages
        battleResult.blueMessage = winner === 1 ? "Victory !" : "Defeat...";
        battleResult.redMessage = winner === 2 ? "Victory !" : "Defeat...";
    }


    // Data to return
    const resultData = {
        hpEvolutionData,
        battleResult,
        battleStats
    };

    return resultData;
}

/**
 * Export all necessary functions/utilities
 */
module.exports = {
    gameClient,
    pokeApi,
    preloadData,
    generatePokemonLists,
    selectEntriesInGame,
    waitForTeamSelection,
    getAndDisplayInitialTeams,
    chooseAndSelectFinalTeams,
    waitForBattleStart,
    initializeBattleTeams,
    battleLoop,
    waitForTurn,
    decideNextMoveForPlayer,
    formatPokemonDetails,
    setCurrentBattleId,
    resetBattleVariables,
    formatTeamsInfo,
    formatInitialTeamsInfo,
    calculateHPEvolution
};
