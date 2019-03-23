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

fsEntry.plugin(require('../plugin/standard.js'));
fsEntry.plugin(require('../plugin/bulk-save.js'));
fsEntry.plugin(require('../plugin/artefact.js'));
// fsEntry.plugin(require('../plugin/stat.js'), { data: { save: {}, validate: {}, bulkSave: {}, ensureCurrentHash: {} } });

// const discriminatorKey = fsEntry.get('discriminatorKey');

fsEntry.post('init', function() {
	this.populate([{ path: 'dir', select: 'path _ts' }, { path: 'partition' }])
	.execPopulate()
	.tap(() => console.debug(`[model ${this.constructor.modelName}].post('init').populated: this=${inspect(this)}`));
});

// how to queue up a method for execution after a document / model instance is created 
// I think this fires on creation of any document, whether retrieved from DB or newly created (unlike post init, which is when fetched from db) - just check doc.isNew
// Have gone back to post('construct') for now
// fsEntry.queue('doCreate');

var doCreateLevel = 0;
var doCreateLevelHigh = 0;

fsEntry.post('construct', function doCreate(doc, next) {

	// Is it worth extracting the doc/model(and query/update middleware) boilerplate variable setting code and putting in one place?
	// create a handful of schema methods for creating different types /tempaltes of methods, which takes care of the doc, model(&discriminator) etc variables
	 if (++doCreateLevel > doCreateLevelHigh) {
	 	doCreateLevelHigh = doCreateLevel;
	 }
	var model = doc.constructor;
	// discriminatorKey && doc && model && doc[discriminatorKey] && model.discriminators && model.discriminators[doc[discriminatorKey]] && (model = model.discriminators[doc[discriminatorKey]]);
	const Dir = mongoose.model('dir');
	const Partition = mongoose.model('partition');
	// console.verbose(`[model ${model.modelName}].post('construct'): doCreateLevel=${doCreateLevel}(high=${doCreateLevelHigh}) disks.count=${mongoose.model('disk').count()}, partitions.count=${mongoose.model('partition').count()}\nfs.isNew=${doc.isNew} doc.isModified()=${doc.isModified()} doc.fileType='${doc.fileType}' doc=${inspect(doc)})\n`);
	
	// TODO: Query helper method that caches queries - e.g. Dir.findOne({ path: '...' }).useCache().then(dir => { })
	return Q(doc.dir || Dir/*.find()*/.findOne({ path: nodePath.dirname(doc.path) }).useCache()
	.then(dir => dir ? _.assign(doc, { dir: dir._id, partition: dir.partition ? dir.partition._id : undefined }) :
		Partition.find({}).useCache().then(partitions => _.find( _.reverse( _.sortBy( 
			_.filter( partitions, partition => typeof partition.mountpoint === 'string'),
			partition => partition.mountpoint.length)),
			partition => doc.path.startsWith(partition.mountpoint)))
		.then(partition => partition ? _.assign(doc, { partition: partition._id }) : doc)))

	.tap(() => console.debug(`[model ${model.modelName}].post('construct'): doCreateLevel=${doCreateLevel}(high=${doCreateLevelHigh})\ndisks.count=${mongoose.model('disk').count()}, partitions.count=${mongoose.model('partition').count()}\nfs.isNew=${doc.isNew} doc.isModified()=${doc.isModified()} doc.fileType='${doc.fileType}' doc=${inspect(doc)}`))
	.finally(() => { doCreateLevel--; });
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);
});

module.exports = mongoose.model('fs', fsEntry);

console.debug(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
