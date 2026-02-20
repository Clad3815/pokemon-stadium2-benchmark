/************************************************
 * FILE: main.js
 ************************************************/

require('dotenv').config();
const logger = require('./logger');
const statsTracker = require('./statsTracker');
const express = require('express');
const cors = require('cors');
const chalk = require('./chalk');

const aiModels = require('./data/ai_models.json');
const {
  getModelReasoningLevels,
  getModelRuntimeInfo,
  isReasoningEffortValidForModel,
  normalizeReasoningEffort,
  sanitizeReasoningEffortForModel
} = require('./modelUtils');
const {
  createModel,
  deleteModel,
  getModel: getRegisteredModel,
  getLastUpdatedAt,
  listModels,
  splitModelId,
  updateModel
} = require('./modelRegistry');




const {
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
  setCurrentBattleId,
  resetBattleVariables,
} = require('./battle');

const {
  getModel,
  generatePokemonList,
  generateBannedPokemonList,
  chooseNextAttack,
  chooseFinalTeam,
  resetAIVariables,
  generateEndOfBattleMessage
} = require('./ai');

const {
  focusWindowAndPressKey,
  focusWindowAndPressKeyPromise
} = require('./modules/windowManager');

/**
 * Local history for each player, used by the AI.
 */
global.player1History = [];
global.player2History = [];

// API history for each player, used by the AI.
global.player1ApiHistory = [];
global.player2ApiHistory = [];

global.battleFormat = 'single'; // Default format: 'single' or 'best3'
global.battleType = '6vs6'; // Default battle type: '6vs6' or '3vs3'
global.battleScores = {
  player1: 0,
  player2: 0
}; // Scores for multi-round formats (BO3, BO5)

/**
 * Export AI functions so they are accessible globally
 * (battle.js uses them via global.*).
 */
global.getModel = getModel;
global.generatePokemonList = generatePokemonList;
global.chooseNextAttack = chooseNextAttack;
global.chooseFinalTeam = chooseFinalTeam;
global.generateEndOfBattleMessage = generateEndOfBattleMessage;

/**
 * Make pokeApi globally accessible (used in ai.js).
 */
global.pokeApi = pokeApi;

/**
 * Define the two AI models used.
 */
// global.modelPlayer1 = 'gemini/gemini-2.0-pro-exp-02-05';
// global.modelPlayer1 = 'gemini/gemini-2.0-flash';
// global.modelPlayer1 = 'openai/gpt-3.5-turbo';
// global.modelPlayer1 = 'openai/gpt-4-turbo';
// global.modelPlayer1 = 'openai/gpt-4o-2024-11-20';
// global.modelPlayer1 = 'openai/gpt-4o';
global.modelPlayer1 = 'openai/gpt-5.2';
// global.modelPlayer1 = 'openai/gpt-4.5-preview';
// global.modelPlayer1 = 'openai/o3-mini';

// global.modelPlayer2 = 'openai/gpt-4.5-preview';
// global.modelPlayer2 = 'openai/o3-mini';
global.modelPlayer2 = 'anthropic/claude-sonnet-4-6';
// global.modelPlayer2 = 'openai/gpt-4o-mini';
// global.modelPlayer2 = 'gemini/gemini-2.0-pro-exp-02-05';

global.modelPlayer1ReasoningEffort = null;
global.modelPlayer2ReasoningEffort = null;
global.modelDisplayNames = {
  player1: global.modelPlayer1,
  player2: global.modelPlayer2
};
global.modelShortDisplayNames = {
  player1: global.modelPlayer1,
  player2: global.modelPlayer2
};
global.modelChatDisplayNames = {
  player1: global.modelPlayer1,
  player2: global.modelPlayer2
};
global.modelStatKeys = {
  player1: `${global.modelPlayer1}::default`,
  player2: `${global.modelPlayer2}::default`
};


// Banned Pokémon list
global.bannedPokemonList = []

