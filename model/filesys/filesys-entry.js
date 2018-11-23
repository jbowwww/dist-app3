"use strict";

const console = require('../../stdio.js').Get('model/fs-entry', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const inspectPretty = require('../utility.js').makeInspect({ depth: 2, compact: false });
// const { promisifyMethods } = require('../../utility.js');
const _ = require('lodash');
const Q = require('q');
// const { lstat } = promisifyMethods(require('fs'));
const pathSep = require('path').sep;
const mongoose = require('mongoose');
const timestampPlugin = require('../plugin/timestamp.js');
const statPlugin = require('../plugin/stat.js');
const bulkSavePlugin = require('../plugin/bulk-save.js');
const standardPlugin = require('../plugin/standard.js');
// const Disk = require('./disk.js');
// const Dir = require('./dir.js');
// const Partition = require('./partition.js');

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
	// , set: function(val) {
	// 	if (!this || (!(this instanceof mongoose.Document))) return val;	// also calls setter on find and or update ()'s'
		// Q.all([
		// 	/*
		// 	 * 181113: Issue with finding dir because Dir objects don't necessarily exist or get created before the files they contain. How to deal???
		// 	 */
		// 	Dir.findOne({ path: val.substr(0, val.lastIndexOf(pathSep)) }).then(dir => this.dir = dir),		// replace .then with .put(this, 'dir') ?
		// 	Disk.find({ /*mountpoint: { $exists: 1 }*/ }).then(disks => this.disk = _.find( _.sortBy( disks, disk => disk.mountpoint.length ), disk => val.startsWith(disk.mountpoint)))
		// ]).catch(err => {
		// 	console.warn(`fsEntry.path.set: err: ${inspect(err.stack||err)}`);
		// 	this.constructor._stats.errors.push(err);
		// }).finally(() => {
			// console.debug(`fsEntry.path.set('${val}')`);//: \n\n\t\n\tdir=${inspect(dir)}\n\n\t\n\tdisks=${inspect(disks)}\n\n\t\n\tdisk=${inspect(/*this.*/this.disk)}\n\n\t\n\tthis=${inspect(this)}`)
		// }).done();
	// 	return val;
	// } },
	dir: { type: mongoose.SchemaTypes.ObjectId, ref: 'dir' },
	disk: { type: mongoose.SchemaTypes.ObjectId, ref: 'disk' },
	// partition: { type: Partition.schema },
	stats: { type: statSchema }
	// children: [{ type: mongoose.SchemaTypes.ObjectId, ref: String, default: undefined, required: false }]
}, {
	discriminatorKey: 'fileType'
});

fsEntry.post('construct', function construct() {
	var model = this.constructor;
	const Dir = mongoose.model('dir');//.discriminator('dir');//n.constructor;
	const Disk = mongoose.model('disk');
	return Q.all([
		Dir.findOne({ path: this.path.substr(0, this.path.lastIndexOf(pathSep)) }).then(dir => {
			this.dir = dir;
			console.verbose(`[model ${model.modelName}].post('construct'): this=${inspect(this)}`);
		}),
		Disk.find({ /*mountpoint: { $exists: 1 }*/ }).then(disks => {
			this.disk = _.find( _.sortBy( disks, disk => disk.mountpoint.length ), disk => this.path.startsWith(disk.mountpoint) );
			console.verbose(`[model ${model.modelName}].post('construct')2: this=${inspect(this)}`);
			// console.debug(`fsEntry.path.set('${val}'): \n\n\t\n\tdisks=${inspect(disks)}\n\n\t\n\tdisk=${inspect(/*this.*/disk)}\n\n\t\n\tthis=${inspect(this)}`);
		})
		// 181115: TODO: This query not working 
		// Disk.aggregate([
		// 	{ $addFields: { pathStart: { $substrCP: [ this.path, 0, { $strLenCP: "$mountpoint" } ] } } },
		// 	{ $sort: { "strlen": -1 } },
		// 	{ $match: { mountpoint: "$pathStart" } },
		// 	{ $limit: 1 },
		// ]).then(disk => {
		// 	this.disk = disk && disk.length ? disk[0] : null;
		// 	console.verbose(`fsEntry.post('construct')2: this=${inspect(this)}`);
		// })
	]).then(() => { console.verbose(`[model ${model.modelName}].post('construct'): path='${this}' dir=${this.dir} disk=${this.disk}`) })
	.catch(err => { this.constructor._stats.errors.push(err); throw err; });
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
