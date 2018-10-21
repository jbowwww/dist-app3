
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

// console.verbose(`Audio: ${inspect(Audio)}`);

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true }).then(() => 

	// chainPromiseFuncs(

		streamPromise(
			fsIterate({
				path: '/media/jk/Stor/mystuff/Moozik/samples/',
				maxDepth: 4 /*'/home/jk', maxDepth: 5*/
			}).pipe(writeablePromiseStream(
				fsEntry => FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry),
				fsEntry => fsEntry.bulkSave()
			))
		),
)/*.delay(1200)*/.then(() => 
	streamPromise(
		File.find().cursor().pipe(writeablePromiseStream(
		conditionalPipe(
			fsEntry => fsEntry.fileType === 'file',
			chainPromiseFuncs(
				file => file.ensureCurrentHash(),
				file => file.bulkSave()
			)
		)
	)))
)/*.delay(1200)*/.then(() => 

// console.verbose(`test`);
	streamPromise(
		File.find({
			path: { $regex: /^.*\.(wav|mp3|au|flac)$/i }
		}).cursor().pipe(writeablePromiseStream(
			// chainPromiseFuncs(
			// nestPromiseFuncs(
			file => Audio.findOrCreate({ fileId: file._id }).then(
				chainPromiseFuncs(
					conditionalPipe(
						audio => audio.isNew || (audio._ts.checkedAt < file.stats.mtime || audio._ts.checkedAt < (new Date())),
						chainPromiseFuncs(
							audio => audio.loadMetadata(file),
							audio => audio.bulkSave()
						)
					),
					audio => {
						_.assign(file, { audio });
						console.verbose(`file: ${inspect(file)}`);
						return file;
					}
				)
			),
			file => file.bulkSave(),
			file => { console.verbose(`file: ${inspect(file)}`); return file; }
		))
	)
)

//> db.fs.aggregate([{$lookup:{from:"audios", localField:"_id", foreignField:"fileId", as: "audio"}},{$unwind:"$audio"}]).pretty()


// .then(() => promisePipe(
// 	File.find({ path: { $regex: /.*\.(wav|au|mp3|flac)$/i } }).cursor(),
// 		file => Audio.find({ fileId: file._id }).then(audio => {
// 			console.log(`audio: ${inspect(audio)}`);
// 			if (_.isArray(audio)) audio = audio[0];
// 			if (!audio) audio = new Audio({ fileId : file._id});
// 			if (audio.isNew || (audio._ts.checkedAt < file.stats.mtime || audio._ts.checkedAt < (new Date()))) {
// 				console.verbose(`Audio.loadMetadata on '${file.path}' (${file.id})`);
// 				audio.loadMetadata(file);
// 			}
// 		}).then(audio => audio.bulkSave())
// ))
.catch(err => { console.error(`error: ${err.stack||err}`); })
.then(() => Q.delay(1000))
.then(() => mongoose.connection.whenIdle())
.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))
.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`); })
.done();
