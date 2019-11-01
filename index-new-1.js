
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, compact: true });
const util = require('util');
const obj = require('@jbowwww/object-util');
const { copy: assign} = obj;
const { EventEmitter } = require('events');
const FsIterable = require('@jbowwww/fs-iterable');
const pMap = require('p-map');
const pDelay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));
const pEvent = (em, ev) => new Promise((resolve, reject) => em.once(ev, resolve).on('error', reject));/*require('p-event');*/
const Limit = require('@jbowwww/limit');
const cluster = require('cluster');
var searches = [
	// { path: '/etc', maxDepth: 0 }
	{ path: '/mnt/media', maxDepth: 0 },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

const app = require('./app.js');
const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

const Recur = async function(fn, interval = 60000) { while (1) { await fn(); await pDelay(interval); } };
const streamAsync = async (source, options, fn) => {
	if (typeof options === 'function' && fn === undefined) {
		fn = options;
		options = { concurrency: 1 };
	}
	if (typeof fn !== 'function') {
		throw new TypeError(`fn should be a function`);cluster	}
	let processFn = Limit({ concurrency: 4 }, fn);
	let errors = [];
	for await (const data of source) {
		try {
			console.verbose(`source in data: ${inspect(data)}\nsource: ${inspect(source)}\nthis=${inspect(this)}\nprocessFn.pending.length = ${processFn.pending.length}`);
			const processedData = await processFn.call(source, data);
			console.verbose(`processed data: ${inspect(data)}\nsource: ${inspect(source)}\nthis=${inspect(this)}\nprocessFn.pending.length = ${processFn.pending.length}`);
		} catch (e) {
			console.warn(`warn: e=${e.stack||e} for data=${inspect(data)}`);
			errors.push(e);
		}
	}
	console.log(`errors[${errors.length}] = ${inspect(errors)}`);
};

(async function main() {
	try {			
		await app.dbConnect();
		await pMap(searches, async search => {
			try {
				await streamAsync(
					new FsIterable(obj.assign(search, { progress: true })),
					{ concurrency: 2 }, async f => {
						let a = await (await FsEntry.findOrCreate(f)).getArtefact();
						!!a.file && //await a.file.doHash();
						await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 })); 
						// TODO: Make an option on Artefact/model that enables calls to .save() to pass to bulkSave(), which woudl eliminate the need for this step here
					});
			} catch (e) {
				console.error(`error for search: ${inspect(search)}: ${e.stack||e}`);
			}			
		});
	} catch (err) {
		console.error(`worker error: ${err.stack||err}`);
	}
}) ();

