/************************************************
 * FILE: ai.js
 ************************************************/

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// AI libraries
const { generateObject, NoObjectGeneratedError } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { createOpenRouter } = require('@openrouter/ai-sdk-provider');
const { createDeepSeek } = require('@ai-sdk/deepseek');
const { jsonrepair } = require('jsonrepair');
const aiModels = require('./data/ai_models.json');
const { createMistral } = require('@ai-sdk/mistral');
const { sanitizeReasoningEffortForModel } = require('./modelUtils');


// AI client instantiation
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
const gemini = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY
});
const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
// Load prompts from files
const GENERATE_POKEMON_LIST_PROMPT = fs.readFileSync(
    './prompts/generate_pokemon_list.txt',
    'utf8'
);
const CHOOSE_FINAL_TEAM_PROMPT = fs.readFileSync(
    './prompts/choose_final_team.txt',
    'utf8'
);
const CHOOSE_ATTACK_PROMPT = fs.readFileSync(
    './prompts/choose_attack_enhanced.txt',
    // './prompts/choose_attack.txt',
    // './prompts/choose_attack_motivational.txt',
    'utf8'
);
const GENERATE_BANNED_POKEMON_LIST_PROMPT = fs.readFileSync(
    './prompts/generate_banned_pokemon_list.txt',
    'utf8'
);


let lastPlayer1UsedTokens = 0;
let lastPlayer2UsedTokens = 0;

/**
 * Resets all AI-related variables to prepare for a new battle.
 * This function must be called before starting each new battle.
 */
function resetAIVariables() {
    lastPlayer1UsedTokens = 0;
    lastPlayer2UsedTokens = 0;

    // Add any other AI-specific variables that need to be reset

    console.log('AI variables have been reset');
}


/**
 * Returns the number of Pokemon to use based on battle type.
 * @returns {number} 3 for 3vs3 battles, 6 for 6vs6 battles
 */
function getTeamSize() {
    return global.battleType === '3vs3' ? 3 : 6;
}


/**
 * Returns the correct AI client/model based on the name (e.g. "openai/gpt-3.5-turbo").
 */
function getModel(modelName, reasoningEffort = null) {
    let provider, model;
    if (modelName.includes('/')) {
        const firstSlashIndex = modelName.indexOf('/');
        provider = modelName.substring(0, firstSlashIndex);
        model = modelName.substring(firstSlashIndex + 1);
    } else {
        provider = 'openai';
        model = modelName;
    }

    const modelInfo = aiModels[modelName];
    const safeReasoningEffort = sanitizeReasoningEffortForModel(modelName, reasoningEffort);

    switch (provider) {
        case 'openai': {
            if (safeReasoningEffort) {
                return openai(model, {
                    reasoningEffort: safeReasoningEffort,
                });
            }
            return openai(model);
        }

        case 'gemini':
            if (safeReasoningEffort) {
                return gemini(model, {
                    thinkingConfig: {
                        thinkingLevel: safeReasoningEffort,
                        includeThoughts: true,
                      }
                });
            }
            return gemini(model, {
                structuredOutputs: modelInfo.structuredOutput || false,
            });
        case 'anthropic':
            if (safeReasoningEffort) {
                return anthropic(model, {
                    effort: safeReasoningEffort,
                });
            }
            return anthropic(model);
        case 'openrouter':
            return openrouter(model, {
                structuredOutputs: modelInfo.structuredOutput || false,
            });
        case 'deepseek':
            return deepseek(model);
        case 'mistral':
            return mistral(model);
        default:
            throw new Error(`Provider ${provider} not supported`);
    }
}

/**
 * Provider-specific options needed for AI SDK v6 migration.
 * In v5/v6, OpenAI strict schema control moved to providerOptions.
 */
function getProviderOptions(modelName) {
    let provider = 'openai';
    if (modelName.includes('/')) {
        provider = modelName.substring(0, modelName.indexOf('/'));
    }

    const modelInfo = aiModels[modelName];
    if (provider === 'openai' && modelInfo && modelInfo.structuredOutput === false) {
        return {
            openai: {
                strictJsonSchema: false
            }
        };
    }

    return undefined;
}

/**
 * Generates a list of 6 Pokemon via an AI model.
 * @param {string} modelName - AI model name
 * @param {object[]} bannedPokemonList - List of banned Pokemon
 */
