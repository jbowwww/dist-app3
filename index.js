
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
// const util = require('util');
const _ = require('lodash');
// const fs = require('fs');
// const nodePath = require('path');
const mongoose = require('./mongoose.js');
const Q = require('q');

const fsIterate = require('./fs/iterate.js');
const hashFile = require('./fs/hash.js');

const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');
const { promisePipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, conditionalPipe, streamPromise }  = require('./promise-pipe.js');
const pEvent = require('p-event');
const mm = require('music-metadata');

// 181022: Tried hooking into mongoose's middlewares for this logic but it's just awkward and unreliable and unclear
// I *think* I'm better off keeping the three distinct phases to data creation somewhat separate in 3 different promises, below
// it sort of decouples the process a bit and hopefully makes it more tolerant incase some data is incomplete or process previously got interruipted

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then(() => 

	promisePipe(	fsIterate({ path: '/media/jk/Stor/mystuff/Moozik/samples/', maxDepth: 4 }),
					fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry) ,
					fsEntry => fsEntry.save())//bulkSave()							)

)/*.delay(1200)*/.then(() => 

	promisePipe(	File.find().cursor(),
					file => file.ensureCurrentHash(),
					file => file.bulkSave()									)

)/*.delay(1200)*/.then(() => 

	// 181022: OK so I think I've got it basically saving the assocaited types (file/audio) together in one object,
	// but retrieved from two differemt DN collections. The only issue is that this code  is handling both the intial creation
	// of each artefact and the case where it already has the audio artefact loaded in the db, so it doesnt automatically go
	// populating from the datbase unless the regex is first matched. To do this i think you will need either a preset list of
	// models (e.g. mongoose.models) to search for the file._id (hey this option might be better and/or easier actually) ..
	// .. or you could store some sort of array of model names stored in each file document that have data for that artefact.. (sounds messy) 
	// Right! did that all make sense ^ ? 
	
	promisePipe(	File.find({ path: { $regex: /^.*\.(wav|mp3|au|flac)$/i } }).cursor(),
					file => Audio.findOrCreate({ fileId: file._id }).then(
						audio => { Object.defineProperty(file, 'audio', { value: audio }); return file; })	,//_.assign(file, { audio })),
					conditionalPipe(
						file => file.audio.isNew || (file.audio._ts.checkedAt < file.stats.mtime || file.audio._ts.checkedAt < (new Date())),
						file => { console.log(`ol ye file: keys: ${_.keys(file)}`); return file.audio.loadMetadata(file).then(() => file) },
						file => file.audio.save() ) ) 
// 					file => file.bulkSave()									)

).catch(err => { console.error(`error: ${err.stack||err}`); })
.then(() => Q.delay(18000))
// .then(() => mongoose.connection.whenIdle())
.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))
.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`); })
.done();
