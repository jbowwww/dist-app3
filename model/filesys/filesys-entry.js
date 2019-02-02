"use strict";
const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
const nodeFs = require('fs');
const nodePath = require('path');
const mongoose = require('mongoose');
	
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
// fsEntry.plugin(require('../plugin/bulk-save.js'));
fsEntry.plugin(require('../plugin/artefact.js'));
// fsEntry.plugin(require('../plugin/stat.js'), { data: { save: {}, validate: {}, bulkSave: {}, ensureCurrentHash: {} } });

const discriminatorKey = fsEntry.get('discriminatorKey');

fsEntry.virtual('isDirectory').get(function() {
	return this.fileType === 'dir';
})
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

// fsEntry.queue()
fsEntry.queue('doCreate');

var doCreateLevel = 0;
var doCreateLevelHigh = 0;

// I think this fires on creation of any document, whether retrieved from DB or newly created
// So more like a constructor
fsEntry.method('doCreate', function doCreate() {

	// Is it worth extracting the doc/model(and query/update middleware) boilerplate variable setting code and putting in one place?
	// create a handful of schema methods for creating different types /tempaltes of methods, which takes care of the doc, model(&discriminator) etc variables
	 if (++doCreateLevel > doCreateLevelHigh) {
	 	doCreateLevelHigh = doCreateLevel;
	 }
	var fs = this;
	var model = fs.constructor;
	discriminatorKey && fs && model && fs[discriminatorKey] && model.discriminators && model.discriminators[fs[discriminatorKey]] && (model = model.discriminators[fs[discriminatorKey]]);
	const Dir = mongoose.model('dir');
	const Partition = mongoose.model('partition');
	console.verbose(`[model ${model.modelName}].pre('doCreate'): doCreateLevel=${doCreateLevel}(high=${doCreateLevelHigh}) disks.count=${mongoose.model('disk').count()}, partitions.count=${mongoose.model('partition').count()}\nfs.isNew=${fs.isNew} fs.isModified()=${fs.isModified()} fs.fileType='${fs.fileType}' fs=${inspect(fs)})\n`);
	
	// TODO: Query helper method that caches queries - e.g. Dir.findOne({ path: '...' }).useCache().then(dir => { })
	return Q(fs.dir || Dir/*.find()*/.findOne({ path: nodePath.dirname(fs.path) })/*.useCache()*/
	.then(dir => dir ? _.assign(fs, { dir: dir._id, partition: dir.partition?dir.partition._id:undefined }) :
		Partition.find({})./*useCache().*/then(partitions => _.find( _.reverse( _.sortBy( 
			_.filter( partitions, partition => typeof partition.mountpoint === 'string'),
			partition => partition.mountpoint.length)),
			partition => fs.path.startsWith(partition.mountpoint)))
		.then(partition => _.assign(fs, { partition: partition._id }))))

	.tap(() => console.verbose(`[model ${model.modelName}].post('doCreate'): doCreateLevel=${doCreateLevel}(high=${doCreateLevelHigh}) fs.isNew=${fs.isNew} fs.isModified()=${fs.isModified()} fs.fileType='${fs.fileType}' fs=${inspect(fs)}`))
	// .catch(err => {
	// 	model._stats.errors.push(err);
	// 	console.warn(`[model ${model.modelName}].post('doCreate'): error: ${err.stack||err}`);
	// 	throw err;
	// })
	.finally(() => { doCreateLevel--; });
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);
});

module.exports = mongoose.model('fs', fsEntry);

console.debug(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
