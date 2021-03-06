/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member
 * functions and data properties on embedded document schemas.
 * Simplicity will be a focus on this version, not just technically but conceptually..
 *	- No overall, all-encompassing, universal container "artefact" type to speak of - not like dist-app2
 *		181028: This is not true now :) 
 *	- Any document model may reference another as required, whether its conceptually inheriting, containing, or referencing the referenced type,
 *	  but does so directly and explicitly in it's own terms
 *	- In such cases I think document IDs and mongoose populate() will be used, although not 100% decided here yet */

"use strict";

const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const util = require('util');
const _ = require('lodash');
const mongoose = require('./mongoose.js');
const Q = require('q');

const fsIterate = require('./fs/iterate.js');
const hashFile = require('./fs/hash.js');

const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, conditionalPipe, streamPromise }  = require('./promise-pipe.js');

var hashPaths = [];
var hpInterval = setInterval(() => console.verbose(`hashPaths: ${inspect(hashPaths)}`), 10000);

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })
	
.then(() => promisePipe({ concurrency: 8 },
	File.getArtefacts({ path: { $regex: /^.*\.(wav|mp3|au|flac)$/i } }, { meta: {
	audio: conditionalPipe( 
		audio => !audio.isCheckedSince(audio._artefact.file._ts.updatedAt),
		audio => {
			hashPaths.push(audio._artefact.file);
			console.verbose(`hashPaths: ${inspect(hashPaths)}`);
			return audio.loadMetadata(audio._artefact.file)
			.finally(() => { _.remove(hashPaths, file => file.equals(audio._artefact.file)) });
		} ) } } ),
	a => {
		console.verbose(`a: ${inspect(a)}`);
		return a.bulkSave()
		} 				) )

.delay(10000)

.catch(err => { console.error(`error: ${err.stack||err}`); })

.finally(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.finally(() => { 
	console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`);
	if (hpInterval) {
		clearInterval(hpInterval);
		hpInterval = null;
	}
})

.done();
