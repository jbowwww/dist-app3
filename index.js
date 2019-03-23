
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const pMap = require('p-map');
const pAll = require('p-all');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');	
mongoose.Promise = Q;

const app = require('./app.js');
const Task = require('./Task.js');
const expressApp = require('./express-app.js');

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');
	const Audio = require('./model/audio.js');

var searches = [
	{ path: '/mnt/media', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];


/*
var tasks = {

	populateDisks: new Task(async function populateDisks() {
		await Disk.findOrPopulate();
	}),

	searchFilesystem: new Taskasync function (search) {
		for await (let f of fsIterate(search)) {
			f = await FsEntry.findOrCreate(f);
			console.debug(`f.path: '${f.path}'`);
			await (f.fileType === 'dir' ? f.save() : f.bulkSave());
		}
	}),
	searchFilesystems: new Task(`Searching filesystems`, async function (searches) {		// : ${inspect(searches, { compact: false })}
		await pMap(searches, async search => await tasks.searchFilesystem(search));
	})

};

console.verbose(`tasks: ${inspect(tasks)}`);
*/


(async function main() {
	
	try {
	
		await app.dbConnect();
		// console.verbose(`Disk.findOrPopulate.name=${Disk.findOrPopulate.name} Disk.findOrPopulate.length=${Disk.findOrPopulate.length}`);

		await app.run(() => Disk.findOrPopulate());
		
		// This is the syntax I'm aiming for Task.* alloc()'s new Tasks and .run()s them
		await pMap(searches, async search =>
			await /*app.run(*/new Task( async function fsSearch() {
				for await (let f of fsIterate(search)) {
					await /*app.run*/new Task(async function fSEntry () {
					// task.pipeline(
						let fse = await FsEntry.findOrCreate(f);			// maybe don't need due to bulkSave() using upsert? how about save()? how about relationships?
						console.debug(`fse.path: \'${fse.path}\'`);
						await fse.save(); 	// TODO: model.save wrapper optionally (via model/schema options) delegates to bulkSave()  //wait (f.fileType === 'dir' ? f.save() : f.bulkSave());
					// )
					}).run();
				}
			}).run());
						// console.verbose(`task=${inspect(task)}`);
					// }
				// }).run();

		// await new Task(async function hashFiles(task) {
		// 	async function showHashTotals() {
		// 		var hashedFileCount = await File.find({ hash: { $exists: true } }).countDocuments();
		// 		var unhashedFileCount = await File.find({ hash: { $exists: false } }).countDocuments();
		// 		var totalFileCount = hashedFileCount + unhashedFileCount;
		// 		console.log(`Counted ${totalFileCount} files... ${hashedFileCount} hashed and ${unhashedFileCount} not`);
		// 	};
		// 	await showHashTotals();
		// 	var hashCount = 0;
		// 	for await (let f of /*task.queryProgress*/(File.find({ hash: { $exists: false } })).cursor()) {	//q.cursor())
		// 		hashCount++;
		// 		try {
		// 			await f.doHash();
		// 			await f.bulkSave();
		// 		} catch (e) {
		// 			console.warn(`error hashing for f.path='${f.path}': ${e.stack||e}`);
		// 		} finally {
		// 			// console.verbose(`task=${inspect(task)}`);
		// 		}
		// 	}
		// 	console.log(`Done Hashing ${hashCount} files...`);
		// 	await showHashTotals();
		// }).run();

		// TODO: Get this one working again
		await new Task(async function doAudio(task) {
			for await (const f of /*task.queryProgress*/(File.find({
				hash: { $exists: false },
				path: { $regex: /^.*\.(wav|mp3|mp4|au|flac)$/i }
			})).batchSize(5).cursor()) {
				const a = await f.getArtefact();
				if (!a.audio) {
					await a.addMetaData('audio', { file: f });
				}
				// isCheckedSince will only be valid if doc is not new, if new not all _ts values will be set (confirm this statement)
				if (a.audio.isNew || !a.audio.isCheckedSince(a.file._ts.updatedAt)) {
					await a.audio.loadMetadata(a.file);
				}
				console.verbose(`artefact=${inspect(a)}`);
				if (a.audio.isNew || a.audio.isModified()) {
					await a.bulkSave();
				}
			}
		}).run();

		// iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
		// 	iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
		// 	iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
	
	} catch (err) {

		console.error(`main() error: ${err.stack||err}`);

	} finally {

		await app.quit();

	}
})();

// .then(() => {
// 	return Q(FsEntry.find({})/*.exec()*//*.cursor()*/).then(entries => {
// 		console.log(`entries: ${inspect(entries)}`);
// 	})
// })

// .then(() => { console.verbose(
// 	`mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
// 	`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
// 	(errors.length > 0 ? `global errors (${errors.length}): ${inspect(errors)}\n` : '') ); })

// .then(() => mongoose.connecxtion.close()
// 	.then(() => { console.log(`mongoose.connection closed`); })
// 	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

// .catch(err => console.error(`Other error: ${err.stack||inspect(err)}`))
// .then(() => app.quit())
// .done();
