"use strict";
const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
const nodeFs = require('fs');
const nodePath = require('path');
const mongoose = require('mongoose');
const timestampPlugin = require('../plugin/timestamp.js');
const statPlugin = require('../plugin/stat.js');
const bulkSavePlugin = require('../plugin/bulk-save.js');
const standardPlugin = require('../plugin/standard.js');
const customHooksPlugin = require('../plugin/custom-hooks.js');
	
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
	dir: { type: mongoose.SchemaTypes.ObjectId, ref: 'dir' },
	partition: { type: mongoose.SchemaTypes.ObjectId, ref: 'partition' },
	stats: { type: statSchema, required: true }
}, {
	discriminatorKey: 'fileType'
});

fsEntry.plugin(customHooksPlugin);
fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
fsEntry.plugin(statPlugin, { data: { save: {}, validate: {} } });

// fsEntry.post('init', function() {
// 	const fs = this;
// 	const model = this.constructor.baseModelName ? mongoose.model(this.constructor.baseModelName) : this.constructor;
// 	const Dir = mongoose.model('dir');
// 	const Partition = mongoose.model('partition');
// 	const dirPath = nodePath.dirname(fs.path);
// 	return fs.populate('dir', '-dir -partition').populate('partition').execPopulate()
// 	.tap(() => console.verbose(`[model fsEntry ${model.modelName}].post('init'): fs.fileType=${fs.fileType} fs.path='${fs.path}'`));
// });


fsEntry.post('construct', async function construct(fs) {
	var model = this;
	const Dir = mongoose.model('dir');
	const Partition = mongoose.model('partition');
	const dirPath = fs.dir ? fs.dir.path : nodePath.dirname(fs.path);
	console.verbose(`[model ${model.modelName}].post('construct'): fs=${inspect(fs)} dirPath=${dirPath}`);

	try {
		if (dirPath === fs.path) {
			fs.dir = null;
		} else if (!fs.dir) {// instanceof mongoose.Document)) {
			await Dir.findOne({ path: dirPath }).then(dir => _.set(fs, 'dir', dir ? dir._id : null));
		}
		if (!fs.partition) {
			await Partition.find({}).then(partitions => {
				var searchPartitions =_.reverse(_.sortBy(_.filter(partitions, partition => partition.mountpoint), partition => partition.mountpoint.length));
				var part =_.find(searchPartitions, partition => fs.path.startsWith(partition.mountpoint));	
				_.set(fs, 'partition', part ? part._id : null);
				return fs;
			});
		}
	} catch(err) {
		model._stats.errors.push(err);
		console.warn(`[model ${model.modelName}].post('construct'): error: ${err.stack||err}`);
		throw err;
	}
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);
});

module.exports = mongoose.model('fs', fsEntry);

console.debug(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
