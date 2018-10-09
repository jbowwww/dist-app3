"use strict";
const console = require('../stdio.js').Get('model/dir', { minLevel: 'log' });	// log verbose debug
const inspect = require('../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const mongoose = require('mongoose');
const FsEntry = require('./fs-entry.js');

let dirSchema = new mongoose.Schema({

});

// dirSchema.plugin(require('./plugin/timestamp.js'));
// dirSchema.plugin(require('./plugin/standard.js'));
// dirSchema.plugin(require('./plugin/bulk-save.js'));
dirSchema.plugin(require('./plugin/stat.js'));

module.exports = FsEntry.discriminator('dir', dirSchema);

console.verbose(`Dir: ${inspect(module.exports)}, Dir.prototype: ${inspect(module.exports.prototype)}`);