function refreshGlobalModelRuntimeInfo() {
  const player1Runtime = getModelRuntimeInfo(
    global.modelPlayer1,
    global.modelPlayer1ReasoningEffort
  );
  const player2Runtime = getModelRuntimeInfo(
    global.modelPlayer2,
    global.modelPlayer2ReasoningEffort
  );

  global.modelPlayer1ReasoningEffort = player1Runtime.reasoningEffort;
  global.modelPlayer2ReasoningEffort = player2Runtime.reasoningEffort;

  global.modelDisplayNames = {
    player1: player1Runtime.modelDisplayName,
    player2: player2Runtime.modelDisplayName
  };
  global.modelShortDisplayNames = {
    player1: player1Runtime.modelShortDisplayName,
    player2: player2Runtime.modelShortDisplayName
  };
  global.modelChatDisplayNames = {
    player1: player1Runtime.modelChatDisplayName,
    player2: player2Runtime.modelChatDisplayName
  };
  global.modelStatKeys = {
    player1: player1Runtime.modelStatKey,
    player2: player2Runtime.modelStatKey
  };

  if (global.clientData) {
    global.clientData.reasoningEfforts = {
      player1: global.modelPlayer1ReasoningEffort,
      player2: global.modelPlayer2ReasoningEffort
    };
    global.clientData.modelDisplayNames = {
      ...global.modelDisplayNames
    };
    global.clientData.modelStatKeys = {
      ...global.modelStatKeys
    };
  }
}

function extractModelIdParam(req, res) {
  const rawModelId = req.params.modelId || '';

  try {
    const decodedModelId = decodeURIComponent(rawModelId).trim();
    if (!decodedModelId) {
      res.status(400).json({
        success: false,
        message: 'Model id is required'
      });
      return null;
    }

    return decodedModelId;
  } catch (error) {
    res.status(400).json({
      success: false,
      message: `Invalid model id "${rawModelId}"`
    });
    return null;
  }
}

function migrateActiveModelSelection(previousModelId, nextModelId) {
  let hasMigration = false;

  if (global.modelPlayer1 === previousModelId) {
    global.modelPlayer1 = nextModelId;
    hasMigration = true;
  }

  if (global.modelPlayer2 === previousModelId) {
    global.modelPlayer2 = nextModelId;
    hasMigration = true;
  }

  if (hasMigration && global.clientData) {
    global.clientData.modelPlayer1 = global.modelPlayer1;
    global.clientData.modelPlayer2 = global.modelPlayer2;
  }

  return hasMigration;
}

function sendModelRegistryError(res, error) {
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Unexpected server error',
    details: isClientError ? undefined : 'See server logs for details'
  });
}

// Express server configuration
const app = express();
app.use(express.json());

// Allow all CORS
app.use(cors());

const PORT = process.env.PORT || 3000;

// Current workflow state
const appStatus = {
  state: 'idle', // idle, running, finished, error
  message: 'Waiting for AI models selection',
  currentStep: '',
  error: null
};


// Client data
let clientData = {
  modelPlayer1: global.modelPlayer1,
  modelPlayer2: global.modelPlayer2,
  reasoningEfforts: {
    player1: global.modelPlayer1ReasoningEffort,
    player2: global.modelPlayer2ReasoningEffort
  },
  modelDisplayNames: {
    player1: global.modelPlayer1,
    player2: global.modelPlayer2
  },
  modelStatKeys: {
    player1: `${global.modelPlayer1}::default`,
    player2: `${global.modelPlayer2}::default`
  },
  battleFormat: 'single', // Default format
  battleType: '6vs6', // Default battle type
  currentBattleId: statsTracker.currentBattleId,
  player1Data: {
    isThinking: false,
    bannedPokemonList: [],
    pokemonList: [],
    team: [],
    history: [],
    activePokemon: null
  },
  player2Data: {
    isThinking: false,
    bannedPokemonList: [],
    pokemonList: [],
    team: [],
    history: [],
    activePokemon: null
  },
  endGameData: [] // End-of-game display data
};

global.clientData = clientData;
refreshGlobalModelRuntimeInfo();

