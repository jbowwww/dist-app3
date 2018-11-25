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

fsEntry.post('construct', async function construct(fs) {
	var model = this;
	const Dir = mongoose.model('dir');
	const Drive = mongoose.model('drive');
	const dirPath = fs.dir ? fs.dir.path : nodePath.dirname(fs.path);
	console.verbose(`[model ${model.modelName}].post('construct'): path='${inspect(fs)}' dirPath=${dirPath}`);

	try {
		if (dirPath === fs.path) {
			fs.dir = null;
		} else if (!(fs.dir instanceof mongoose.Document)) {
			await Dir.findOrCreate({ path: dirPath }, fs.dir || { path: dirPath, stats: nodeFs.lstatSync(dirPath) }, { saveImmediate: true })
			.tap(dir => fs.dir = dir)//_.set(fs, 'dir', dir))
			// .tap(dir => dir.save());
		}
		if (!fs.drive) {
			await Drive.find({}).then(drives => {
				fs.drive = /*_.set*/(/*fs, 'drive',*/ _.find(_.reverse(_.sortBy(_.filter(drives,
							drive => drive.mountpoint),
						drive => drive.mountpoint.length)),
					drive => fs.path.startsWith(drive.mountpoint)));
			});
		} else if (!(fs.drive instanceof mongoose.Document)) {
			await Drive.findOrCreate({ mountpoint: fs.drive.mountpoint }, fs.drive, { saveImmediate: true })
			.tap(drive => fs.drive = drive)// _.set(fs, 'drive', drive))
			// .tap(drive => drive.save());
		}
		console.verbose(`[model ${model.modelName}].post('construct'): path='${fs}' dir=${fs.dir} drive=${fs.drive}`)
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
