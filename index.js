
/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas.
 * Simplicity will be a focus on this version, not just technically but conceptually..
 *	- No overall, all-encompassing, universal container "artefact" type to speak of - not like dist-app2
 *		181028: This is not true now :) 
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
const mongoose = require('./mongoose.js');
const Q = require('q');

const fsIterate = require('./fs/iterate.js');
const hashFile = require('./fs/hash.js');

const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, conditionalPipe, streamPromise }  = require('./promise-pipe.js');

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then(() => 

	promisePipe(	fsIterate({ path: '/media/jk/Stor/mystuff/Moozik/samples/', maxDepth: 4 }),
					fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry) ,
					fsEntry => fsEntry.bulkSave())//.save()							)

)/*.delay(1200)*/.then(() => 

	promisePipe(	File.find().cursor(),
					file => file.ensureCurrentHash(),
					file => file.bulkSave()									)

)/*.delay(1200)*/.then(() => 

	promisePipe(	File.getArtefacts({ path: { $regex: /^.*\.(wav|mp3|au|flac)$/i } }, { meta: {
		audio: a => artefactDataPipe(a, a.audio,
			conditionalPipe( 
				audio => audio.isNew || audio._ts.checkedAt < a.file.stats.mtime || a.audio._ts.checkedAt < new Date(),
				audio => audio.loadMetadata(a.file))) } }),
		a => a.bulkSave() )
	
).catch(err => { console.error(`error: ${err.stack||err}`); })
// .then(() => Q.delay(18000))
// .then(() => mongoose.connection.whenIdle())
.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))
.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`); })
.done();
