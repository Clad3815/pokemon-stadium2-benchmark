const chalkImport = require('chalk');

// Chalk v5 (ESM) exposes the instance on `default` when loaded from CJS.
module.exports = chalkImport.default || chalkImport;
