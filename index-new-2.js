
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
	{ path: '/etc', maxDepth: 0 }
	// { path: '/mnt/media', maxDepth: 0 },
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
const source = (input, options = {}) => {
	let next = null;
	if (input[Symbol.iterator]) {
		const it = input[Symbol.iterator]();
		next = it.next.bind(it);
	} else if (input[Symbol.asyncIterator]) {
		const it = input[Symbol.asyncIterator]();
		next = it.next.bind(it);
	} else if (input.addEventListener || input.on || input.once) {
		next = () => new Promise((resolve, reject) => {
			input.once(options.event||'data', (data) => resolve({ value: data, done: false})).once('end', () => resolve({ done: true })).once('error', reject); });
	} else {
		console.log(`Could not get source iteration technique!`);
	}
	const r = {
		next,
		[Symbol.iterator]() { return this; },
		[Symbol.asyncIterator]() { return this; } 
	};
	console.log(`source: ${inspect(r)}`);
	return r;
;}

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
			// console.verbose(`source in data: ${inspect(data)}\nthis=${inspect(this)}\nprocessFn.pending.length = ${processFn.pending.length}\nid=${cluster.worker.id || 'master'}`);
			const processedData = await processFn.call(source, data);
			// console.verbose(`processed data: ${inspect(processedData)}\nthis=${inspect(this)}\nprocessFn.pending.length = ${processFn.pending.length}`);
		} catch (e) {
			console.warn(`warn: e=${e.stack||e} for data=${inspect(data)}`);
			errors.push(e);
		}
	}
	console.log(`errors[${errors.length}] = ${inspect(errors)}`);
};

const clusterProcesses = async (...processes) => {
	const workerPromises = [];
	if (cluster.isMaster) {
		for (const i in processes) {
			console.log(`Master forking worker #${i}`);
			const worker = cluster.fork({ id: i });
			workerPromises.push(pEvent(worker, 'exit'));
		}
		console.log(`Master awaiting ${workerPromises.length} promises: ${inspect(workerPromises)}`);
		const ret = await Promise.all(workerPromises);
		console.log(`Master received fulfilment array of: ${inspect(ret)}`);
	}
	else if (cluster.isWorker) {
		const id = process.env.id || -1; // cluster.worker.id;
		if (id < 0) {
			throw new Error(`Worker didn't get valid ID`);
		}
		console.log(`worker process #${id} has processes: ${inspect(processes)}`);
		const ret = await (processes[id])();
		console.log(`worker process #${id} returned: ${inspect(ret)}`);
	}
};

(async function main() {
	try {			
		await app.dbConnect();
		await clusterProcesses(async () => {
			await pMap(searches, async search => {
				try {
					await streamAsync(
						source(new FsIterable(obj.assign(search, { progress: true }))),
						{ concurrency: 1 }, async f => {
							let a = await (await FsEntry.findOrCreate(f)).getArtefact();
							!!a.file && //await a.file.doHash();
							await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 })); 
							// TODO: Make an option on Artefact/model that enables calls to .save() to pass to bulkSave(), which woudl eliminate the need for this step here
						});
				} catch (e) {
					console.error(`error for search: ${inspect(search)}: ${e.stack||e}`);
				}			
			});
		}, //async () => {
			// console.log(`\n\nProcess shouldbetwo ${cluster.worker.id}\n\n`);
			// await Promise.all([
				(async () => {
					// for await (const change of
					await streamAsync(source(File.watch([]), { event: 'change' }), 
						async change => {
							const f = await FileSys.hydrate(change.fullDocument);
							console.log(`FileSys.hydrate=${inspect(f)} change=${inspect(change)}`); 
							await f.doHash();
							await f.save();
							console.log(`fullDoc.hash.save=${inspect(f)}`); 
						});
				}),
				(async () => {
					// for (const f of 
					await streamAsync(source(File.find({ hash: { $exists: false } }).cursor()),
						async f => {
							await f.doHash();
							await f.save();
							console.log(`fullDoc.hash.save=${inspect(f)}`);
						});
				})
			// ]);
		// }
		);
	} catch (err) {
		console.error(`worker error: ${err.stack||err}`);
	}
}) ();

