/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
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

var errors = [];
process.on('uncaughtException', (err) => {
  fs.writeSync(1, `process.on('uncaughtException'): ${err.stack||err}\n`);
  errors.push(err);
});
process.on('beforeExit', () => {
	if (errors && errors.length > 0) {
		fs.writeSync(fs.createWriteStream('errors.txt', errors.join('\n')));
	}
});

var searches = [
	// { path: '/mnt/Stor', maxDepth: 0 },
	// { path: '/mnt/Storage', maxDepth: 0 },
	// { path: '/media/jk/Backup/RECOVERED_FILES/mystuff/Backup', maxDepth: 0 },
	// { path: '/media/jk/My Passport', maxDepth: 0 },
	{ path: '/home/jk', maxDepth: 1 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

var pipelines = {
	debug: tap(a => { a = a.file; if (!a) return; console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a/*.toObject({ getters: true })*/)}\n\n!!\n`); }),
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
 
.then(() => Disk.findOrPopulate())// .catch(err => console.warn(`Disk.findOrPopulate: ${err.stack||err}`)))

// .delay(2000)

.then(() => Q.all(_.map(searches, search => fsIterate(search).promisePipe(
	// pipelines.debug,
	f => FsEntry.findOrCreate(/*{ path: f.path },*/ f/*, { saveImmediate: f.fileType === 'dir' }*/),
	f => Artefact(f),
	pipelines.doHash,			// pipelines.debug,
	pipelines.doAudio,			//pipelines.debug,
	// pipelines.debug,
	pipelines.bulkSave
	// pipelines.debug
)
.catch(err => console.warn(`Err: ${err.stack||err}`)))))

.delay(1500)
.then(() => { console.verbose(`mongoose.models count=${_.keys(mongoose/*.connection*/.models).length} names=${mongoose/*.connection*/.modelNames().join(', ')}`); })
.then(() => Q.all(_.map(mongoose/*.connection*/.models, m => (m._bulkSaveDeferredAccum ? m._bulkSaveDeferredAccum : Q())
	.tap(() => console.verbose(`[model ${m.modelName}]._bulkSaveDeferredAccum done`)))))
.then(bulkSaveDeferreds => { console.verbose(`mongoose bulkSaveDeferreds.length=${bulkSaveDeferreds.length}`); })
.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.then(() => { console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose/*.connection*/.models, (model, modelName) => (model._stats)))}`); })

.catch(err => console.error(`Err: ${err.stack||err}`))

.done();
