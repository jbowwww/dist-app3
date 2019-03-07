
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const pMap = require('p-map');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');	
mongoose.Promise = Q;

const app = require('./app.js');
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



var tasks = {

	populateDisks: app.Task(`Populating disks/partitions`, async function () {
		await Disk.findOrPopulate();
	}),

	searchFilesystem: app.Task(`Searching filesystem`, async function (search) {
		for await (let f of fsIterate(search)) {
			f = await FsEntry.findOrCreate(f);
			console.debug(`f.path: '${f.path}'`);
			await (f.fileType === 'dir' ? f.save() : f.bulkSave());
		}
	}),
	searchFilesystems: app.Task(`Searching filesystems`, async function (searches) {		// : ${inspect(searches, { compact: false })}
		await pMap(searches, async search => await tasks.searchFilesystem(search));
	})

};

console.verbose(`tasks: ${inspect(tasks)}`);

(async function main() {
	
	try {
	
		await app.dbConnect();
		// console.verbose(`Disk.findOrPopulate.name=${Disk.findOrPopulate.name} Disk.findOrPopulate.length=${Disk.findOrPopulate.length}`);

		await app.run( 'diskPopulate', () => Disk.findOrPopulate() );
		
		await pMap(searches, async search => await app.run( 'fsSearch', async task => {
			for await (let f of /*task.trackProgress*/(fsIterate(search))) {
				f = await FsEntry.findOrCreate(f); 
				console.debug(`f.path: '${f.path}'`);
				await (f.fileType === 'dir' ? f.save() : f.bulkSave());
				// console.verbose(`task=${inspect(task)}`);
			}
		}));

		
// another possibility, that could allow for timing, debug/stats, etc
// await app.run( Disk.findOrPopulate() );
// await app.run( Q.all( _.map( searches, async search => {
	// for /*await */(var fse of fsIterate(search)) {
	// 	await FsEntry.findOrCreate(fse);		// fse => FsEntry.upsert(fse) )	// can't use document instance methods or schemas, etc, is just a POJO
	// 	console.log(`fse.path: '${fse.path}'`);
	// 	await fse.fileType === 'dir' ? fse.save() : fse.bulkSave()
	// }

		await app.run( 'hashFiles', async task => {
			async function showHashTotals() {
				var hashedFileCount = await File.find({ hash: { $exists: true } }).countDocuments();
				var unhashedFileCount = await File.find({ hash: { $exists: false } }).countDocuments();
				var totalFileCount = hashedFileCount + unhashedFileCount;
				console.log(`Counted ${totalFileCount} files... ${hashedFileCount} hashed and ${unhashedFileCount} not`);
			};
			await showHashTotals();

			var hashCount = 0;
			for await (let f of /*task.queryProgress*/(File.find({ hash: { $exists: false } })).cursor()) {	//q.cursor())
				hashCount++;
				try {
					await f.doHash();
					await f.bulkSave();
				} catch (e) {
					console.warn(`error hashing for f.path='${f.path}': ${e.stack||e}`);
				} finally {
					// console.verbose(`task=${inspect(task)}`);
				}
			}
			console.log(`Done Hashing ${hashCount} files...`);
			await showHashTotals();
		});

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

// .catch(err => console.error(`Other error: ${err.stack||inspect(err)}`))
// .then(() => app.quit())
// .done();