// Endpoint to check status
app.get('/status', (req, res) => {
  // Create an enriched response with additional information
  const enrichedStatus = {
    ...appStatus,
    models: {
      player1: global.modelPlayer1,
      player2: global.modelPlayer2
    },
    reasoningEfforts: {
      player1: global.modelPlayer1ReasoningEffort,
      player2: global.modelPlayer2ReasoningEffort
    },
    modelDisplayNames: {
      ...global.modelDisplayNames
    },
    modelStatKeys: {
      ...global.modelStatKeys
    },
    battleScores: global.battleScores,
    serverInfo: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    clientData: global.clientData
  };

  // If a battleId is defined, include it in the response
  if (statsTracker.currentBattleId) {
    enrichedStatus.currentBattleId = statsTracker.currentBattleId;
  }

  res.json(enrichedStatus);
});


app.get('/battle_stats', (req, res) => {
  const enrichedStatus = {
    battle_stats: {
      modelStats: statsTracker.modelStats,
      pokemonUsage: statsTracker.pokemonUsage,
      battles: statsTracker.battles
    }
  };

  res.json(enrichedStatus);
});


app.get('/pokeapi_cache', (req, res) => {
  res.json(pokeApi.cache);
});

// Endpoint to get the list of models
app.get('/models', (req, res) => {
  res.json(aiModels);
});

const adminModelsRouter = express.Router();

adminModelsRouter.get('/', (req, res) => {
  const { models, providers } = listModels();
  res.json({
    success: true,
    models,
    providers,
    activeSelection: {
      player1: global.modelPlayer1,
      player2: global.modelPlayer2
    },
    lastUpdated: getLastUpdatedAt()
  });
});

adminModelsRouter.post('/', (req, res) => {
  try {
    const { provider, model, config } = req.body || {};
    const createdModel = createModel({ provider, model, config });

    res.status(201).json({
      success: true,
      message: `Model "${createdModel.modelId}" created`,
      modelId: createdModel.modelId,
      model: createdModel.model
    });
  } catch (error) {
    sendModelRegistryError(res, error);
  }
});

adminModelsRouter.post('/:modelId/clone', (req, res) => {
  const sourceModelId = extractModelIdParam(req, res);
  if (!sourceModelId) {
    return;
  }

  try {
    const sourceModel = getRegisteredModel(sourceModelId);
    if (!sourceModel) {
      return res.status(404).json({
        success: false,
        message: `Model "${sourceModelId}" not found`
      });
    }

    const sourceModelParts = splitModelId(sourceModelId);
    const { provider, model, config } = req.body || {};

    const clonePayload = {
      provider: provider || sourceModelParts.provider,
      model,
      config: config
        ? {
          ...sourceModel,
          ...config
        }
        : sourceModel
    };

    const clonedModel = createModel(clonePayload);

    res.status(201).json({
      success: true,
      message: `Model "${clonedModel.modelId}" created from clone`,
      sourceModelId,
      modelId: clonedModel.modelId,
      model: clonedModel.model
    });
  } catch (error) {
    sendModelRegistryError(res, error);
  }
});

adminModelsRouter.put('/:modelId', (req, res) => {
  const currentModelId = extractModelIdParam(req, res);
  if (!currentModelId) {
    return;
  }

  try {
    const { provider, model, config } = req.body || {};
    const updatedModel = updateModel(currentModelId, { provider, model, config });

    const migrationApplied = updatedModel.renamed
      ? migrateActiveModelSelection(updatedModel.currentModelId, updatedModel.nextModelId)
      : false;

    refreshGlobalModelRuntimeInfo();

    res.json({
      success: true,
      message: `Model "${updatedModel.nextModelId}" updated`,
      previousModelId: updatedModel.currentModelId,
      modelId: updatedModel.nextModelId,
      renamed: updatedModel.renamed,
      migrationApplied,
      model: updatedModel.model,
      activeSelection: {
        player1: global.modelPlayer1,
        player2: global.modelPlayer2
      }
    });
  } catch (error) {
    sendModelRegistryError(res, error);
  }
});

