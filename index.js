
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

const pMap = require('p-map');
// const pMap = (pArray, pFunc) => Promise.all(pArray.map(pFunc));
// const pAll = require('p-all');
const Queue = require('@jbowwww/queue');//'../modules/Queue');
// const hashFile = require('./fs/hash.js');
// const fs = require('fs');
const FsIterable = require('@jbowwww/fs-iterable');//'../modules/FsIterable');
const { Buffer } = require('@jbowwww/concurrentiterable');
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

// TODO: Experiment(do other stuff first as a priority):
// Add AsyncGenerator.prototype.pipe = function(writeable) {
	// return async*() {
	// 		for (const pipeOutput of writeable(this) {}
	//	aka
	// return write async*() => { yield* writeable(); }
	//  ..aka?..
	// return async*() => writeable(new)
// }
// e.g. this could be Buffer and writeable is new FsIterate(..) so
// invocation syntax looks like 
//	new FsIterate().pipe(Buffer).pipe(Queue.Iterate)
// or
//	new FsIterate().pipe((...args) => Buffer(...args)).pipe((...args) => Queue.Iterate(...args))
// which looks shit so hopefully .pipe(Buffer) is ok (should be - should pass arg(s) to constructor ie iterable, and optionsally options object)

(async function main() {
	try {
		console.verbose(`Queue = [${typeof Q}] ${Queue}`);
		await app.dbConnect();
		await Disk.findOrPopulate();
	
		await pMap(searches, search => 
			Queue.Iterate( { concurrency: 4 },
				Buffer( 
					new FsIterable( search	) ),
				async (f, fsIterable) => {
					console.log(`f: ${inspect(f)}`);
					(await FsEntry.findOrCreate(f)).getArtefact(async a => {
						await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 }));
						if ()
					});
					console.log(`\n\nafter inner loop for \'${f.path}\'`);
				}));

	} catch (err) {
		console.error(`main() error: ${err.stack||err}`);
	} finally {
		await app.quit();
	}
})();