async function generatePokemonList(modelName, bannedPokemonList = null, reasoningEffort = null) {
    // Create a history array to track the conversation
    const history = [];

    // Add initial prompt to history
    history.push({
        role: 'system',
        content: GENERATE_POKEMON_LIST_PROMPT
    });

    history.push({
        role: 'user',
        content: `
Not all these Pokémon are available for you to choose from, some of them are banned.
Don't choose any Pokémon from the banned list.
Here is the list of banned Pokémon, you can't choose them:
<banned_pokemon_list>
${bannedPokemonList.map(p => `${p.name} (${p.id})`).join('\n')}
</banned_pokemon_list>
        `
    });

    while (true) {
        try {
            let schema;

            schema = z.object({
                reasoning: z.string().describe('Your reasoning, explain your chain of thought. Reason for choice, why did you choose this team? Say all your thoughts.'),
                team: z
                    .object({
                        pokemonIds: z
                            .object({
                                name: z.string().describe('Pokémon name (according to the list)'),
                                id: z.number().describe('Official Pokédex ID (Between 1 and 251, according to the list)'),
                            })
                            .array(),
                    })
            });

            const { object, usage } = await generateObject({
                model: getModel(modelName, reasoningEffort),
                messages: history,
                mode: aiModels[modelName].outputMode || 'auto',
                schema: schema,
                providerOptions: getProviderOptions(modelName),
                experimental_repairText: async ({ text, error }) => {
                    try {
                        return jsonrepair(text);
                    } catch (repairError) {
                        console.log('JSON repair failed:', repairError.message);
                        return text;
                    }
                },
            });
            console.log('Usage', usage);

            // Check if any of the selected Pokémon are banned
            if (bannedPokemonList) {
                const selectedBannedPokemon = object.team.pokemonIds.filter(pokemon =>
                    bannedPokemonList.some(banned => parseInt(banned.id) === parseInt(pokemon.id))
                );

                if (selectedBannedPokemon.length > 0) {
                    console.log(object.team.pokemonIds);
                    console.log(bannedPokemonList);
                    console.log(`AI selected banned Pokémon: ${selectedBannedPokemon.map(p => p.name).join(', ')}`);

                    // Add the AI's response to history
                    history.push({
                        role: 'assistant',
                        content: JSON.stringify(object)
                    });

                    // Add feedback message to history
                    history.push({
                        role: 'user',
                        content: `<system_message>ERROR: You selected ${selectedBannedPokemon.map(p => `${p.name} (${p.id})`).join(', ')}, but ${selectedBannedPokemon.length > 1 ? 'they are' : 'it is'} on the banned list. Please read the banned list and replace the banned Pokémon with other Pokémon.</system_message>`
                    });

                    // Continue the loop to get a new choice
                    continue;
                }
            }

            // Check if the team is valid (Pokemon between 1 and 251)
            if (object.team.pokemonIds.some(pokemon => pokemon.id < 1 || pokemon.id > 251)) {
                console.log(`AI selected invalid Pokémon: ${object.team.pokemonIds.map(p => p.name).join(', ')}`);
                // Add feedback message to history
                history.push({
                    role: 'user',
                    content: `<system_message>ERROR: You selected ${object.team.pokemonIds.map(p => `${p.name} (${p.id})`).join(', ')}, but ${object.team.pokemonIds.length > 1 ? 'they are' : 'it is'} not a valid Pokémon ID. Please choose Pokémon IDs between 1 and 149.</system_message>`
                });

                // Continue the loop to get a new choice
                continue;
            }

            // Check if the team have less or more than 6 pokemons
            if (object.team.pokemonIds.length !== 6) {
                // Add feedback message to history
                history.push({
                    role: 'user',
                    content: `<system_message>ERROR: You selected ${object.team.pokemonIds.length} Pokémon, but you must select exactly 6 Pokémon.</system_message>`
                });

                // Continue the loop to get a new choice
                continue;
            }

            // Check for duplicate Pokémon in the team
            const pokemonIds = object.team.pokemonIds.map(pokemon => pokemon.id);
            const uniqueIds = new Set(pokemonIds);

            if (uniqueIds.size !== pokemonIds.length) {
                // Find duplicates
                const duplicates = pokemonIds.filter((id, index) => pokemonIds.indexOf(id) !== index);
                const duplicatePokemon = object.team.pokemonIds.filter(pokemon =>
                    duplicates.includes(pokemon.id)
                );

                console.log(`AI selected duplicate Pokémon: ${duplicatePokemon.map(p => p.name).join(', ')}`);

                // Add the AI's response to history
                history.push({
                    role: 'assistant',
                    content: JSON.stringify(object)
                });

                // Add feedback message to history
                history.push({
                    role: 'user',
                    content: `<system_message>ERROR: You've selected the same Pokémon more than once: ${duplicatePokemon.map(p => `${p.name} (${p.id})`).join(', ')}. Please ensure each Pokémon in your team is unique.</system_message>`
                });

                // Continue the loop to get a new choice
                continue;
            }

            console.log(object);
            // If we reach here, the selection is valid
            return object;
        } catch (error) {
            console.log(`⚠️ Error in generateObject:`, error.message);
            if (NoObjectGeneratedError.isInstance(error)) {
                console.log('NoObjectGeneratedError');
                console.log('Cause:', error.cause);
                console.log('Text:', error.text);
                console.log('Response:', error.response);
                console.log('Usage:', error.usage);
            }
            // Special handling for quota exhaustion errors
            if (error.message && error.message.includes("Resource has been exhausted")) {
                console.log(`⚠️ Quota exhausted. Waiting 60 seconds before retrying...`);
                // Wait for 60 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 60000));
                continue; // Skip the error handling below and retry with reduced history
            }

            if (error.message && error.message.includes('No object generated')) {
                // If we've exhausted retries or it's not the specific error we're handling, rethrow
                throw error;
            }

            console.log(`Retrying generateObject...`);
            // Short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}


/**
 * Generates a list of banned Pokemon for the player based on the already banned list.
 * @param {string} modelName - AI model name
 * @param {object[]} alreadyBannedPokemonList - List of already banned Pokemon
 * @returns {Promise<object>} - Object containing the banned Pokemon list and reasoning
 */
async function generateBannedPokemonList(modelName, alreadyBannedPokemonList = null, reasoningEffort = null) {
    // Create a history array to track the conversation
    const history = [];
    let bannedPokemonListStr = '';

    if (alreadyBannedPokemonList) {
        bannedPokemonListStr = `
<already_banned_pokemon_list>
Here is the list of already banned Pokémon (Choosen by the opponent), you can't choose them as they are already banned:
${alreadyBannedPokemonList.map(p => `- [#${p.id}] ${p.name}`).join('\n')}
</already_banned_pokemon_list>
        `;
    }

    console.log(bannedPokemonListStr);

    const pokemonToBan = 9;

    // Add initial prompt to history
    history.push({
        role: 'user',
        content: GENERATE_BANNED_POKEMON_LIST_PROMPT.replaceAll('{{ALREADY_BANNED_POKEMON_LIST}}', bannedPokemonListStr)
            .replaceAll('{{POKEMON_TO_BAN}}', pokemonToBan)
    });

    while (true) {
        try {
            let schema;
            schema = z.object({
                reasoning: z.string().describe('Your reasoning, explain your chain of thought, why did you choose these Pokémon to be banned?'),
                pokemonIds: z
                    .object({
                        name: z.string().describe('Pokémon name (according to the list)'),
                        id: z.number().describe('Official Pokédex ID (Between 1 and 251, according to the list)'),
                    })
                    .array(),
            });
            const { object, usage } = await generateObject({
                model: getModel(modelName, reasoningEffort),
                messages: history,
                mode: aiModels[modelName].outputMode || 'auto',
                schema: schema,
                providerOptions: getProviderOptions(modelName),
                experimental_repairText: async ({ text, error }) => {
                    try {
                        console.log('Bad JSON:', text);
                        return jsonrepair(text);
                    } catch (repairError) {
                        console.log('JSON repair failed:', repairError.message);
                        return text;
                    }
                },
            });
            console.log('Usage', usage);

            // Check if any of the selected Pokémon are already banned
            if (alreadyBannedPokemonList) {
                const alreadyBannedSelected = object.pokemonIds.filter(pokemon =>
                    alreadyBannedPokemonList.some(banned => parseInt(banned.id) === parseInt(pokemon.id))
                );

                if (alreadyBannedSelected.length > 0) {
                    console.log(`AI selected already banned Pokémon: ${alreadyBannedSelected.map(p => p.name).join(', ')}`);

                    // Add the AI's response to history
                    history.push({
                        role: 'assistant',
                        content: JSON.stringify(object)
                    });

                    // Add feedback message to history
                    history.push({
                        role: 'user',
                        content: `<system_message>ERROR: You selected ${alreadyBannedSelected.map(p => `${p.name} (${p.id})`).join(', ')}, but ${alreadyBannedSelected.length > 1 ? 'they are' : 'it is'} already on the banned list. Please read the already banned list and choose different Pokémon.</system_message>`
                    });

                    // Continue the loop to get a new choice
                    continue;
                }
            }

            // Check if the Pokemon IDs are valid (between 1 and 251)
            if (object.pokemonIds.some(pokemon => pokemon.id < 1 || pokemon.id > 251)) {
                const invalidPokemon = object.pokemonIds.filter(pokemon => pokemon.id < 1 || pokemon.id > 251);
                console.log(`AI selected invalid Pokémon: ${invalidPokemon.map(p => p.name).join(', ')}`);

                // Add the AI's response to history
                history.push({
                    role: 'assistant',
                    content: JSON.stringify(object)
                });

                // Add feedback message to history
                history.push({
                    role: 'user',
                    content: `<system_message>ERROR: You selected ${invalidPokemon.map(p => `${p.name} (${p.id})`).join(', ')}, but ${invalidPokemon.length > 1 ? 'they are' : 'it is'} not valid Pokémon ID(s). Please choose Pokémon IDs between 1 and 251.</system_message>`
                });

                // Continue the loop to get a new choice
                continue;
            }

            // Check if the number of banned Pokémon matches pokemonToBan
            if (object.pokemonIds.length !== pokemonToBan) {
                console.log(`AI selected ${object.pokemonIds.length} Pokémon, but should select exactly ${pokemonToBan}`);

                // Add the AI's response to history
                history.push({
                    role: 'assistant',
                    content: JSON.stringify(object)
                });

                // Add feedback message to history
                history.push({
                    role: 'user',
                    content: `<system_message>ERROR: You selected ${object.pokemonIds.length} Pokémon, but you must select exactly ${pokemonToBan} Pokémon to ban.</system_message>`
                });

                // Continue the loop to get a new choice
                continue;
            }

            // If we reach here, the selection is valid
            return object;
        } catch (error) {
            console.log(`⚠️ Error in generateObject:`, error.message);
            if (NoObjectGeneratedError.isInstance(error)) {
                console.log('NoObjectGeneratedError');
                console.log('Cause:', error.cause);
                console.log('Text:', error.text);
                console.log('Response:', error.response);
                console.log('Usage:', error.usage);
            }

            // Special handling for quota exhaustion errors
            if (error.message && error.message.includes("Resource has been exhausted")) {
                console.log(`⚠️ Quota exhausted. Waiting 60 seconds before retrying...`);
                // Wait for 60 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 60000));
                continue; // Skip the error handling below and retry
            }

            if (error.message && error.message.includes('No object generated')) {
                // If we've exhausted retries or it's not the specific error we're handling, rethrow
                throw error;
            }

            console.log(`Retrying generateObject...`);
            // Short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

/**
 * Formats Pokemon information into an optimized XML structure while preserving semantics.
 * @param {object} pokemon - The Pokemon to format
 * @param {object} pokeApi - Pokemon API instance
 * @param {boolean} includeIndex - Whether to include the index
 * @param {number|null} index - Pokemon's index in the team
 * @param {boolean} showMoves - Whether to display moves
 * @returns {string} - The formatted Pokemon text in XML
 */
function formatPokemonPlainText(pokemon, pokeApi, includeIndex = false, index = null, showMoves = true) {
    if (!pokemon || pokemon.id === 0) {
        return `<pokemon index="${index || 0}" status="empty">No Pokémon</pokemon>`;
    }

    const [type1Name, type2Name] = pokemon.types;
    let statusText = pokeApi.getStatusText(pokemon.status);
    const healthPercentage = Math.floor((pokemon.currentHP / pokemon.maxHP) * 100);

    if (pokemon.currentHP === 0) {
        statusText = "Fainted";
    }

    // Build XML with attributes to reduce nested tags
    let xml = `<pokemon`;
    if (includeIndex) xml += ` team_position="${index}"`;
    xml += ` name="${pokemon.name}" level="${pokemon.level}"`;
    xml += ` type="${type1Name}${type2Name ? '/' + type2Name : ''}"`;
    xml += ` health="${pokemon.currentHP}/${pokemon.maxHP} (${healthPercentage}%)"`;

    if (statusText && statusText !== "Normal") {
        xml += ` status="${statusText}"`;
    }

    // Stats as attributes instead of nested tags
    if (pokemon.currentHP > 0) {
        xml += ` attack="${pokemon.attack}" defense="${pokemon.defense}" speed="${pokemon.speed}"`;
        xml += ` special_attack="${pokemon.specialAttack}" special_defense="${pokemon.specialDefense}"`;
    }

    // If no moves to show, close the tag
    if (!showMoves || !pokemon.moves || pokemon.moves.length === 0) {
        xml += ` />`;
        return xml;
    }

    // Otherwise add moves
    xml += `>`;

    // Add moves with flat structure
    if (pokemon.moves && pokemon.moves.length > 0 && pokemon.currentHP > 0) {
        xml += `<moves>`;
        pokemon.moves.forEach((move, idx) => {
            xml += `<move id="${idx + 1}" name="${move.name}" type="${move.type}"`;
            xml += ` pp="${move.currentPP}/${move.maxPP}" power="${move.power}" accuracy="${move.accuracy}"`;
            xml += ` category="${move.category}"`;

            // Description as tag content rather than attribute if not empty
            if (move.description) {
                xml += `>${move.description}</move>`;
            } else {
                xml += ` />`;
            }
        });
        xml += `</moves>`;
    }

    xml += `</pokemon>`;
    return xml;
}

/**
 * Formats Pokemon data for the AI in a complete XML structure.
 * @param {object} currentPokemon The player's active Pokemon
 * @param {Array|string} yourTeam The player's full team
 * @param {object|string} adversaryPokemon The opponent's active Pokemon
 * @param {Array|null} adversaryTeam The opponent's full team
 * @returns {object} XML-formatted data
 */
function formatPokemonData(currentPokemon, yourTeam, adversaryPokemon, adversaryTeam) {
    // Find the active Pokemon's index in your team
    let currentPokemonIndex = null;
    if (Array.isArray(yourTeam)) {
        for (let i = 0; i < yourTeam.length; i++) {
            if (yourTeam[i].id === currentPokemon.id) {
                currentPokemonIndex = i + 1; // Convert to 1-based indexing
                break;
            }
        }
    }

    // Find the opponent's active Pokemon index in their team
    let adversaryPokemonIndex = null;
    if (Array.isArray(adversaryTeam) && typeof adversaryPokemon === 'object') {
        for (let i = 0; i < adversaryTeam.length; i++) {
            if (adversaryTeam[i].id === adversaryPokemon.id) {
                adversaryPokemonIndex = i + 1; // Convert to 1-based indexing
                break;
            }
        }
    }

    // Format your active Pokemon
    const formattedCurrentPokemon = formatPokemonPlainText(currentPokemon, global.pokeApi, true, currentPokemonIndex, true);

    // Format the opponent's active Pokemon
    const formattedAdversaryPokemon = typeof adversaryPokemon === 'object'
        ? formatPokemonPlainText(adversaryPokemon, global.pokeApi, true, adversaryPokemonIndex, false)
        : adversaryPokemon;

    // Format the rest of your team
    let formattedTeam = '<your_team>\n';
    if (Array.isArray(yourTeam)) {
        formattedTeam += yourTeam
            .map((p, idx) => ({ pokemon: p, originalIndex: idx + 1 }))
            .filter(item => item.pokemon.id !== currentPokemon.id)
            .map(item => formatPokemonPlainText(item.pokemon, global.pokeApi, true, item.originalIndex, true))
            .join("\n");
    } else {
        formattedTeam += yourTeam;
    }
    formattedTeam += '\n</your_team>';

    // Format the rest of the opponent's team
    let formattedAdversaryTeam = '<opponent_team>\n';
    if (Array.isArray(adversaryTeam)) {
        formattedAdversaryTeam += adversaryTeam
            .map((p, idx) => ({ pokemon: p, originalIndex: idx + 1 }))
            .filter(item => item.pokemon.id !== adversaryPokemon.id)
            .map(item => formatPokemonPlainText(item.pokemon, global.pokeApi, true, item.originalIndex, false))
            .join("\n");
    }
    formattedAdversaryTeam += '\n</opponent_team>';

    return {
        formattedCurrentPokemon,
        formattedTeam,
        formattedAdversaryPokemon,
        formattedAdversaryTeam
    };
}

/**
 * Prepares the user prompt for the AI with a complete XML structure.
 * @param {object} formattedData XML-formatted Pokemon data
 * @param {Array|null} turnLogs Previous turn logs
 * @param {Array|null} chatMessagesOpponent Opponent's chat messages
 * @param {boolean} isAlreadyReady Whether the player is already ready for the next turn
 * @param {boolean} onlySwitch Whether only the switch option is available
 * @returns {string} The user prompt in XML
 */
function prepareUserPrompt(formattedData, turnLogs, chatMessagesOpponent, isAlreadyReady = false, onlySwitch = false) {
    const { formattedCurrentPokemon, formattedTeam, formattedAdversaryPokemon, formattedAdversaryTeam } = formattedData;

    let lastOpponentChatMessage = '';
    if (chatMessagesOpponent && chatMessagesOpponent.length > 0) {
        lastOpponentChatMessage = chatMessagesOpponent[chatMessagesOpponent.length - 1];
    }

    // Determine available actions
    let availableActionsXml = '';
    if (isAlreadyReady) {
        // Case 1: Only the "ready" action is available
        availableActionsXml = '<action type="ready">Confirm you are ready for the next turn</action>';
    } else if (onlySwitch) {
        // Case 2: Only the "switch_pokemon" action is available
        availableActionsXml = '<action type="switch_pokemon">Switch to another Pokémon (specify team_position)</action>';
    } else {
        // Case 3: Both "attack" and "switch_pokemon" actions are available
        availableActionsXml = '<action type="attack">Choose a move (specify id 1-4)</action>\n    <action type="switch_pokemon">Switch to another Pokémon (specify team_position)</action>';
    }

    const opponentChatMessages = lastOpponentChatMessage
        ? `<opponent_chat_message>${lastOpponentChatMessage}</opponent_chat_message>`
        : '';


    // Complete XML structure
    return `<battle_context>
  ${opponentChatMessages}

  ${turnLogs ? `
<turn_logs>
Here is the last turn logs from the game, the list represents all the text that appeared in the game in the order of appearance during the last turn. Use this to know who attacked first, and every useful information about what happened in the last turn:
${JSON.stringify(turnLogs, null, 2)}
</turn_logs>` : ''}

  <active_pokemon>
${formattedCurrentPokemon}
  </active_pokemon>

  <opponent_active_pokemon>
${formattedAdversaryPokemon}
  </opponent_active_pokemon>

  ${formattedTeam}

  ${formattedAdversaryTeam}

</battle_context>

<available_actions>
${availableActionsXml}
</available_actions>
`;
}


/**
 * Prepares messages to send to the AI, including token optimization.
 * @param {string} modelName AI model name
 * @param {string} opponentModelName Opponent's AI model name
 * @param {Array} apiHistory Message history
 * @param {number} playerNumber Player number
 * @param {number} maxTokens Maximum number of tokens
 * @returns {Array} Optimized messages to send to the AI
 */
function prepareMessagesForAI(modelName, opponentModelName, apiHistory, playerNumber, maxTokens) {
    const lastUsedTokens = playerNumber === 1 ? lastPlayer1UsedTokens : lastPlayer2UsedTokens;

    // Get battle information
    const battleFormat = global.battleFormat || 'single';
    const battleScores = global.battleScores || { player1: 0, player2: 0 };

    // Prepare base system message
    let systemContent = CHOOSE_ATTACK_PROMPT + `

Your guild is:
<player_guild>
${aiModels[modelName].chatTeam || 'Unknown'}
</player_guild>

You username is:
<player_username>
${aiModels[modelName].chatUsername || modelName}
</player_username>`;
    systemContent += `Your opponent's guild is:
<opponent_guild>
${aiModels[opponentModelName].chatTeam || 'Unknown'}
</opponent_guild>

Your opponent's username is:
<opponent_username>
${aiModels[opponentModelName].chatUsername || opponentModelName}
</opponent_username>`;

    // Only add battle information for Best of 3 or Best of 5 matches
    if (battleFormat === 'best3' || battleFormat === 'best5') {
        // Format text and determine target wins
        const battleFormatText = battleFormat === 'best3' ? 'Best of 3' : 'Best of 5';
        const targetWins = battleFormat === 'best3' ? 2 : 3;

        // Get the scores from the perspective of the current player
        const yourScore = playerNumber === 1 ? battleScores.player1 : battleScores.player2;
        const opponentScore = playerNumber === 1 ? battleScores.player2 : battleScores.player1;

        // Add battle information to system content
        systemContent += `

Match Information:
<match_info>
Format: ${battleFormatText}
Current Score: You (${yourScore}) - Opponent (${opponentScore})
First to reach ${targetWins} wins will win the match
</match_info>`;
    }



    // Language prompt

    // systemContent += `The language setup for this session is "French". You must answer in French, for your analysis, your battle strategy, your chat message, etc.`;
    systemContent += `The language setup for this session is "English". You must answer in English, for your analysis, your battle strategy, your chat message, etc.`;

    // Prepare the system message
    let messagesToSend = [
        {
            role: 'system',
            content: systemContent,
        }
    ];

    if (lastUsedTokens > 0) {
        // Calculate token reduction factor based on previous usage
        const safetyMargin = 0.75; // Using 75% of max as a safety threshold
        const criticalThreshold = 0.9; // 90% is considered critical
        const currentUsageRatio = lastUsedTokens / maxTokens;

        if (currentUsageRatio > safetyMargin) {
            let reductionFactor;

            // Progressive scaling - more aggressive as we approach the limit
            if (currentUsageRatio >= criticalThreshold) {
                // Very aggressive reduction when approaching the limit (80-60% kept)
                const criticalScale = 1 - ((currentUsageRatio - criticalThreshold) / (1 - criticalThreshold));
                reductionFactor = safetyMargin * criticalScale * 0.8;
                console.log(`🔥 Critical token usage! Using aggressive reduction factor: ${Math.round(reductionFactor * 100)}%`);
            } else {
                // Standard reduction for high but not critical usage
                // Modified formula to be more aggressive than the original
                reductionFactor = safetyMargin / currentUsageRatio * 0.9;
            }

            const historyToKeep = Math.floor(apiHistory.length * reductionFactor);

            // Reduce the minimum percentage as token usage increases
            const minPercentage = Math.max(0.25 - ((currentUsageRatio - safetyMargin) * 0.5), 0.1);
            const minToKeep = Math.max(Math.floor(apiHistory.length * minPercentage), 1);
            const finalToKeep = Math.max(historyToKeep, minToKeep);

            const oldApiHistoryLength = apiHistory.length;
            apiHistory = apiHistory.slice(-finalToKeep);

            console.log(`⚠️ Token usage too high: ${lastUsedTokens}/${maxTokens} (${Math.round(currentUsageRatio * 100)}%)`);
            console.log(`⚠️ Keeping only ${apiHistory.length}/${oldApiHistoryLength} most recent messages (${Math.round(reductionFactor * 100)}%)`);
        }
    }

    messagesToSend = [messagesToSend[0], ...apiHistory];
    console.log(`📊 Number of messages being sent to AI: ${messagesToSend.length} (including system message)`);

    // Clean messages to reduce size
    return cleanMessagesForTokenOptimization(messagesToSend);
}

/**
 * Cleans messages to optimize token usage.
 * @param {Array} messages Messages to clean
 * @returns {Array} Cleaned messages
 */
function cleanMessagesForTokenOptimization(messages) {
    if (!messages || messages.length === 0) return [];

    const messagesCopy = [...messages];
    const messageCount = messagesCopy.length;

    // Gather all necessary information in a single pass
    let lastMovesIndex = -1;
    const recentUserIndices = new Set();
    const recentAssistantIndices = new Set();
    let userCount = 0;
    let assistantCount = 0;

    // Single reverse iteration to find all indices we need
    for (let i = messageCount - 1; i >= 0; i--) {
        const message = messagesCopy[i];

        if (message.role === 'user') {
            // Track recent user messages
            if (userCount < 5) {
                recentUserIndices.add(i);
                userCount++;
            }

            // Find the last message with moves tags (only if we haven't found one yet)
            if (lastMovesIndex === -1 &&
                message.content.includes('<moves>') &&
                message.content.includes('</moves>')) {
                lastMovesIndex = i;
            }
        }
        else if (message.role === 'assistant') {
            // Track recent assistant messages
            if (assistantCount < 5) {
                recentAssistantIndices.add(i);
                assistantCount++;
            }
        }

        // Early termination if we've found everything we need
        if (userCount >= 5 && assistantCount >= 5 && lastMovesIndex !== -1) {
            break;
        }
    }

    // Process all messages in a single forward pass
    for (let i = 0; i < messageCount; i++) {
        const message = messagesCopy[i];

        if (message.role === 'user') {
            // Process user messages
            if (i !== lastMovesIndex || !recentUserIndices.has(i)) {
                let content = message.content;

                // Apply tag removals as needed
                if (i !== lastMovesIndex) {
                    content = content.replace(/<moves>[\s\S]*?<\/moves>/g, '');
                }

                if (!recentUserIndices.has(i)) {
                    content = content.replace(/<opponent_team>[\s\S]*?<\/opponent_team>/g, '');
                    content = content.replace(/<your_team>[\s\S]*?<\/your_team>/g, '');
                    content = content.replace(/<turn_logs>[\s\S]*?<\/turn_logs>/g, '');
                }

                // Only update if content actually changed
                if (content !== message.content) {
                    messagesCopy[i] = { ...message, content };
                }
            }
        }
        else if (message.role === 'assistant' && !recentAssistantIndices.has(i)) {
            // Process older assistant messages
            try {
                const content = JSON.parse(message.content);
                let modified = false;

                // Remove fields to save tokens
                if (content.analysis) {
                    delete content.analysis;
                    modified = true;
                }

                if (content.battle_strategy) {
                    delete content.battle_strategy;
                    modified = true;
                }

                // Only stringify and update if we modified something
                if (modified) {
                    messagesCopy[i] = {
                        ...message,
                        content: JSON.stringify(content)
                    };
                }
            } catch (e) {
                // Silent fail for non-JSON content
            }
        }
    }

    return messagesCopy;
}

/**
 * Creates the Zod schema for AI response validation.
 * @param {boolean} onlySwitch Whether only the switch option is available
 * @param {boolean} isAlreadyReady Whether the player is already ready
 * @returns {object} Zod validation schema
 */
function createResponseSchema(onlySwitch, isAlreadyReady) {
    if (isAlreadyReady) {
        return z.object({
            analysis: z.string().describe('Your situation analysis and analysis of the last turn. What happened? How you can use this information to choose your next action?'),
            battle_strategy: z.string().describe('Your battle strategy for this turn, what is your plan ? What you will do ? And why ?'),
            type: z.enum(['ready']),
            chat_message: z.string().describe('The chat message to send'),
        });

    } else {
        return z.object({
            analysis: z.string().describe('Your situation analysis and analysis of the last turn. What happened? How you can use this information to choose your next action?'),
            battle_strategy: z.string().describe('Your battle strategy for this turn, what is your plan ? What you will do ? And why ?'),
            type: onlySwitch
                ? z.enum(['switch_pokemon'])
                : z.enum(['attack', 'switch_pokemon']),
            value: z
                .enum(getTeamSize() === 3 ? ['1', '2', '3', '4'] : ['1', '2', '3', '4', '5', '6'])
                .describe('ID of the attack to use or ID of the Pokémon to switch'),
            chat_message: z.string().describe('The chat message to send'),
        });

    }
}

/**
 * Validates the AI response for a Pokemon switch choice.
 * @param {object} object AI response
 * @param {object} currentPokemon Active Pokemon
 * @param {Array} yourTeam Player's team
 * @param {Array} history Message history
 * @param {Array} apiHistory API message history
 * @returns {boolean} true if valid, false otherwise
 */
function validatePokemonSwitchChoice(object, currentPokemon, yourTeam, history, apiHistory) {
    if (object.type !== 'switch_pokemon') {
        return true;  // Not a switch action, so valid
    }

    const pokemonIndex = parseInt(object.value) - 1; // Convert to zero-based index

    // Check if the index is valid (exists in the team)
    if (pokemonIndex < 0 || pokemonIndex >= yourTeam.length) {
        console.log(`AI selected invalid Pokémon index: ${pokemonIndex + 1}. Team size: ${yourTeam.length}`);

        // Add a message to history to correct the AI
        history.push({
            role: 'user',
            content: `<system_message>ERROR: You selected Pokémon #${pokemonIndex + 1}, but that's not valid. Please choose a Pokémon from 1 to ${yourTeam.length}.</system_message>`
        });

        apiHistory.push({
            role: 'user',
            content: `<system_message>ERROR: You selected Pokémon #${pokemonIndex + 1}, but that's not valid. Please choose a Pokémon from 1 to ${yourTeam.length}.</system_message>`
        });

        return false;
    }

    // Check if the Pokemon has remaining HP
    const selectedPokemon = yourTeam[pokemonIndex];
    if (selectedPokemon.currentHP <= 0) {
        console.log(`AI selected fainted Pokémon: ${selectedPokemon.name} with 0 HP`);

        // Add a message to history to correct the AI
        history.push({
            role: 'user',
            content: `<system_message>ERROR: You selected ${object.value}, but it has fainted (0 HP). Please choose another Pokémon.</system_message>`
        });

        apiHistory.push({
            role: 'user',
            content: `<system_message>ERROR: You selected ${object.value}, but it has fainted (0 HP). Please choose another Pokémon.</system_message>`
        });

        return false;
    }

    // Check if the Pokemon is already active
    if (selectedPokemon.id === currentPokemon.id) {
        console.log(`AI tried to switch to already active Pokémon: ${selectedPokemon.name}`);

        // Add a message to history to correct the AI
        history.push({
            role: 'user',
            content: `<system_message>ERROR: You selected ${object.value}, but it's already your active Pokémon. Please choose a different Pokémon.</system_message>`
        });

        apiHistory.push({
            role: 'user',
            content: `<system_message>ERROR: You selected ${object.value}, but it's already your active Pokémon. Please choose a different Pokémon.</system_message>`
        });

        return false;
    }

    return true;
}

/**
 * Validates the AI response for an attack choice.
 * @param {object} object AI response
 * @param {object} currentPokemon Active Pokemon
 * @param {Array} history Message history
 * @param {Array} apiHistory API message history
 * @returns {boolean} true if valid, false otherwise
 */
function validatePokemonAttackChoice(object, currentPokemon, history, apiHistory) {
    if (object.type !== 'attack') {
        return true;  // Not an attack action, so valid
    }

    const moveIndex = parseInt(object.value) - 1; // Convert to zero-based index

    // Check if the index is valid (exists in the Pokemon's moves)
    if (moveIndex < 0 || moveIndex >= currentPokemon.moves.length) {
        console.log(`AI selected invalid move index: ${moveIndex + 1}. Available moves: ${currentPokemon.moves.length}`);

        // Add a message to history to correct the AI
        history.push({
            role: 'user',
            content: `<system_message>ERROR: You selected move #${moveIndex + 1}, but that's not valid. Please choose a move from 1 to ${currentPokemon.moves.length}.</system_message>`
        });

        apiHistory.push({
            role: 'user',
            content: `<system_message>ERROR: You selected move #${moveIndex + 1}, but that's not valid. Please choose a move from 1 to ${currentPokemon.moves.length}.</system_message>`
        });

        return false;
    }

    // Check if the move has remaining PP
    if (currentPokemon.moves[moveIndex].currentPP <= 0) {
        // Check if all moves have 0 PP
        const allMovesHaveNoPP = currentPokemon.moves.every(move => move.currentPP <= 0);

        // If at least one move has PP, reject this choice
        if (!allMovesHaveNoPP) {
            console.log(`AI selected move with no PP remaining: ${currentPokemon.moves[moveIndex].name} (${moveIndex + 1})`);

            // Add a message to history to correct the AI
            history.push({
                role: 'user',
                content: `<system_message>ERROR: You selected ${currentPokemon.moves[moveIndex].name} (move #${moveIndex + 1}), but it has no PP left. Please choose another move that has PP remaining.</system_message>`
            });

            apiHistory.push({
                role: 'user',
                content: `<system_message>ERROR: You selected ${currentPokemon.moves[moveIndex].name} (move #${moveIndex + 1}), but it has no PP left. Please choose another move that has PP remaining.</system_message>`
            });

            return false;
        } else {
            console.log(`AI selected move with no PP, but all moves have 0 PP. Allowing choice to trigger 'struggle': ${currentPokemon.moves[moveIndex].name} (${moveIndex + 1})`);
            return true; // Allow choice if all moves have 0 PP (will trigger "struggle")
        }
    }

    return true;
}

/**
 * Handles AI response generation with retry on error.
 * @param {string} modelName AI model name
 * @param {Array} messagesToSend Messages to send
 * @param {object} schema Validation schema
 * @param {Array} apiHistory API message history
 * @returns {Promise<object>} Object containing the AI response and token usage
 */
async function generateAIResponseWithRetry(modelName, messagesToSend, schema, apiHistory, reasoningEffort = null) {
    let object;
    let usage;
    let retryCount = 0;
    const maxRetries = 3;

    // Create a local copy of messages for the retry loop
    let localMessages = [...messagesToSend];

    while (retryCount < maxRetries) {
        try {
            const result = await generateObject({
                model: getModel(modelName, reasoningEffort),
                messages: localMessages,
                mode: aiModels[modelName].outputMode || 'auto',
                schema: schema,
                providerOptions: getProviderOptions(modelName),
                temperature: aiModels[modelName].temperature || undefined,
                topP: aiModels[modelName].topP || undefined,
                topK: aiModels[modelName].topK || undefined,
                // abortSignal: AbortSignal.timeout(300000), // 5 minutes
                experimental_repairText: async ({ text, error }) => {
                    try {
                        return jsonrepair(text);
                    } catch (repairError) {
                        console.log('JSON repair failed:', repairError.message);
                        return text;
                    }
                },
            });
            object = result.object;
            usage = result.usage;

            break; // If successful, exit retry loop
        } catch (error) {
            retryCount++;
            console.log(`⚠️ Error in generateObject (attempt ${retryCount}/${maxRetries}):`, error.message);

            // Handle Invalid JSON response error - just retry without adding to history
            if (error.message && error.message.includes('Invalid JSON response')) {
                console.log('Invalid JSON response detected, retrying without modifying history...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            if (NoObjectGeneratedError.isInstance(error)) {
                console.log('NoObjectGeneratedError');
                console.log('Cause:', error.cause);
                console.log('Text:', error.text);
                console.log('Response:', error.response);
                console.log('Usage:', error.usage);

                // Add error response to local messages only, not global history
                localMessages.push({
                    role: 'assistant',
                    content: error.text,
                });

                // Create error message for correction
                let errorMessage = "<system_message>ERROR: Your answer must contain all the needed fields. Please strictly respect the JSON Schema</system_message>";

                try {
                    // Try to parse JSON from error.text
                    const jsonResponse = JSON.parse(error.text);

                    // Validate JSON with schema
                    const result = schema.safeParse(jsonResponse);

                    if (!result.success) {
                        // Format Zod errors
                        const formattedErrors = result.error.errors.map(err =>
                            `Field '${err.path.join('.')}': ${err.message}`
                        ).join('\n');

                        errorMessage = `<system_message>ERROR: Your JSON response has validation errors. Please fix them and strictly respect the schema:
                        
${formattedErrors}
                        
Make sure all required fields are included and have the correct types.</system_message>`;
                    }
                } catch (parseError) {
                    // If parsing fails, use more specific message
                    errorMessage = `<system_message>ERROR: Your response is not valid JSON. Please provide a proper JSON object that follows the schema.</system_message>`;
                }

                // Add error message to local messages only, not global history
                localMessages.push({
                    role: 'user',
                    content: errorMessage
                });

                // Continue the loop to get a new choice
                continue;
            }

            // Special handling for quota exhaustion errors
            if (error.message && error.message.includes("Resource has been exhausted")) {
                console.log(`⚠️ Quota exhausted. Waiting 60 seconds before retrying...`);
                // Wait for 60 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 60000));
                // Don't count this attempt against the max retries
                retryCount--;
                continue;
            }

            // Special handling for token limit errors
            if (error.message && error.message.includes("maximum context length") && apiHistory.length > 1) {
                console.log(`⚠️ Token limit exceeded. Reducing history further before retrying...`);

                // Cut the truncated history in half for the next attempt
                apiHistory = apiHistory.slice(Math.ceil(apiHistory.length / 2));
                messagesToSend = [messagesToSend[0]].concat(apiHistory);

                // Update local messages too
                localMessages = [...messagesToSend];

                console.log(`⚠️ Reduced to ${apiHistory.length} messages for retry attempt ${retryCount}`);

                // Short delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; // Skip the error handling below and retry with reduced history
            }

            if (retryCount >= maxRetries || !(error.message && error.message.includes('No object generated'))) {
                // If we've exhausted retries or it's not the specific error we're handling, rethrow
                throw error;
            }

            console.log(`Retrying generateObject (${retryCount}/${maxRetries})...`);
            // Short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return { object, usage };
}

/**
 * Chooses the next action (attack or switch) for the current turn.
 * @param {string} modelName AI model name
 * @param {string} opponentModelName Opponent's AI model name
 * @param {object} currentPokemon Player's active Pokemon
 * @param {Array} yourTeam Player's full team
 * @param {object} adversaryPokemon Opponent's active Pokemon
 * @param {number} playerNumber Player number (1 or 2)
 * @param {boolean} onlySwitch Whether only the switch option is available
 * @param {object} turnLogs Previous turn logs
 * @param {Array} chatMessagesOpponent Opponent's chat messages
 * @param {boolean} isAlreadyReady Whether the player is already ready
 * @param {Array} adversaryTeam Opponent's full team (if known)
 * @param {boolean} badMove Whether the move is invalid
 * @returns {Promise<object>} The AI's decision
 */
async function chooseNextAttack(
    modelName,
    opponentModelName,
    currentPokemon,
    yourTeam,
    adversaryPokemon,
    playerNumber,
    onlySwitch = false,
    turnLogs = null,
    chatMessagesOpponent = null,
    isAlreadyReady = false,
    adversaryTeam = null,
    badMove = false,
    reasoningEffort = null
) {
    // History stored in global variables (player1History, player2History)
    const history = playerNumber === 1 ? global.player1History : global.player2History;
    const apiHistory = playerNumber === 1 ? global.player1ApiHistory : global.player2ApiHistory;

    // Format Pokemon data
    const formattedData = formatPokemonData(currentPokemon, yourTeam, adversaryPokemon, adversaryTeam);

    // Determine user prompt content
    let userPromptContent;
    if (badMove) {
        // On bad move, use a system message instead of the normal prompt
        userPromptContent = "<system_message>ERROR: Your last move was not allowed and was rejected by the game. (Pokemon trapped, etc...)</system_message>";
        console.log("Bad move detected, using system message for Player", playerNumber);
    } else {
        // Normal behavior: prepare the user prompt
        userPromptContent = prepareUserPrompt(formattedData, turnLogs, chatMessagesOpponent, isAlreadyReady, onlySwitch);
    }
    // Add the prompt to history
    history.push({
        role: 'user',
        content: userPromptContent,
    });
    apiHistory.push({
        role: 'user',
        content: userPromptContent,
    });


    const maxTokens = aiModels[modelName].maxTokens || 999999999999;

    while (true) {
        // Prepare messages for the AI with token optimization
        let messagesToSend = prepareMessagesForAI(modelName, opponentModelName, apiHistory, playerNumber, maxTokens);

        // Create the validation schema
        const schema = createResponseSchema(onlySwitch, isAlreadyReady);

        // Generate the AI response with retry
        const { object, usage } = await generateAIResponseWithRetry(modelName, messagesToSend, schema, apiHistory, reasoningEffort);
        // If object is null, an error was handled and a message was added to history
        if (!object) {
            continue; // Restart the loop
        }

        // Update token usage
        if (playerNumber === 1) {
            lastPlayer1UsedTokens = usage.totalTokens;
        } else {
            lastPlayer2UsedTokens = usage.totalTokens;
        }

        // Add the AI response to history
        history.push({
            role: 'assistant',
            content: JSON.stringify(object),
        });
        apiHistory.push({
            role: 'assistant',
            content: JSON.stringify(object),
        });

        // Validate the response if it's a Pokemon switch
        if (!validatePokemonSwitchChoice(object, currentPokemon, yourTeam, history, apiHistory)) {
            continue; // Validation failed, restart
        }

        // Validate the response if it's an attack
        if (!validatePokemonAttackChoice(object, currentPokemon, history, apiHistory)) {
            continue; // Validation failed, restart
        }

        console.log('Usage', usage);
        // Save history to a JSON
        fs.writeFileSync(`history_player${playerNumber}.json`, JSON.stringify(history));
        fs.writeFileSync(`api_history_player${playerNumber}.json`, JSON.stringify(apiHistory));
        fs.writeFileSync(`last_history_player${playerNumber}.json`, JSON.stringify(messagesToSend));
        return object;
    }
}

/**
 * Chooses the final getTeamSize() Pokemon for battle from the initial 6.
 * @param {string} modelName
 * @param {object[]} pokemonList
 * @param {object[]} adversaryTeam
 * @returns {Promise<object[]>}
 */
async function chooseFinalTeam(modelName, pokemonList, adversaryTeam, reasoningEffort = null) {
    // Call PokeAPI via the globally stored instance

    const formattedPlayerList = await Promise.all(
        pokemonList.map((p, idx) =>
            formatPokemonPlainText(p, global.pokeApi, true, idx + 1, true)
        )
    );
    const formattedAdversaryList = await Promise.all(
        adversaryTeam.map((p, idx) =>
            formatPokemonPlainText(p, global.pokeApi, true, idx + 1, false)
        )
    );

    const prompt = CHOOSE_FINAL_TEAM_PROMPT
        .replaceAll('{{TEAM_SIZE}}', getTeamSize())
        .replace('{{PLAYER_LIST}}', formattedPlayerList.join('\n'))
        .replace('{{ADVERSARY_LIST}}', formattedAdversaryList.join('\n'));

    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
        try {

            let schema;

            schema = z.object({
                reasoning: z.string().describe('Your reasoning, explain your chain of thought. Reason for choice, why did you choose this team? Say all your thoughts.'),
                pokemonIds: z.array(
                    z.object({
                        reason: z.string().describe('Reason for choice'),
                        name: z.string().describe('Pokémon name'),
                        id: z.number().describe('The team_position of the Pokemon in the list, between 1 and 6'),
                    })
                ),
            })
            


            const { object, usage } = await generateObject({
                model: getModel(modelName, reasoningEffort),
                prompt,
                mode: aiModels[modelName].outputMode || 'auto',
                schema: schema,
                providerOptions: getProviderOptions(modelName),
                experimental_repairText: async ({ text, error }) => {
                    try {
                        return jsonrepair(text);
                    } catch (repairError) {
                        console.log('JSON repair failed:', repairError.message);
                        return text;
                    }
                },
            });
            console.log('Usage', usage);
            return object;
        } catch (error) {
            retryCount++;
            console.log(`⚠️ Error in chooseFinalTeam (attempt ${retryCount}/${maxRetries}):`, error.message);

            // Special handling for quota exhaustion errors
            if (error.message && error.message.includes("Resource has been exhausted")) {
                console.log(`⚠️ Quota exhausted. Waiting 60 seconds before retrying...`);
                // Wait for 60 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 60000));
                // Don't count this attempt against the max retries
                retryCount--;
                continue;
            }

            if (retryCount >= maxRetries) {
                throw error;
            }

            console.log(`Retrying chooseFinalTeam (${retryCount}/${maxRetries})...`);
            // Short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // If we reach here without returning, throw error
    throw new Error(`Failed to choose final team after ${maxRetries} retries`);
}

/**
 * Generates an end-of-battle message based on the result.
 * @param {string} modelName AI model name
 * @param {string} opponentModelName Opponent's AI model name
 * @param {number} playerNumber Player number (1 or 2)
 * @param {boolean} isWinner Whether the player won the battle
 * @param {object} battleInfo Additional battle information (scores, etc.)
 * @returns {Promise<object>} The AI response containing only a message
 */
async function generateEndOfBattleMessage(
    modelName,
    opponentModelName,
    playerNumber,
    isWinner,
    battleInfo = {},
    reasoningEffort = null
) {
    // History stored in global variables
    const history = playerNumber === 1 ? global.player1History : global.player2History;
    const apiHistory = playerNumber === 1 ? global.player1ApiHistory : global.player2ApiHistory;

    // Prepare end-of-battle message
    const battleFormat = global.battleFormat || 'single';
    const battleScores = global.battleScores || { player1: 0, player2: 0 };

    // Adapt information from the player's perspective
    const yourScore = playerNumber === 1 ? battleScores.player1 : battleScores.player2;
    const opponentScore = playerNumber === 1 ? battleScores.player2 : battleScores.player1;

    // Generate text about the match format
    let matchInfoText = '';
    if (battleFormat === 'best3' || battleFormat === 'best5') {
        const battleFormatText = battleFormat === 'best3' ? 'Best of 3' : 'Best of 5';
        let nextRoundText = '';
        if ((battleFormat === 'best3' && (yourScore === 2 || opponentScore === 2)) || (battleFormat === 'best5' && (yourScore === 3 || opponentScore === 3))) {
            nextRoundText = 'This was the final round of the battle!';
        } else {
            nextRoundText = 'The next round will start in a few seconds!';
        }
        matchInfoText = `
<match_info>
Format: ${battleFormatText}
Final Score: You (${yourScore}) - Opponent (${opponentScore})
${nextRoundText}
</match_info>`;
    } else {
        matchInfoText = `
<match_info>
This was the final round of the battle!
</match_info>`;
    }

    // Create the user message content
    let userPromptContent = `
<battle_result>
This round is now finished.
You have ${isWinner ? 'WON' : 'LOST'} this round!
${matchInfoText}
</battle_result>

Send a final message to express your feelings about this battle
`;

    // Add the prompt to history
    history.push({
        role: 'user',
        content: userPromptContent,
    });
    apiHistory.push({
        role: 'user',
        content: userPromptContent,
    });

    const maxTokens = aiModels[modelName].maxTokens || 999999999999;

    // Prepare messages for the AI with token optimization
    let messagesToSend = prepareMessagesForAI(modelName, opponentModelName, apiHistory, playerNumber, maxTokens);

    // Simplified schema for chat message only
    const schema = z.object({
        chat_message: z.string().describe('The chat message to send'),
    });

    // Generate the AI response with retry
    const { object, usage } = await generateAIResponseWithRetry(modelName, messagesToSend, schema, apiHistory, reasoningEffort);

    // Update token usage
    if (playerNumber === 1) {
        lastPlayer1UsedTokens = usage.totalTokens;
    } else {
        lastPlayer2UsedTokens = usage.totalTokens;
    }

    // Add the AI response to history
    history.push({
        role: 'assistant',
        content: JSON.stringify(object),
    });
    apiHistory.push({
        role: 'assistant',
        content: JSON.stringify(object),
    });

    console.log('Usage', usage);

    // Save history to a JSON file
    fs.writeFileSync(`history_player${playerNumber}.json`, JSON.stringify(history));
    fs.writeFileSync(`api_history_player${playerNumber}.json`, JSON.stringify(apiHistory));

    return object;
}

module.exports = {
    getModel,
    generatePokemonList,
    generateBannedPokemonList,
    chooseNextAttack,
    chooseFinalTeam,
    resetAIVariables,
    generateEndOfBattleMessage
};
