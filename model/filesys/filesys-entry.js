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

var fsEntry = new mongoose.Schema({
	path: { type: String, unique: true, index: true, required: true, set: function(val) {
		if (!this || (!(this instanceof mongoose.Document))) return val;
		var disk;
		Disk.find({ /*mountpoint: { $exists: 1 }*/ }).then(disks => {
			this.disk = disk = _.find( _.sortBy( disks, disk => disk.mountpoint.length ), disk => val.startsWith(disk.mountpoint) );
		console.debug(`fsEntry.path.set('${val}'): \n\n\t\n\tdisks=${inspect(disks)}\n\n\t\n\tdisk=${inspect(/*this.*/disk)}\n\n\t\n\tthis=${inspect(this)}`);
		}).done();
		return val;
	} },
	disk: { type: mongoose.SchemaTypes.ObjectId, ref: 'disk' },
	// partition: { type: Partition.schema },
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
