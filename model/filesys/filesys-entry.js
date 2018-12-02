"use strict";

const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../utility.js').makeInspect({ depth: 2, compact: false });
// const { promisifyMethods } = require('../../utility.js');
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
	stats: { type: statSchema }
}, {
	discriminatorKey: 'fileType'
	// toJSON: { virtuals: true }
});
// fsEntry.virtual('dirPath')
// fsEntry.virtual('dir', { ref: 'dir', localField });
// fsEntry.virtual('partition', { type: mongoose.SchemaTypes.ObjectId, ref: 'partition' });

fsEntry.plugin(customHooksPlugin);
fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
fsEntry.plugin(statPlugin, { data: { save: {}, validate: {} } });

fsEntry.post('init', function() {
	const fs = this;
	const model = mongoose.model(this.constructor.baseModelName);
	const Dir = mongoose.model/*.discriminator*/('dir');
	const Partition = mongoose.model/*.discriminator*/('partition');
	const dirPath = nodePath.dirname(fs.path);
	console.verbose(`[model fsEntry ${model.modelName}].post('init'): fs.path='${fs.path}' dirPath='${dirPath}'`);
	return //Q.all([
		fs.populate('dir')//{ path: 'dir', match: { path: dirPath }, model: 'dir', justOne: true })
		// Dir.findOne({ path: dirPath })
		// .then(dir => fs.dir = dir._id)
		// .then(() => fs.populate('dir')),
		.populate('partition')//({ path: 'partition', match: { $where: function() { return fs.path.startsWith(this.mountpoint); } }, model: 'partition', justOne: true }))
		// Partition.findOne({ $where: function() { return fs.path.startsWith(this.mountpoint); } })
		// .then(partition => fs.partition = partition._id)
		// .then(() => fs.populate('partition')) ])
		.execPopulate()
	.tap(() => console.verbose(`fsEntry.on('init'): fs=${inspect(fs)}`));
});

fsEntry.post('construct', async function construct(fs) {
	var model = this;
	const Dir = mongoose.model('dir');
	const Partition = mongoose.model('partition');
	const dirPath = fs.dir ? fs.dir.path : nodePath.dirname(fs.path);
	console.verbose(`[model ${model.modelName}].post('construct'): path='${inspect(fs)}' dirPath=${dirPath}`);

	try {
		if (dirPath === fs.path) {
			fs.dir = null;
		} else if (!(fs.dir instanceof mongoose.Document)) {
			await Dir.findOrCreate({ path: dirPath }, fs.dir || { path: dirPath, stats: nodeFs.lstatSync(dirPath) }, { saveImmediate: true })
			.tap(dir => fs.dir = dir._id)//_.set(fs, 'dir', dir))
			// .tap(dir => dir.save());
		}
		if (!fs.partition) {
			await Partition.find({}).then(partitions => {
				var searchPartitions =_.reverse(_.sortBy(_.filter(partitions,
							partition => partition.mountpoint),
						partition => partition.mountpoint.length));	
				var partition = /*_.set*/(/*fs, 'partition',*/ _.find(searchPartitions, partition => fs.path.startsWith(partition.mountpoint)));
				if (partition) {
					fs.partition = partition._id;
				}
				console.verbose(`partitions=${inspect(partitions)} searchPartitions=${inspect(searchPartitions)} partition=${inspect(partition)} fs.partition=${inspect(fs.partition)}`);
			});
		} /*else if (!(fs.partition instanceof mongoose.Document)) {
			await Partition.findOrCreate({ mountpoint: fs.partition.mountpoint }, fs.partition, { saveImmediate: true })
			.tap(partition => fs.partition = partition._id)// _.set(fs, 'partition', partition))
			// .tap(partition => partition.save());
		}*/
		console.verbose(`[model ${model.modelName}].post('construct'): path='${fs}' dir=${fs.dir} partition=${fs.partition}`)
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
