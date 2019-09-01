
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

const pMap = require('p-map');
const pDelay = require('p-delay');
// const pMap = (pArray, pFunc) => Promise.all(pArray.map(pFunc));
// const pAll = require('p-all');
const Queue = require('@jbowwww/queue');//'../modules/Queue');
// const hashFile = require('./fs/hash.js');
// const fs = require('fs');
const FsIterable = require('@jbowwww/fs-iterable');//'../modules/FsIterable');
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

			/*function Concurrent(iterator, concurrency = 1) {
				let active = [];
				let done = false;
				return iterator().then(() => {
					console.log(`Concurrent starting buffering, iterator=${inspect(iterator)} iterable=${inspect(iterable)}`);
					return () => ({
						[Symbol.asyncIterator]() { return this; },
						async next() {
							if (!done) {
								if (active.length < concurrency && !done) {
									active.push(Promise.resolve(iterable.next()).then(({ value, done }) => {
										done = done;
										active = active.splice(active.length,1);
										return value;
									}));//filter(a => a===active.length)));
								} else {
									return Promise.race(active).then(() => null)
								}
							}
						}
					});
				});
			}
				// 	if (active.length >= concurrency) {
				// 		await Promise.race(active);
				// 	}
				// 	const item = iterable.next();
				// 	console.log(`COncurrent Item: ${inspect(item)}`);
				// 	active.push(item);
				// 	const i = await item;//item.then(() => active = active.filter(a => a === item));
				// 	active = active.filter(a => a === item);
				// 	yield i;
				// }
				// console.log(`Concurrent finished concing, active = Array[${active.length}] active[0]=${active.length===0?null:active[0]} iterable=${inspect(iterable)}`);

				// let active = 0;
				// let active = [];
				// for (const item of items) {
				// 	while (active.length >= concurrency) {
				// 		await Promise.race(this.active);
				// 	}
				// 	new Promise((resolve, reject) => {item)++;
				// 	yield item;
				// 	await Promise.race
				// }
			// };*/

			const QueueWrap = async function* (iterable, iteratorFn) {
				console.log(`QueueWrap: start`);
				const q = new Queue(4);
				if (typeof iterable[Symbol.asyncIterator] !== 'function') {
					for (const i of iterable) {
						await q.add(iteratorFn.bind(iterable, i));
					}
				} else {
					for await (const i of iterable) {
						await q.add(iteratorFn.bind(iterable, i));
					}
				}
				console.log(`QueueWrap: await q.onIdle`);
				await q.onIdle();
				console.log(`QueueWrap: end: q=${inspect(q)}`);
			};

			async function* Buffer(iterable) {
				try {
					let items = [];
					let currentIndex = 0;
					console.log(`Buffer starting buffering, items = Array[${items.length}] iterable=${inspect(iterable)}`);
					for await (const item of iterable) {
						items.push(item);
					}
					// console.log(`Buffer awaiting items (buffer to fill), items = Array[${items.length}] items[0]=${inspect(items[0])} iterable=${inspect(iterable)}`);
					// await Promise.all(items);
					console.log(`Buffer finished buffering, items = Array[${items.length}] items[0]=${inspect(items[0])} iterable=${inspect(iterable)}`);
					yield* items;
					// for (const item of items) {
					// 	yield item;
					// }
					console.log(`Buffer finished streaming, items = Array[${items.length}] iterable=${inspect(iterable)}`);
				} catch (e) {
					console.error(`Buffer error: ${e.stack||e}`);
				}

			}

			function AsyncToSyncIterator(iterable) {
				try {
					let iterator = iterable[Symbol.asyncIterator]();
					let r = {
						[Symbol.iterator]() { 
							iterator = iterable[Symbol.asyncIterator]();
							// console.verbose(`AsyncToSyncIterator: iterable[Symbol.asyncIterator]=${inspect(iterable[Symbol.asyncIterator])} iterator=${inspect(iterator)} this=${inspect(this)}`);
							console.verbose(`AsyncToSyncIterator: this=${inspect(this)}`);
							return this;
							// return iterator;//iterable[Symbol.asyncIterator]();
						},
						next(...args) {
							let item = iterator.next(...args);
							console.verbose(`AsyncToSyncIterator.next(${inspect(args)}): item=${inspect(item)} this=${inspect(this)}`);	
							item.then(v => console.verbose(`AsyncToSyncIterator.next.then: v=${inspect(v)}`));
							return { value: item, done: false };
						}
					};
					console.verbose(`AsyncToSyncIterator: iterable[Symbol.asyncIterator]=${inspect(iterable[Symbol.asyncIterator])}\n\titerable=${inspect(iterable)}\n\titerator=${inspect(iterator)}\n\tr=${inspect(r)}\n\tthis=${inspect(this)}`);
					return r;
				} catch (e) {
					console.error(`AsyncToSyncIterator error: ${e.stack||e}`);
				}
			}
			async function* ConcurrentAsync(concurrency, iterable) {
				try {
					// if (concurrency < 1) throw new Error(`concurrency must be >= 1, supplied argument concurrency=${concurrency}`);
					let active = [];
					let done = false;
					let n = 0;
					console.log(`Concurrent starting iteration, active=Array[${active.length}] iterable=${inspect(iterable)}`);
					for (let item = await iterable.next(); !done; item = await iterable.next()) {	// of /*AsyncToSyncIterator*/(iterable)) {
						console.log(`Concurrent got item #${n}=${inspect(item)}, active=Array[${active.length}] iterable=${inspect(iterable)}`);
						// console.log(`Concurrent activating task #${n}, done=${done} active=Array[${active.length}] iterable=${inspect(iterable)}\n\tprItem=${prItem}`);
						active.push(prItem);//.catch(e => { throw e; }));
						prItem.then(item => {
							active = active.splice(active.getIndexOf(prItem), 1);
							done = item.done;
							console.log(`Concurrent task prItem.then: item=${inspect(item)} active=${inspect(active)} done=${done}`)
						});
						while (active.length >= concurrency && !done) {
							console.log(`Concurrent task #${n} waiting for active tasks, active=Array[${active.length}] iterable=${inspect(iterable)}`);
							await pDelay(100).race(active);
						}
						let item = await prItem;
						// done = item.done;
						yield item.value;
						n++;
					}
					console.log(`Concurrent finished iteration, active=Array[${active.length}] iterable=${inspect(iterable)}`);
				} catch (e) {
					console.error(`Concurrent error: ${e.stack||e}`);
				}
			}

			for await (const f of Concurrent(1, Buffer(new FsIterable(search)))) {//, async function iterateFsItem(f, fsIterable) {
				console.log(`f: ${inspect(f)}`);
				(await FsEntry.findOrCreate(f)).getArtefact(async a => {
					await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 }));
				});
				console.log(`\n\nafter inner loop for \'${f.path}\'`);
			}
					
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
