
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

const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, breakLength: 0, compact: false });
// const util = require('util');
const _ = require('lodash');
// const fs = require('fs');
// const nodePath = require('path');
const mongoose = require('./mongoose.js');

const fsIterate = require('./fs/iterate.js');
const hashFile = require('./fs/hash.js');

const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');
const { promisePipe, chainPromiseFuncs }  = require('./promise-pipe.js');
const pEvent = require('p-event');
const mm = require('music-metadata');

console.verbose(`Audio: ${inspect(Audio)}`);

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then((...args) => {
	console.debug(`mongoose.connect.then: args=${inspect(args)}`);
})
.then(() => promisePipe(
	fsIterate({ path: '/media/jk/Stor/mystuff/Moozik/samples/', maxDepth: 4 /*'/home/jk', maxDepth: 5*/ }), [
		fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry),
		fsEntry => fsEntry.fileType === 'file' ? fsEntry.ensureCurrentHash() : fsEntry,
		fsEntry => fsEntry.bulkSave(),
		fsEntry => fsEntry.children.push()
	]
))
.then(() => promisePipe(
	File.find({ path: { $regex: /.*\.(wav|au|mp3|flac)$/i } }).cursor(), [
		file => mm.parseFile(file.path).then(
			metadata => Audio.create({ fileId: file._id, length: 1, metadata }).then(
				audio => { file.children.push(/*{ child:*/ audio/*._id, ref: 'Audio' }*/); return file; })),
		file => { console.log(`file: ${inspect(file)}`); return file.bulkSave(); },
		// metadata => { console.log(`metadata: ${inspect(metadata)}`); }
		// audio => { console.log(`Audio file found: ${typeof audio} ${audio.constructor.name} ${inspect(audio)}`); return audio; } 
	]
))
.catch(err => { console.error(`error: ${err.stack||err}`); })
.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`); })
.then(() =>
	mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); })
)
.done();
