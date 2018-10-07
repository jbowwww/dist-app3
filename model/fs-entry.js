"use strict";

// const console = require('../stdio.js').Get('model/filesystem', { minLevel: 'verbose' });	// log verbose debug
// const inspect = require('./utility.js').makeInspect({ depth: 2, compact: true /* false */ });
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
	stats : statSchema,
	fileType: { type: String, getter: () => (this.stats.isFile()?'File':stats.isDirectory()?'Dir':'Unknown') }
}, {
	discriminatorKey: 'fileType'
});

fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
fsEntry.plugin(statPlugin);

module.exports = mongoose.model('fs', fsEntry);
