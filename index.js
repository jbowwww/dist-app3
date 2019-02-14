
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

const app = require('./app.js');

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');
	const Audio = require('./model/audio.js');

var searches = [
	{ path: '/mnt/media', maxDepth: 2 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];


await app.dbConnect();

await Disk.findOrPopulate());
await Q.all( _.map( searches, async search => {
	for await (let f of fsIterate(search)) {
		f = await FsEntry.findOrCreate(f);
		console.log(`f.path: '${f.path}'`);
		await (f.fileType === 'dir' ? f.save() : f.bulkSave());
	}
})));

// another possibility, that could allow for timing, debug/stats, etc
// await app.run( Disk.findOrPopulate() );
// await app.run( Q.all( _.map( searches, async search => {
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
