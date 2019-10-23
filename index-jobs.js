
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, compact: true });
const util = require('util');
const obj = require('@jbowwww/object-util');
const { copy: assign} = obj;
const { EventEmitter } = require('events');
const FsIterable = require('@jbowwww/fs-iterable');
const { Worker, ContextWorker } = require('./worker.js');
const pMap = require('p-map');
const pDelay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));
const pEvent = (em, ev) => new Promise((resolve, reject) => em.once(ev, resolve).on('error', reject));/*require('p-event');*/
const Limit = require('@jbowwww/limit');

const workerContextFn = function() {
	const pMap = require('p-map');
	const app = require('./app.js');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');
	const Audio = require('./model/audio.js');
};

var searches = [
	{ path: '/etc', maxDepth: 0 }
	// { path: '/mnt/media', maxDepth: 0 },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

const Recur = async function(fn, interval = 60000) { while (1) { await fn(); await pDelay(interval); } };

(async function main() {
	let exitCode;
	try {
		exitCode = await ContextWorker(workerContextFn)(async function() {
			try {		// TODO: Combine index.js index2.js andf file hashing into one script using thrads
				
				await app.dbConnect();
				await Disk.findOrPopulate();
				await pMap(searches, async search => /*Recur(async () =>*/ {
					let errors = [];
					let fsIterable = new FsIterable(obj.assign(search, { progress: true }));
					for await (let f of fsIterable) {
						try {
							console.log(`f: ${inspect(f)} fsIterable=${inspect(fsIterable)} this=${inspect(this)}`);
							let a = await (await FsEntry.findOrCreate(f)).getArtefact();
							!!a.file && await a.file.doHash();
							await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 })); 
								// TODO: Make an option on Artefact/model that enables calls to .save() to pass to bulkSave(), which woudl eliminate the need for this step here
						} catch (e) {
							console.warn(`warn: f='${f.path}' e=${e.stack||e}`);
							errors.push(e);
						}
					}
					console.log(`errors[${errors.length}] = ${inspect(errors)}`);
				});
			} catch (err) {
				console.error(`worker error: ${err.stack||err}`);
			}
		});
	} catch (err) {
		console.error(`main() error: ${err.stack||err}`);
	} finally {
		console.log(`worker thread exited with code=${exitCode}`);
		// await app.quit();
	}
}) ();

