
/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas.
 * Simplicity will be a focus on this version, not just technically but conceptually..
 *	- No overall, all-encompassing, universal container "artefact" type to speak of - not like dist-app2
 *	- Any document model may reference another as required, whether its conceptually inheriting, containing, or referencing the referenced type,
 *	  but does so directly and explicitly in it's own terms
 *	- In such cases I think document IDs and mongoose populate() will be used, although not 100% decided here yet
 */

// Don't know what if anything to actually put in this file just seemed a good place to put a quick readme in

"use strict";

const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, breakLength: 0, compact: false });
const util = require('util');
const _ = require('lodash');
const fs = require('fs');
const nodePath = require('path');
const Q = require('q');
Q.longStackSupport = true;
const mongoose = require('mongoose');
mongoose.Promise = Q;
const sourcePipe = require('./source-pipe.js');
const fsIterate = require('./fs/iterate.js');
const FsEntry = require('./model/fs-entry.js');
const File = require('./model/file.js');
const Dir = require('./model/dir.js');

var stats = { dirs: 0, files: 0 };
const debug = (prefix, obj) => {
	// obj.test();
	console.verbose(prefix + ': ' + typeof obj + ' ' 
		+ (obj.modelName ? obj.modelName : obj.constructor && obj.constructor.name ? obj.constructor.name : '') 
		+ inspect(obj));
};

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then((...args) => {
	console.debug(`mongoose.connect.then: args=${inspect(args)}`);
}).then(() => {
	sourcePipe(fsIterate({
		path: '/home/jk',
		maxDepth: 1,
		// includeTopLevelDirectory: false,
		// dirHandler(dir) { debug('dir', dir); stats.dirs++; dir.bulkSave(); /*dir.save();*/ },
		// fileHandler(file) { debug('file', file); stats.files++; file.bulkSave(); /*file.save();*/ },
		// errHandler(err) { console.error(`error: ${err.stack||err}`); }
	}), [ 
		
		// fsEntry => {
		// 	switch(fsEntry.fileType) {
		// 		case 'dir': return Dir.findOrCreate({ path: fsEntry.Path }, fsEntry);
		// 		case 'file': return File.findOrCreate({ path: fsEntry.Path }, fsEntry);
		// 		default: console.warn(`fsIterate: Unknown fsEntry type for path '${fsEntry.path}'`);
		// 	}
		// }, 
		// fsEntry =>  {
		// 	console.debug(`fsEntry: ${typeof fsEntry} (doc=${fsEntry instanceof mongoose.Document}) type=${fsEntry.constructor.name}: ${inspect(fsEntry)}`);
		// 	return fsEntry.bulkSave();
		// }

		// fsEntry => { console.debug(`fsEntry: ${typeof fsEntry} ${fsEntry instanceof mongoose.Document} ${inspect(fsEntry/*mongoose.Document.prototype*/)}`); debug(fsEntry.fileType, fsEntry); return fsEntry; },
		fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry),
		// fsEntry => { console.debug(`fsEntry: ${typeof fsEntry} ${fsEntry instanceof mongoose.Document} ${inspect(fsEntry/*mongoose.Document.prototype*/)}`); debug(fsEntry.fileType, fsEntry); return fsEntry; },
		fsEntry => fsEntry./*constructor.model(fsEntry.fileType).*/bulkSave()
	]).then(() => {
		console.log(`fsIterate: ${inspect(stats)}\nmodels[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`);
		return mongoose.connection.close();
	}).catch(err => console.error(`error: ${err.stack||err}`))
}).done();
