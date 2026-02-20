/************************************************
 * FILE: logger.js
 ************************************************/

const chalk = require('./chalk');

/**
 * Logger object for consistent console output.
 * Displays formatted messages in the console.
 */
const logger = {
  divider: () => console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')),

  sectionHeader: (title) => {
    console.log('');
    console.log(chalk.bgBlue.white.bold(` ${title.toUpperCase()} `));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  },

  info: (message) => {
    console.log(chalk.cyan('ℹ ') + message);
  },

  success: (message) => {
    console.log(chalk.green('✓ ') + message);
  },

  warning: (message) => {
    console.log(chalk.yellow('⚠ ') + message);
  },

  error: (message, error) => {
    console.error(chalk.red('✖ ') + message);
    if (error) console.error(chalk.red(error.stack || error));
  },

  battle: (message) => {
    console.log(chalk.magenta('⚔ ') + message);
  },

  pokemon: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    console.log(playerColor(`${playerSymbol} Player ${playerNumber}: `) + message);
  },

  teamHeader: (playerNumber, modelName) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    console.log('');
    console.log(playerColor(`${playerSymbol} Player ${playerNumber} Team (${modelName}):`));
    console.log(chalk.gray('───────────────────────────────────────────'));
  },

  analysis: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    const title = playerColor(`${playerSymbol} Player ${playerNumber}: `) + chalk.bgCyan.black(' ANALYSIS ');
    
    console.log('');
    console.log(title);
    console.log(chalk.gray('───────────────────────────────────────────'));
    console.log(chalk.italic(message));
    console.log(chalk.gray('───────────────────────────────────────────'));
  },

  strategy: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    const title = playerColor(`${playerSymbol} Player ${playerNumber}: `) + chalk.bgYellow.black(' STRATEGY ');
    
    console.log('');
    console.log(title);
    console.log(chalk.gray('───────────────────────────────────────────'));
    console.log(chalk.italic(message));
    console.log(chalk.gray('───────────────────────────────────────────'));
  },

  chat: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    const title = playerColor(`${playerSymbol} Player ${playerNumber}: `) + chalk.bgYellow.black(' CHAT ');
    
    console.log('');
    console.log(title);
    console.log(chalk.gray('───────────────────────────────────────────'));
    console.log(chalk.italic(message));
    console.log(chalk.gray('───────────────────────────────────────────'));
  },

  decision: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    console.log(
      playerColor(`${playerSymbol} Player ${playerNumber}: `) +
      chalk.bgGreen.black(' DECISION ') +
      ' ' +
      chalk.bold(message)
    );
  },

  turnDivider: () => {
    console.log('');
    console.log(
      chalk.yellow('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ TURN TRANSITION ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓')
    );
    console.log('');
  },

  moveAnimation: (playerNumber, message) => {
    const playerColor = playerNumber === 1 ? chalk.blue : chalk.red;
    const playerSymbol = playerNumber === 1 ? '🔵' : '🔴';
    console.log(
      playerColor(`${playerSymbol} Player ${playerNumber}: `) +
      chalk.bgMagenta.white(' MOVE ') +
      ' ' +
      chalk.bold(message)
    );
  },
};

module.exports = logger;