adminModelsRouter.delete('/:modelId', (req, res) => {
  const modelId = extractModelIdParam(req, res);
  if (!modelId) {
    return;
  }

  try {
    deleteModel(modelId);
    res.json({
      success: true,
      message: `Model "${modelId}" deleted`,
      modelId
    });
  } catch (error) {
    sendModelRegistryError(res, error);
  }
});

app.use('/admin/models', adminModelsRouter);

// Endpoint to get battle history
app.get('/history', (req, res) => {
  try {
    const battles = statsTracker.battles || [];
    res.json({
      success: true,
      total: battles.length,
      battles: battles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving battle history',
      error: error.message
    });
  }
});

// Endpoint to reset the process
app.post('/reset', async (req, res) => {
  // Don't allow reset if status is idle
  if (appStatus.state === 'idle') {
    return res.status(400).json({
      success: false,
      message: 'Application is already in idle state'
    });
  }

  // Reset status
  appStatus.state = 'resetting';
  appStatus.message = 'Resetting application...';

  res.json({
    success: true,
    message: 'Application reset initiated'
  });

  // Proceed with cleanup
  try {
    await performCleanup();
  } catch (error) {
    // This part won't execute since performCleanup() calls process.exit()
    appStatus.state = 'error';
    appStatus.message = 'Error during reset';
    appStatus.error = error.message;
  }
});

// Endpoint to select AI models
app.post('/select_ai', async (req, res) => {
  // Check if a workflow is already running
  if (appStatus.state === 'running') {
    return res.status(400).json({
      success: false,
      message: 'Workflow already running, cannot change AI models'
    });
  }

  // Extract models and battle format from request body
  const {
    player1,
    player2,
    battleFormat,
    battleType,
    player1ReasoningEffort,
    player2ReasoningEffort
  } = req.body;

  if (!player1 || !player2) {
    return res.status(400).json({
      success: false,
      message: 'Both player1 and player2 models must be specified'
    });
  }

  if (player1 === 'human' || player2 === 'human') {
    return res.status(400).json({
      success: false,
      message: 'Human mode has been removed. Please select two AI models.'
    });
  }

  if (!aiModels[player1] || !aiModels[player2]) {
    return res.status(400).json({
      success: false,
      message: 'One or both selected models are invalid'
    });
  }

  const normalizedPlayer1ReasoningEffort = normalizeReasoningEffort(player1ReasoningEffort);
  const normalizedPlayer2ReasoningEffort = normalizeReasoningEffort(player2ReasoningEffort);

  if (!isReasoningEffortValidForModel(player1, normalizedPlayer1ReasoningEffort)) {
    const allowedPlayer1Efforts = ['default', ...getModelReasoningLevels(player1)];
    return res.status(400).json({
      success: false,
      message: `Invalid reasoning effort for player1 model "${player1}". Allowed values: ${allowedPlayer1Efforts.join(', ')}`
    });
  }

  if (!isReasoningEffortValidForModel(player2, normalizedPlayer2ReasoningEffort)) {
    const allowedPlayer2Efforts = ['default', ...getModelReasoningLevels(player2)];
    return res.status(400).json({
      success: false,
      message: `Invalid reasoning effort for player2 model "${player2}". Allowed values: ${allowedPlayer2Efforts.join(', ')}`
    });
  }

  // Set models and battle format
  global.modelPlayer1 = player1;
  global.modelPlayer2 = player2;
  global.modelPlayer1ReasoningEffort = sanitizeReasoningEffortForModel(player1, normalizedPlayer1ReasoningEffort);
  global.modelPlayer2ReasoningEffort = sanitizeReasoningEffortForModel(player2, normalizedPlayer2ReasoningEffort);
  refreshGlobalModelRuntimeInfo();

  // Set battle format (with default value if not specified)
  global.battleFormat = battleFormat || 'single';
  global.battleType = battleType || '6vs6';
  global.clientData.battleFormat = global.battleFormat;
  global.clientData.battleType = global.battleType;
  global.clientData.modelPlayer1 = global.modelPlayer1;
  global.clientData.modelPlayer2 = global.modelPlayer2;

  // Reset scores
  global.battleScores.player1 = 0;
  global.battleScores.player2 = 0;

  // Update status
  appStatus.state = 'running';
  appStatus.message = 'Workflow started with selected AI models';

  res.json({
    success: true,
    message: 'AI models set successfully, workflow started',
    models: {
      player1: global.modelPlayer1,
      player2: global.modelPlayer2
    },
    reasoningEfforts: {
      player1: global.modelPlayer1ReasoningEffort,
      player2: global.modelPlayer2ReasoningEffort
    },
    modelDisplayNames: {
      ...global.modelDisplayNames
    },
    modelStatKeys: {
      ...global.modelStatKeys
    },
    battleFormat: global.battleFormat,
    battleType: global.battleType
  });

  // Reset client data
  global.clientData.player1Data = {
    isThinking: false,
    bannedPokemonList: [],
    pokemonList: [],
    team: [],
    history: [],
    activePokemon: null
  };
  global.clientData.player2Data = {
    isThinking: false,
    bannedPokemonList: [],
    pokemonList: [],
    team: [],
    history: [],
    activePokemon: null
  };
  global.clientData.endGameData = [];

  // Start the workflow asynchronously
  startWorkflow().catch(error => {
    appStatus.state = 'error';
    appStatus.message = 'An error occurred during execution';
    appStatus.error = error.message;
    logger.error('An error occurred during execution:', error);
  });
});


