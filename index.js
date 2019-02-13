/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');	
mongoose.Promise = Q;
const PromisePipe = require('./promise-pipe.js');
const pEvent = require('p-event');
const pMap = require('p-map');
const stream = require('stream');
stream.finished = util.promisify(stream.finished);
const through2Concurrent = require('through2-concurrent');

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');// } = FileSys;
	const Audio = require('./model/audio.js');

var searches = [
	// { path: '/mnt/Stor', maxDepth: 0 },
	// { path: '/mnt/Storage', maxDepth: 0 },
	// { path: '/media/jk/Backup/RECOVERED_FILES/mystuff/Backup', maxDepth: 0 },
	// { path: '/media/jk/My Passport', maxDepth: 0 },
	{ path: '/mnt/media', maxDepth: 2 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

const app = require('./app.js');
var promisePipeOptions = { catchErrors: app.onError };
/* var pipelines = require('./pipelines.js');
 * var pipelines = {
 * 	debug: tap(a => { console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a)}\n\n!!\n`); }),
 * 	bulkSave: a => a.bulkSave(),
 * 	doHash: iff( a => a.file && (!a.file.hash || !a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ),
 * 	doAudio: iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
 * 		iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
 * 		iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
 * };
 */
/* New idea - use Artefact to define promise pipes, something like:
 * Artefact.pipeFrom(fsIterate(search), )
 * or maybe
 *
 * fsIterate.pipe(FsEntry.artefactPipe({
 *	 [pipeline ops...]
 * ))
 *
 * ..yeah fuck i dunno haha
 * but see if you can clean up this syntax a bit by putting it into Artefact
 * and combine that with (optionally?) specifying extra types to include in the artefact
 * (artefact still needs an initial mongo doc (newly created or retrieved) to go and find other types associated with the artefact)
 * (how to map dependencies/ordering of type construction in artefacts? e.g. file -> audio -> sample)
 */


app.dbConnect()
.then(() => Disk.findOrPopulate())
.then(async () => Q.all( _.map( searches, async search => {
	
	// stream.finishedpEvent(fsIterate(search).pipe(
		// PromisePipe({ concurrency: 1 },

		for await (let f of fsIterate(search)) {
			f = await FsEntry.findOrCreate(f);
			console.log(`f.path: '${f.path}'`);
			await (f.fileType === 'dir' ? f.save() : f.bulkSave());
		}
		// ).stream() ), 'finish') )))
})))
	// for /*await */(var fse of fsIterate(search)) {
	// 	await FsEntry.findOrCreate(fse);		// fse => FsEntry.upsert(fse) )	// can't use document instance methods or schemas, etc, is just a POJO
	// 	console.log(`fse.path: '${fse.path}'`);
	// 	await fse.fileType === 'dir' ? fse.save() : fse.bulkSave()
	// }

// .then(async function() {
// 	for await (let f of await File.find({ hash: { $exists: false } }).cursor()) {	//iter()) {
// 		// await pipelines.doHash(f);
// 		 console.verbose(`f=${inspect(f)}`);
// 		await Q.delay(88);
// 		// await pipelines.bulkSave(f);
// 	}
// })

// .then(() => {
// 	return Q(FsEntry.find({})/*.exec()*//*.cursor()*/).then(entries => {
// 		console.log(`entries: ${inspect(entries)}`);
// 	})
// })

// .then(async function() {
// 	for await (const f of File.find({ hash: { $exists: false } }).cursor()) {
// 		await pipelines.doAudio(f);
// 		await pipelines.bulkSave(f);
// 	}
// })

// .then(() => { console.verbose(
// 	`mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
// 	`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
// 	(errors.length > 0 ? `global errors (${errors.length}): ${inspect(errors)}\n` : '') ); })

// .then(() => mongoose.connection.close()
// 	.then(() => { console.log(`mongoose.connection closed`); })
// 	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.catch(err => console.error(`Other error: ${err.stack||inspect(err)}`))
.then(() => app.quit())
.done();
