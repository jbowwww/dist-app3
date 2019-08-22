
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

const pMap = require('p-map');
// const pMap = (pArray, pFunc) => Promise.all(pArray.map(pFunc));
// const pAll = require('p-all');
const Queue = require('../modules/Queue');
// const hashFile = require('./fs/hash.js');
// const fs = require('fs');
const FsIterable = require('../modules/FsIterable');
// const mongoose = require('mongoose');

const app = require('./app.js');

const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

// const { DataStream } = require('scramjet');

// await (DataStream.from(aStream
var searches = [
	{ path: '/etc', maxDepth: 0 }
	// { path: '/mnt/media', maxDepth: 0 },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

(async function main() {
	try {
		console.verbose(`Queue = [${typeof Q}] ${Queue}`);
		await app.dbConnect();
		await Disk.findOrPopulate();
		await pMap(searches, async search => {
			
			const QueueWrap = async (iterable, iteratorFn) => {
				console.log(`QueueWrap: start`);
				const q = new Queue(4);
				for await (const i of iterable) {
					/*await*/ q.add(iteratorFn, i, iterable);
				}
				console.log(`QueueWrap: await q.onIdle`);
				await q.onIdle();
				console.log(`QueueWrap: end`);
			};

			await QueueWrap(new FsIterable(search), async function iterateFsItem(f, fsIterable) {
				console.log(`f: ${inspect(f)}`);
				(await FsEntry.findOrCreate(f)).getArtefact(async a => {
					await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 }));
				});
			});
					
			// const queue = new Queue(4); // tried PQueue and PLimit previously but wanted to write my own (lack of dependencies on random npm packages, & other npm packages are often missing critical or desired feature or option 
			// const fsIterable = new FsIterable(search).run(async processFsItem(item) => {	// TODO: would it be nicer to beable to do new FsIterable().eachAsync(async function() { }) and have this bound to the FsIterable (or just supply a fsIterable parameter to an arrow func)
			// for await (let f of fsIterable) {	//(fsIterate(search))) {
			// }
			
		});
	} catch (err) {
		console.error(`main() error: ${err.stack||err}`);
	} finally {
		await app.quit();
	}
})();
