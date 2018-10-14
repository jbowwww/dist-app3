"use strict";
const console = require('../../stdio.js').Get('model/file', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const hashFile = require('../../fs/hash.js');
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
const FsEntry = require('./filesys-entry.js');

let file = new mongoose.Schema({
	hash: { type: String, required: false }
});

// file.plugin(require('./plugin/timestamp.js'));

// file.plugin(timestampPlugin);
// file.plugin(require('./plugin/standard.js'));
// file.plugin(require('./plugin/bulk-save.js'));
file.plugin(require('../plugin/stat.js'), { data: { ensureCurrentHash: {} } });

// Will this be useful? Bevcause I believe virtuals cannot be used in a mongo query
file.virtual('extension').get(function extension() {
	var n = this.path.lastIndexOf('.');
	var n2 = Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\'));
	return (n < 0 || (n2 > 0 && n2 > n)) ? '' : this.path.slice(n + 1);
});

file.query.hasHash = function() { return this.exists('hash'); };

// var stats = {};	// very temporary hack/fix

/* Ensures the file doc ('this') has a hash value, and that the doc's updatedAt is more recent than the file's mtime ('stats.mtime')
 * returns: the file/this, with hash calculated
 */
file.methods.ensureCurrentHash = function(cb) {
	var file = this;
	var model = this.constructor;
	var debugPrefix = `[${typeof model} ${model.modelName}]`;
	model._stats.ensureCurrentHash.calls++;
	console.debug(`${debugPrefix}.ensureCurrentHash():  file='${file.path}'`);// this.constructor=${this.constructor} this.constructor.prototype=${this.constructor.prototype}`)
	// if (file.fileType !== 'file') {		// ensure is an actual file and nota dir or 'unknown' or otherwise
	// 	console.warn(`${debugPrefix}.ensureCurrentHash() called for ${model.name} data with fileType='${file.fileType}', should only be called for files!`);
	// }
	return Q.Promise((resolve, reject, notify) => {
		var oldHash = file.hash;
		console.debug(`${debugPrefix}.ensureCurrentHash: file='${file.path}' modifiedPaths=${file.modifiedPaths().join(' ')} tsu=${file._ts.updatedAt} mtime=${file.stats.mtime} tsu-mtime=${file._ts.updatedAt - file.stats.mtime}`);
		if (!oldHash || !file._ts.updatedAt || file.isModified('stats.mtime') || (file._ts.updatedAt < (file.stats.mtime))) {
			if (!oldHash) { console.debug(`${debugPrefix}.ensureCurrentHash: file='${file.path}' undefined file.hash, hashing...`); }
			else { console.debug(`${debugPrefix}.ensureCurrentHash: file='${file.path}' outdated file.hash=..${file.hash.substr(-6)}, hashing...`); }
			// return model._hashQueue.push(file).then(file => { if (cb) cb(null, file); return file; });
			/*return*/ hashFile(file.path).then((hash) => {
				model._stats.ensureCurrentHash.success++;
				if (!oldHash) { model._stats.ensureCurrentHash.created++; }
				else { model._stats.ensureCurrentHash.updated++; }
				file.hash = hash;
				console.debug(`${debugPrefix}.ensureCurrentHash: file='${file.path}' computed file.hash=..${hash.substr(-6)}`);
				resolve (file);
				// return file;
			})
			.catch(err => ensureCurrentHashHandleError(err, 'hash error', reject))
			.done();
		} else {
			model._stats.ensureCurrentHash.success++;
			model._stats.ensureCurrentHash.checked++;
			console.debug(`${debugPrefix}.ensureCurrentHash: file='${file.path}' current file.hash=..${file.hash.substr(-6)}, no action required`);
			resolve(file);
			// return file;
		}
	});

	function ensureCurrentHashHandleError(err, prefix, cb) {
		if (typeof prefix === 'function') {
			cb = prefix;
			prefix = 'Error';
		}
		console.warn(prefix + ': ' + err);//.stack||err.message||err);
		model._stats.ensureCurrentHash.errors.push(err);
		if (cb) process.nextTick(() => cb(err));
	}
};

/* 1612949298: TOOD: instead of storing raw aggregation operation pipeline arrays, if you could somehow hijack/override the Aggregate(?) returned by
 * model.aggregate, and set its prototype to a new object that contains functions of the same names as below, and inherits from the original
 * prototype of the Aggregate object. The funcs can then take parameters too (e.g. sizeMoreThan(1024) or duplicates({minimumGroupSize: 3})) and gives
 * a nice intuitive syntax with method chaining, like :
 * models.fs.file.aggregate.match({path: / *regex to match e.g. video extensions like mpg * /}).groupBySizeAndHash().minimumDuplicateCount(2)
*/
file.aggregates = {
	match(query) {
		return [ { $match: query } ];
	},
	matchExtension(extension) {
		return [ { $match: { path: new RegExp(`^.*\.${extension}+$`) } } ];
	},
	groupBySizeAndHash() {
		return [		 /* , path: /^\/mnt\/wheel\/Trapdoor\/media\/.*$/ } */
			{ $match: { hash: { $exists : 1 }, deletedAt: { $exists: 0 }, 'stats.size': { $gt: 1024*1024 } } },
			{ $group : { '_id':{'size': '$stats.size', 'hash': '$hash'}, paths: { $push: "$path" }, groupSize: { $sum: "$stats.size" }, count: { $sum: 1 } } }
		];
	},
	duplicates() {
		return this.groupBySizeAndHash().concat([
			{ $match: { "count" : { $gt: 1 }, groupSize: { $gt: 1024*1024 } } },
			{ $sort: { "groupSize": -1 } }
		]);
	},
	duplicatesSummary() {
		return [
			{ $match: {  path: /^.*\.(avi|mpg|mpeg|mov|wmv|divx|mp4|flv|mkv|zip|rar|r[0-9]{2}|tar\.gz|iso|img|part|wav|au|flac|ogg|mp3)$/ig,    hash: { $ne : null } } },
			{ $group : { '_id':{'size': '$stats.size', 'hash': '$hash'}, paths: { $push: "$path" }, groupSize: { $sum: "$stats.size" }, count: { $sum: 1 } } },
			{ $match: { "count" : { $gt: 1 } } },
		  { $group: { _id: null, totalSize: { $sum: { $divide: [ '$groupSize', 1024*1024*1024 ] } }, totalCount: { $sum: "$count" }, totalGroups: {$sum: 1} } },
		  { $project: { totalSize: { $concat: [{ $substr: ['$totalSize', 0, 100 ]}, ' GB' ] }, totalCount: '$totalCount', totalGroups: '$totalGroups', avgGroupSize: {$concat: [ { $substr: [{ $divide: [ '$totalSize', '$totalGroups' ] }, 0, 10] }, ' GB']} } }
	  	];
	}
};

// file.plugin(require('./plugin/timestamp.js'));
// file.plugin(require('./plugin/standard.js'));
// file.plugin(require('./plugin/bulk-save.js'));
// file.plugin(require('./plugin/stat.js'));

// file.on('init', model => {
// 	Object.defineProperty(model, 'options', { value: {

// 	}})
// });
module.exports = FsEntry.discriminator('file', file);