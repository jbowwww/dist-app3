"use strict";
const console = require('../../stdio.js').Get('model/dir', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const mongoose = require('mongoose');
const FsEntry = require('./filesys-entry.js');

let dirSchema = new mongoose.Schema({ });

// dirSchema.plugin(require('./plugin/stat.js'), { data: {} });

module.exports = FsEntry.discriminator('dir', dirSchema);

console.verbose(`Dir: ${inspect(module.exports)}, Dir.prototype: ${inspect(module.exports.prototype)}`);
