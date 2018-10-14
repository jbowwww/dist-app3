
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
const promisePipe = require('./promise-pipe.js');
const pEvent = require('p-event');
const fsIterate = require('./fs/iterate.js');
const FsEntry = require('./model/fs-entry.js');
const File = require('./model/file.js');
const Dir = require('./model/dir.js');
const hashFile = require('./fs/hash.js');

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then((...args) => {
	console.debug(`mongoose.connect.then: args=${inspect(args)}`);
})
.then(() =>	promisePipe(fsIterate({ path: '/home/jk', maxDepth: 2 }), [
	fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry),
	// promisePipe.conditional(fsEntry => fsEntry.fileType === 'file', fsEntry => fsEntry.ensureCurrentHash()),
	fsEntry => fsEntry.fileType === 'file' ? fsEntry.ensureCurrentHash() : fsEntry,
	fsEntry => fsEntry.bulkSave()
]))
.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`); })
.then(() => mongoose.connection.close())
.then(() => { console.log(`mongoose.connection closed`); })
.catch(err => { console.error(`error: ${err.stack||err}`); })
.done();
