/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
// const hashFile = require('./fs/hash.js');
// const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');
const pPipe = require('p-pipe');
const pMap = require('p-map');
const mongoose = _.assign(require('mongoose'), { Promise: Q });

const Fs = require('./model/filesys');
const { FsEntry, Disk, /*Partition,*/ File, Dir } = Fs;

	// const Disk = require('./model/filesys/disk.js');
	// const FsEntry = require('./model/filesys/filesys-entry.js');
	// const File = require('./model/filesys/file.js');
	// const Dir = require('./model/filesys/dir.js');// } = FileSys;
	// const Audio = require('./model/audio.js');
	// const Artefact = require('./Artefact.js');

var errors = [];
process.on('uncaughtException', (err) => {
  fs.writeSync(1, `process.on('uncaughtException'): ${err.stack||err}\n`);
  errors.push(err);
});
process.on('beforeExit', () => {
	if (errors && errors.length > 0) {
		fs.appendFileSync('errors.txt', errors.join('\n'));
	}
});

var searches = [
	// { path: '/mnt/Stor', maxDepth: 0 },
	// { path: '/mnt/Storage', maxDepth: 0 },
	// { path: '/media/jk/Backup/RECOVERED_FILES/mystuff/Backup', maxDepth: 0 },
	// { path: '/media/jk/My Passport', maxDepth: 0 },
	{ path: '/mnt/media', maxDepth: 1 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

var promisePipeOptions = {
	// catchErrors: function(err) { 
	// 	var d = err.promisePipeData;
	// 	var m = d.constructor;
	// 	if (m && m._stats) {
	// 		m._stats.errors.push(err);
	// 	} else {
	// 		errors.push(err);
	// 	}
	// 	console.warn(`fsIterate promisePipe error for ${d.fileType} '${d.path}':\n${err.stack||err}`);
	// }
}

var pipelines = {
	debug: tap(a => {/* a = a.file; if (!a)*/ return; console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a/*.toObject({ getters: true })*/)}\n\n!!\n`); }),
	bulkSave: a => a.bulkSave(),
	doHash: iff( a => a.file && (!a.file.hash || !a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ),
	doAudio: iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
		iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
		iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
};

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

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
 
.then(() => Disk.findOrPopulate()
.catch(err => console.warn(`Disk.findOrPopulate: ${err.stack||err}`)))

// .then(() =>/* await*/ pMap( searches, /*async */search => /*await*/
 // promisePipe(
	// promisePipeOptions, Fs.enumerate(search),
.then(() => Q.all( _.map( searches, search =>
	fsIterate(search).promisePipe(promisePipeOptions,
		fse => FsEntry.findOrCreate(fse),		// fse => FsEntry.upsert(fse) )	// can't use document instance methods or schemas, etc, is just a POJO
	fsEntry => { console.log(`fsEntry.path: '${fsEntry.path}' fileType=${fsEntry.fileType}`); return fsEntry; },
	// fsEntry => FsEntry.findOrCreate(fsEntry),
	fsEntry => fsEntry.fileType === 'dir'/*isType(Dir)*/ ? fsEntry.save() : fsEntry.bulkSave() )))) 		/*fsEntry.fileType === 'dir'*/
	
// .then(() => Q.all( _.map( searches, search =>
	// fsIterate(search).promisePipe(promisePipeOptions,
		// fse => FsEntry.findOrCreate(fse),		// fse => FsEntry.upsert(fse) )	// can't use document instance methods or schemas, etc, is just a POJO
		// fse => fse.fileType === 'dir' ? fse.save() : fse.bulkSave()
		//  ) )))

// .then(async function() {
// 	for await (const f of File.find({ hash: { $exists: false } }).cursor()) {
// 		await pipelines.doHash(f);
// 		await pipelines.bulkSave(f);
// 	}
// })

// .then(async function() {
// 	for await (const f of File.find({ hash: { $exists: false } }).cursor()) {
// 		await pipelines.doAudio(f);
// 		await pipelines.bulkSave(f);
// 	}
// })

.catch(err => console.error(`Other error: ${err.stack||err}`))

.then(() => { console.verbose(
	`mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
	`fsIterate: models[]._stats: ${JSON.stringify(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
	(errors.length > 0 ? `global errors (${errors.length}): ${inspect(errors)}\n` : '') ); })

.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.done();
