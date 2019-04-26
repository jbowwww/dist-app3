"use strict";
const console = require('../../stdio.js').Get('model/filesys/file', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 2, compact: false /* true */ });
const inspectPretty = require('../../utility.js').makeInspect({ depth: 2, compact: false });
const hashFile = require('../../fs/hash.js');
const _ = require('lodash');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
const FsEntry = mongoose.model('fs'); //require('./filesys-entry.js');

let file = new mongoose.Schema({
	hash: { type: String, /*default: '',*/ required: false },
	hashUpdated: { type: Date, /*default: 0,*/ required: false }
});

file.plugin(require('../plugin/stat.js'), [ 'doHash' ]);

// file.post('save', async function() {
// 	var model = this.constructor;
// 	var debugPrefix = `[doc ${model.modelName}]`;//`[${typeof model} ${model.modelName}]`;
// 	console.verbose(`${debugPrefix}.post('save'): this=[${typeof this}] ${inspect(this, { compact: true })}`);
// 	if (!this.exists('hash')/*!this.hash*/ || this.hashUpdated < this._ts.checkedAt) {
// 		return this.doHash()
// 		.tap(f => console.verbose(`${debugPrefix}.pre('validate'): this.hash=...${this.hash.substr(-6)}`))
// 		.catch(e => { console.warn(`${debugPrefix}.pre('validate'): error: ${err.stack||err}`); model._stats.errors.push(e); })
// 	} else { 
// 		console.verbose(`${debugPrefix}.pre('validate'): this.hash already current (=...${this.hash.substr(-6)})`);
// 		return Q(this);
// 	}
// });

// Will this be useful? Bevcause I believe virtuals cannot be used in a mongo query
file.virtual('extension').get(function extension() {
	if (!this.path) {
		return '';
	}
	var n = this.path.lastIndexOf('.');
	var n2 = Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\'));
	return (n < 0 || (n2 > 0 && n2 > n)) ? '' : this.path.slice(n + 1);
});

file.method('doHash', function doHash() {
	var file = this;
	var model = this.constructor;
	var debugPrefix = `[${typeof model} ${model.modelName}]`;
	// console.verbose(`${debugPrefix}.doHash: model=${inspect(model, { compact: false })}`);
	model._stats.doHash.calls++;
	return hashFile(file.path).then((hash) => {
		model._stats.doHash.success++;
		if (!file.hash) { model._stats.doHash.created++; }
		else { model._stats.doHash.updated++; }
		file.hash = hash;
		file.hashUpdated = Date.now();
		console.verbose(`${debugPrefix}.doHash(): file='${file.path}' computed file.hash=..${hash.substr(-6)}`);
		return file;
	}).catch(err => {
		model._stats.doHash.errors.push(err);
		console.warn(`${debugPrefix}.doHash(): file='${file.path}' error: ${/*err.stack||*/err}`);
		// return file;	// should i really actually be catching an err then returning file like nothing happened??
		// TODO: All errors should get logged to the db, probably in a dedicated errors collection. In that case maybe set .hash to something like 'Error: ${error._id}'
		throw err;	// for now pretending to have not intercepted it (now file.pre('validate' is catching it, for now) )
	});	
});

file.query.hasHash = function() { return this.exists('hash'); };

file.query.doHashes = async function(rehashAll = false) {
	var query = this;
	var model = query.model;
	var debugPrefix = `[${typeof model} ${model.modelName}]`;
	var hashedCount = await query.count({ hash: { $exists: true } });
	var unhashedCount = await query.count({ hash: { $exists: false } });
	var count = hashedCount + unhashedCount; 
	console.verbose(`${debugPrefix}.doHashes: query(${count} docs, ${hashedCount} hashed, ${unhashedCount} not)=${inspect(query, { comapct: false })} this=${inspect(this)}`);// this.map=${inspect(mongoose.Query.prototype.map)}`);
	var i = 0;
	// for await (let f of query.cursor()) {
	return this.map(async f => {
		console.debug(`${debugPrefix}.doHashes: [${typeof f} f]=${inspect(f, { compact: false })}`);
		if (rehashAll || !f.hash) {
			console.verbose(`${debugPrefix}.doHash: model=${inspect(model, { compact: false })}`);
			await f.doHash();
		}
		if (f.hash) {
			i++;
		} else {
			console.warn(`${debugPrefix}.doHashes: no hash for f.path='${f.path}'`);
		}
		f.bulkSave();
	});
	// console.verbose(`${debugPrefix}.doHashes: calculated ${i} new hashes`);
	// return this;
}

/* 1612949298: TOOD: instead of storing raw aggregation operation pipeline arrays, if you could somehow hijack/override the Aggregate(?) returned by
 * model.aggregate, and set its prototype to a new object that contains functions of the same names as below, and inherits from the original
 * prototype of the Aggregate object. The funcs can then take parameters too (e.g. sizeMoreThan(1024) or duplicates({minimumGroupSize: 3})) and gives
 * a nice intuitive syntax with method chaining, like :
 * models.fs.file.aggregate.match({path: / *regex to match e.g. video extensions like mpg * /}).groupBySizeAndHash().minimumDuplicateCount(2) */
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

module.exports = FsEntry.discriminator('file', file);

console.debug(`File: ${inspect(module.exports)}, File.prototype: ${inspect(module.exports.prototype)}`);
