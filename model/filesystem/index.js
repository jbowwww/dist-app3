"use strict";

const console = require('../../stdio.js').Get('model/filesystem', { minLevel: 'verbose' });	// log verbose debug
// const inspect = require('./utility.js').makeInspect({ depth: 2, compact: true /* false */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
// const _ = require('lodash');
const Q = require('q');

const mongoose = require('mongoose');

var FsEntry = mongoose.model('fs', require('./fs-entry-schema.js'));

var Directory = FsEntry.discriminator('dir', require('./dir-schema.js'));
var File = FsEntry.discriminator('file', require('./file-schema.js'));

module.exports = FsEntry;

console.verbose(`FsEntry: ${inspectPretty(FsEntry)}`);
console.verbose(`Directory: ${inspectPretty(Directory)}`);
console.verbose(`File: ${inspectPretty(File)}`);
