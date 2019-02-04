/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index3', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');
const mongoose = require('mongoose');	
mongoose.Promise = Q;

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');// } = FileSys;
	const Audio = require('./model/audio.js');
	const Artefact = require('./Artefact.js');

const app = require('./app.js');

var promisePipeOptions = { catchErrors: 
	// function(err) { 
	// 	var d = err.promisePipeData;
	// 	var m = d.constructor;
	// 	if (m && m._stats) {
	// 		m._stats.errors.push(err);
	// 	} else {
	// 		errors.push(err);
	// 	}
	// 	console.warn(`fsIterate promisePipe error for ${d.fileType} '${d.path}':\n${err.stack||err}`);
	// }
	app.handleError
};

// var pipelines = require('./pipelines.js');

// New idea - use Artefact to define promise pipes, something like:
// Artefact.pipeFrom(fsIterate(search), )
// or maybe
//
// fsIterate.pipe(FsEntry.artefactPipe({
//	 [pipeline ops...]
// ))
//
// ..yeah fuck i dunno haha
// but see if you can clean up this syntax a bit by putting it into Artefact
// and combine that with (optionally?) specifying extra types to include in the artefact
// (artefact still needs an initial mongo doc (newly created or retrieved) to go and find other types associated with the artefact)
// (how to map dependencies/ordering of type construction in artefacts? e.g. file -> audio -> sample)
 
// .then(() => Disk.findOrPopulate()
// .catch(err => console.warn(`Disk.findOrPopulate: ${err.stack||err}`)))

app.dbConnect()
// mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

// .then(() => Q.all( _.map( searches, search =>
// 	fsIterate(search).promisePipe(promisePipeOptions,
// 		fse => FsEntry.findOrCreate(fse),						// fse => FsEntry.upsert(fse) )	// can't use document instance methods or schemas, etc, is just a POJO
// 		fse => { console.log(`fse.path: '${fse.path}'`); return fse; },
// 		fse => fse.fileType === 'dir' ? fse.save() : fse.bulkSave()
// 	) )))

.then(() => {
	return Q(File.find({})/*.exec()*//*.cursor()*/).then(entries => {
		console.log(`entries: ${inspect(entries)}`);
	})
})
.then(() => {
	var w = File.watch([
		// { $match: { operation: "insert", hash: null  } }
	]).on('change', change => {
		console.log(`change: insert: _id=${change.documentKey}`);
	}).on('error', err => console.error(`Other error: ${err.stack||err}`));
	// while (!w.isExhausted()) {
	// 	if (w.hasNext()) {
	// 		console.log(`next: ${inspect(next)}`);
	// 	}
	// }
})
.catch(err => console.error(`Other error: ${err.stack||err}`))

.done();

// (function looper() { return Q.delay(1000).then(looper); })();



// .then(() => promisePipe(promisePipeOptions,
// 	File.find({ hash: { $exists: false } }).cursor(),
// 	f => f.getArtefact(),
// 	pipelines.doHash,
// 	pipelines.debug,
	// pipelines.bulkSave))

// .then(async function() {
// 	for await (const f of File.find({ hash: { $exists: false } }).cursor()) {
// 		await pipelines.doAudio(f);
// 		await pipelines.bulkSave(f);
// 	}
// })


// .then(doStats)
// .then(doCloseDb);
