
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

const pMap = require('p-map');	// const pMap = (pArray, pFunc) => Promise.all(pArray.map(pFunc));
// const pAll = require('p-all');

const Queue = require('@jbowwww/queue');//'../modules/Queue');
// const hashFile = require('./fs/hash.js');
const FsIterable = require('@jbowwww/fs-iterable');//'../modules/FsIterable');
const Iterable /*{ Buffer, Progress }*/ = require('@jbowwww/iterable');
// const mongoose = require('mongoose');
require('@jbowwww/async-generator');

const app = require('./app.js');

const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

var searches = [
	{ path: '/etc', maxDepth: 0 }
	// { path: '/mnt/media', maxDepth: 0 },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

var threadPoolFileHash = require('webworker-threads').createPool(4).all.eval(File);

const doFileHash = file => new Promise((resolve, reject) => {
	threadPoolFileHash.any.eval(`File.hydrate(${file.toObject()}).doHash()`, function cb(err, data) {
		if (err) { console.error(`Error hashing: ${err.stack||err}`); reject(err); }
		data.then(hash => {
			console.log(`file.hash = ${data} ${hash}`);
			file.hash = hash;
			resolve(file);
		});
		console.log(`file.hash = DATA: ${data}`);
	});
});

// TODO: Combine index.js index2.js andf file hashing into one script using thrads
// First try webworker-threads
(async function main() {
	try {
		await app.dbConnect();
		await Disk.findOrPopulate();
		await pMap(searches, async search => {
			for (const f of new FsIterable(search).pipe(
					Iterable.Buffer,
					Iterable.Progress,
					Iterable.Queue({ concurrency: 4 }) )) {
				console.log(`iterable: ${inspect(iterable)}`);
				console.log(`f: ${inspect(f)}`);
				(await FsEntry.findOrCreate(f)).getArtefact(async a => {
					await doFileHash(f);
					await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 })); 
			// TODO: Make an option on Artefact/model that enables calls to .save() to pass to bulkSave(), which woudl eliminate the need for this step here
				});
				console.log(`\n\nafter inner loop for \'${f.path}\'`);
			}
		});
	} catch (err) {
		console.error(`main() error: ${err.stack||err}`);
	} finally {
		await app.quit();
	}
})();