// let baseBannedPokemonList = [
//   { id: 150, name: 'Mew' },
//   { id: 151, name: 'Mewtwo' },
//   { id: 249, name: 'Lugia' },
//   { id: 250, name: 'Ho-oh' },
//   { id: 251, name: 'Celebi' }
// ];

let baseBannedPokemonList = [
  { id: 10, name: 'Caterpie' },
  { id: 11, name: 'Metapod' },
  { id: 13, name: 'Weedle' },
  { id: 14, name: 'Kakuna' },
  { id: 129, name: 'Magikarp' }
];

// Function to start the workflow
async function startWorkflow() {
  logger.sectionHeader('Pokémon Stadium AI Benchmark');
  logger.info(`Player 1: ${chalk.blue(global.modelDisplayNames.player1)}`);
  logger.info(`Player 2: ${chalk.red(global.modelDisplayNames.player2)}`);
  logger.info(`Battle Format: ${chalk.yellow(global.battleFormat)}`);
  logger.info(`Battle Type: ${chalk.green(global.battleType)}`);
  logger.divider();
  // Reset scores
  global.battleScores.player1 = 0;
  global.battleScores.player2 = 0;
  global.bannedPokemonList = baseBannedPokemonList;

  // Determine the number of wins needed based on format
  let targetWins = 1; // Default for "single" format
  if (global.battleFormat === 'best3') {
    targetWins = 2;
  } else if (global.battleFormat === 'best5') {
    targetWins = 3;
  }

  try {
    // Battle loop until a player reaches the required number of wins
    while (global.battleScores.player1 < targetWins && global.battleScores.player2 < targetWins) {
      logger.sectionHeader(`Battle ${global.battleScores.player1 + global.battleScores.player2 + 1}`);
      logger.info(`Current Score - Player 1: ${global.battleScores.player1}, Player 2: ${global.battleScores.player2}`);

      appStatus.state = 'running';
      appStatus.message = 'Battle in progress';
      // Reset variables for a new battle
      logger.info('Resetting battle and AI variables for new battle');
      resetBattleVariables();
      resetAIVariables();

      // Reset global history variables
      global.player1History = [];
      global.player2History = [];
      global.player1ApiHistory = [];
      global.player2ApiHistory = [];

      // Reset client data
      global.clientData.player1Data.bannedPokemonList = [];
      global.clientData.player1Data.pokemonList = [];
      global.clientData.player1Data.team = [];
      global.clientData.player1Data.history = [];
      global.clientData.player1Data.activePokemon = null;
      global.clientData.player1Data.isThinking = false;
      global.clientData.player2Data.bannedPokemonList = [];
      global.clientData.player2Data.pokemonList = [];
      global.clientData.player2Data.team = [];
      global.clientData.player2Data.history = [];
      global.clientData.player2Data.activePokemon = null;
      global.clientData.player2Data.isThinking = false;

      global.clientData.battleFormat = global.battleFormat;
      global.clientData.battleType = global.battleType;
      global.clientData.modelPlayer1 = global.modelPlayer1;
      global.clientData.modelPlayer2 = global.modelPlayer2;
      refreshGlobalModelRuntimeInfo();

      // Initialize battle in stats
      const battleId = statsTracker.initBattle(
        global.modelPlayer1,
        global.modelPlayer2,
        global.battleType,
        global.battleFormat,
        {
          player1ReasoningEffort: global.modelPlayer1ReasoningEffort,
          player2ReasoningEffort: global.modelPlayer2ReasoningEffort,
          player1ModelDisplayName: global.modelDisplayNames.player1,
          player2ModelDisplayName: global.modelDisplayNames.player2,
          player1ModelStatKey: global.modelStatKeys.player1,
          player2ModelStatKey: global.modelStatKeys.player2
        }
      );
      setCurrentBattleId(battleId);

      // Update client data
      global.clientData.currentBattleId = battleId;



      appStatus.state = 'banning_step';
      // Generate banned Pokemon lists
      appStatus.currentStep = 'Generating banned Pokémon lists';
      global.clientData.player1Data.isThinking = true;
      global.clientData.player2Data.isThinking = true;

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', global.battleType === '3vs3' ? '1' : '2');
      await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', 'f7');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate Player 1's banned Pokemon list
      const bannedPokemonListPlayer1 = await generateBannedPokemonList(
        global.modelPlayer1,
        global.bannedPokemonList,
        global.modelPlayer1ReasoningEffort
      );
      global.clientData.player1Data.bannedPokemonList = bannedPokemonListPlayer1;
      global.clientData.player1Data.isThinking = false;

      // Generate Player 2's banned Pokemon list
      global.clientData.player2Data.isThinking = true;
      const bannedPokemonListPlayer2 = await generateBannedPokemonList(
        global.modelPlayer2,
        [
          ...global.bannedPokemonList,
          ...bannedPokemonListPlayer1.pokemonIds
        ],
        global.modelPlayer2ReasoningEffort
      );
      global.clientData.player2Data.isThinking = false;

      global.clientData.player2Data.bannedPokemonList = bannedPokemonListPlayer2;

      if (bannedPokemonListPlayer1.reasoning) {
        logger.analysis(1, bannedPokemonListPlayer1.reasoning);
      }
      logger.pokemon(1, `Banned: ${bannedPokemonListPlayer1.pokemonIds.map(p => chalk.bold.white(p.name)).join(', ')}`);

      if (bannedPokemonListPlayer2.reasoning) {
        logger.analysis(2, bannedPokemonListPlayer2.reasoning);
        logger.pokemon(2, `Banned: ${bannedPokemonListPlayer2.pokemonIds.map(p => chalk.bold.white(p.name)).join(', ')}`);
      }

      // Record banned Pokémon in stats
      statsTracker.recordBannedPokemon(battleId, 1, bannedPokemonListPlayer1);
      statsTracker.recordBannedPokemon(battleId, 2, bannedPokemonListPlayer2);

      // Generate teams
      appStatus.currentStep = 'Generating Pokémon teams';
      appStatus.state = 'select_team_step';
      const { pokemonListPlayer1, pokemonListPlayer2 } = await generatePokemonLists(bannedPokemonListPlayer1, bannedPokemonListPlayer2, global.bannedPokemonList);
      global.clientData.player1Data.pokemonList = pokemonListPlayer1;
      global.clientData.player2Data.pokemonList = pokemonListPlayer2;
      global.clientData.player2Data.isThinking = false;
      global.clientData.player1Data.isThinking = false;

      // await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', 'f1');
      // await new Promise((resolve) => setTimeout(resolve, 2000));
      // First press "a" then wait 2 seconds

      await gameClient.sendCommandsSequentially(['a'], 1, 1);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Select 6 Pokemon in the game
      appStatus.currentStep = 'Selecting initial Pokémon teams in game';
      appStatus.state = 'select_pokemon_in_game_step';
      await selectEntriesInGame(pokemonListPlayer1, pokemonListPlayer2);

      // Wait for the 3 Pokemon selection screen
      appStatus.currentStep = 'Waiting for team selection screen';
      await waitForTeamSelection();
      const teamsInfo = await getAndDisplayInitialTeams();

      // Final selection of 3 Pokemon
      appStatus.currentStep = 'Choosing final teams';
      appStatus.state = 'select_final_team_step';
      await chooseAndSelectFinalTeams(teamsInfo);
      await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', 'f4');
      appStatus.state = 'battle_start_step';


      // Wait for battle start
      appStatus.currentStep = 'Waiting for battle start';
      await waitForBattleStart();

      // Initialize battle teams
      appStatus.currentStep = 'Initializing battle teams';
      await initializeBattleTeams();

      await gameClient.startTextCollection();
      // Start the battle loop
      appStatus.state = 'battle_loop_step';
      appStatus.currentStep = 'Battle in progress';

      await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', 'f4');
      await battleLoop();

      await gameClient.endTextCollection();

      // Display score after each battle
      logger.sectionHeader('Score Update');
      logger.info(`Player 1 (${global.modelDisplayNames.player1}): ${global.battleScores.player1}`);
      logger.info(`Player 2 (${global.modelDisplayNames.player2}): ${global.battleScores.player2}`);

      // Update client data with current scores
      global.clientData.battleScores = global.battleScores;

      if (global.battleFormat !== 'single') {
        appStatus.state = 'starting_next_round';
        appStatus.message = 'Starting next round...';
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      // If not in "single" format and a player has reached the target number of wins
      if ((global.battleFormat !== 'single') &&
        (global.battleScores.player1 >= targetWins || global.battleScores.player2 >= targetWins)) {
        const winner = global.battleScores.player1 >= targetWins ? 1 : 2;
        const winnerModel = winner === 1 ? global.modelDisplayNames.player1 : global.modelDisplayNames.player2;
        logger.success(`${winnerModel} wins the ${global.battleFormat} series!`);
        break;
      }
    }

    // Update status
    appStatus.state = 'finished';
    appStatus.message = 'Workflow completed successfully';

  } catch (error) {
    appStatus.state = 'error';
    appStatus.message = 'An error occurred during execution';
    appStatus.error = error.message;
    logger.error('An error occurred during execution:', error);
  }
}

// Start the Express server
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Status endpoint: http://localhost:${PORT}/status`);
  logger.info(`Select AI endpoint: http://localhost:${PORT}/select_ai`);
  logger.info('Waiting for AI models selection via API...');
  // Load stats if available
  statsTracker.loadStats();


  // Update status
  appStatus.currentStep = 'Preloading data';
  // Preload data (Pokemon, moves, types)
  await preloadData();

  appStatus.currentStep = 'Data preloaded';
});

/**
 * Clean application shutdown (cleanup).
 */
async function performCleanup() {
  logger.sectionHeader('Cleaning up');
  try {
    // Update application status
    appStatus.state = 'idle';
    appStatus.message = 'Application cleaned up and ready for new AI selection';
    appStatus.currentStep = '';
    appStatus.error = null;


    // Close the gameClient if it exists
    if (gameClient) {
      logger.info('Disconnecting from the game server...');
      await gameClient.disconnect();
      logger.success('Disconnection completed');
    }

  } catch (error) {
    logger.error('Error during disconnection:', error);
  }
  process.exit(0);
}

/**
 * Event handlers for shutdown (SIGINT, SIGTERM...).
 */
process.on('SIGINT', () => {
  logger.warning('\nSIGINT (Ctrl+C) detected. Closing...');
  performCleanup();
});
process.on('SIGTERM', () => {
  logger.warning('\nSIGTERM detected. Closing...');
  performCleanup();
});
process.on('uncaughtException', (error) => {
  logger.error('\nUncaught exception:', error);
  performCleanup();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('\nUnhandled promise rejection:', reason);
  performCleanup();
});
