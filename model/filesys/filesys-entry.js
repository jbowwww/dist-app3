"use strict";

const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'debug' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../utility.js').makeInspect({ depth: 2, compact: false });
const _ = require('lodash');
// const Q = require('q');
const mongoose = require('mongoose');
const timestampPlugin = require('../plugin/timestamp.js');
const statPlugin = require('../plugin/stat.js');
const bulkSavePlugin = require('../plugin/bulk-save.js');
const standardPlugin = require('../plugin/standard.js');
const Disk = require('./disk.js');
const Partition = require('./partition.js');

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

// statSchema.pre('init', stats => {
// 	console.log(`statSchema.pre('init'), ${typeof stats} ${stats.constructor.name} stats: ${inspect(stats)}`);
// 	// this.type = stats.isFile() ? 'file' : stats.isDirectory() ? 'dir' : 'unknown'
// });

// statSchema.post('init', stats => {
// 	console.log(`statSchema.post('init'), ${typeof stats} ${stats.constructor.name} stats: ${inspect(stats)}`);
// 	// this.type = stats.isFile() ? 'file' : stats.isDirectory() ? 'dir' : 'unknown'
// });

var fsEntry = new mongoose.Schema({
	path: { type: String, unique: true, index: true, required: true, set: function(val) {
		// console.debug(`fsEntry.path.set('${val}'): this=${inspect(this)}`);
		/*this.*/var part = _.find(Partition.partitions,
			// _.sortBy(Partition.partitions, part => 1024 - part.mountpoint ? part.mountpoint.length || 0 : 0),
			function(p) { return p.mountpoint && val.startsWith(p.mountpoint); });
		console.debug(`fsEntry.path.set('${val}'): part=${inspect(/*this.*/part)}`);
		// this.path = val;
		return val;
	} },
	disk: { type: Disk.schema },
	partition: { type: Partition.schema },
	stats: { type: statSchema },
	children: [{ type: mongoose.SchemaTypes.ObjectId, ref: String, default: undefined, required: false }]
}, {
	discriminatorKey: 'fileType'
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);	// timestampPlugin method
});

fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
fsEntry.plugin(statPlugin, { data: { save: {}, validate: {} } });

module.exports = mongoose.model('fs', fsEntry);

console.verbose(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
