"use strict";
const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
const nodeFs = require('fs');
const nodePath = require('path');
const mongoose = require('mongoose');
// const standardPlugin = require('../plugin/standard.js');
	
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
	discriminatorKey: 'fileType',
	defaultFindQuery: { path: undefined },
	// toObject: { getters: true }
});


fsEntry.plugin(require('../plugin/custom-hooks.js'));
fsEntry.plugin(require('../plugin/timestamp.js'));
fsEntry.plugin(require('../plugin/standard.js'));
fsEntry.plugin(require('../plugin/bulk-save.js'));
fsEntry.plugin(require('../plugin/artefact.js'));
// fsEntry.plugin(require('../plugin/stat.js'), { data: { save: {}, validate: {}, bulkSave: {}, ensureCurrentHash: {} } });

// fsEntry.post('init', function() {
// 	const fs = this;
// 	const model = this.constructor.baseModelName ? mongoose.model(this.constructor.baseModelName) : this.constructor;
// 	const Dir = mongoose.model('dir');
// 	const Partition = mongoose.model('partition');
// 	const dirPath = nodePath.dirname(fs.path);
// 	return fs.populate('dir', '-dir -partition').populate('partition').execPopulate()
// 	.tap(() => console.verbose(`[model fsEntry ${model.modelName}].post('init'): fs.fileType=${fs.fileType} fs.path='${fs.path}'`));
// });

fsEntry.post('init', function() {
	var model = this.constructor;//model;
	this.populate([{ path: 'dir', select: 'path _ts' }, { path: 'partition' }]).execPopulate()
	.tap(() => console.verbose(`[model ${model.modelName}].post('init').populated: this=${inspect(this)}`));
});

fsEntry.post('construct', /*async */function construct(fs/*, next*/) {
	var model = this;
	const Dir = mongoose.model('dir');
	const Partition = mongoose.model('partition');
	const dirPath = nodePath.dirname(fs.path);
	console.verbose(`fsEntry.post('construct'): fs=${inspect(fs)}, disks.count=${mongoose.model('disk').count()}, partitions.count=${mongoose.model('partition').count()}`);
	// try {
		return Q.all([
			(dirPath === fs.path ? null : fs.dir || Dir.findOne({ path: dirPath })).then(dir => _.set(fs, 'dir', dir ? dir._id : null)),
			fs.partition || Partition.find({}).then(partitions => {
				var searchPartitions =_.reverse( _.sortBy(
					_.filter( partitions, partition => typeof partition.mountpoint === 'string'),
					partition => partition.mountpoint.length));
				var part =_.find(searchPartitions, partition => fs.path.startsWith(partition.mountpoint));	
				_.set(fs, 'partition', part ? part._id : null);
				return fs;
			})
		])
		.tap(() => console.verbose(`[model ${model.modelName}].post('construct').populated: this=${inspect(this)}`))
		// .then(next)//return fs;
		.catch(err => {
			model._stats.errors.push(err);
			console.warn(`[model ${model.modelName}].post('construct'): error: ${err.stack||err}`);
			throw err;
			// next(err);
		});
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);
});

module.exports = mongoose.model('fs', fsEntry);

console.debug(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
