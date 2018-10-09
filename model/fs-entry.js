"use strict";

const console = require('../stdio.js').Get('model/fs-entry', { minLevel: 'log' });	// log verbose debug
const inspect = require('../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../utility.js').makeInspect({ depth: 2, compact: false });
// const _ = require('lodash');
// const Q = require('q');
const mongoose = require('mongoose');
const timestampPlugin = require('./plugin/timestamp.js');
const statPlugin = require('./plugin/stat.js');
const bulkSavePlugin = require('./plugin/bulk-save.js');
const standardPlugin = require('./plugin/standard.js');

var statSchema = new mongoose.Schema({
	"dev" : Number,
	"mode" : Number,
	"nlink" : Number,
	"uid" : Number,
	"gid" : Number,
	"rdev" : Number,
	"blksize" : { type: Number, required: true, default: null },
	"ino" : Number,
	"size" : Number,
	"blocks" : { type: Number, required: true, default: null },
	"atime" : Date,
	"mtime" : Date,
	"ctime" : Date,
	"birthtime" : Date,
	"atimeMs" : Number,
	"mtimeMs" : Number,
	"ctimeMs" : Number,
	"birthtimeMs" : Number
}, {
	_id: false 
});

var fsEntry = new mongoose.Schema({
	path: { type: String, unique: true, index: true, required: true },
	stats : statSchema
}, {
	discriminatorKey: 'fileType'
});

// fsEntry.method('test', () => {
// 	console.log(`fsEntry.test(): this=${inspect(this)}`);
// });
// fsEntry.pre('test', () => {
// 	console.log(`fsEntry.pre('test'): this=${inspect(this)}`);
// });

// fsEntry.post('test', () => {
// 	console.log(`fsEntry.post('test'): this=${inspect(this)}`);
// });

// fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
// fsEntry.plugin(statPlugin);

module.exports = mongoose.model('fs', fsEntry);

console.verbose(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
