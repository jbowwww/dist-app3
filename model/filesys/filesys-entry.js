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
	drive: { type: mongoose.SchemaTypes.ObjectId, ref: 'disk' },
	stats: { type: statSchema }
}, {
	discriminatorKey: 'fileType'
});

fsEntry.plugin(timestampPlugin);
fsEntry.plugin(standardPlugin);
fsEntry.plugin(bulkSavePlugin);
fsEntry.plugin(statPlugin, { data: { save: {}, validate: {} } });

fsEntry.post('construct', function construct(fs) {
	var model = this.constructor;
	const Dir = mongoose.model('dir');
	const Drive = mongoose.model('drive');
	const dirPath = fs.dir ? fs.dir.path : nodePath.dirname(fs.path);
	return Dir.findOrCreate({ path: dirPath }, fs.dir || { path: dirPath, stats: nodeFs.lstatSync(dirPath) })
	.tap(dir => _.set(fs, 'dir', dir))
	.tap(dir => Drive.findOrCreate({ mountpoint: fs.drive.mountpoint }, fs.drive)
	.tap(drive => _.set(fs, 'drive', drive))
	.tap(drive => console.verbose(`[model ${model.modelName}].post('construct'): path='${fs}' dir=${fs.dir} drive=${fs.drive}`)))
	.catch(err => { model._stats.errors.push(err); throw err; });
});

fsEntry.method('hasFileChanged', function() {
	return this.hasUpdatedSince(this.stats.mtime);
});

module.exports = mongoose.model('fs', fsEntry);

console.verbose(`FsEntry: ${inspect(module.exports)}, FsEntry.prototype: ${inspect(module.exports.prototype)}, FsEntry.schema.childSchemas=${inspect(module.exports.schema.childSchemas, { depth: 2 })}	`);	//fsEntry: ${inspect(fsEntry)}, 
