
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');
const pMap = require('p-map');
const pAll = require('p-all');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');
const app = require('./app.js');

const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

// const PQueue = require('p-queue');
const PLimit = require('p-limit');

var searches = [
	{ path: '/etc', maxDepth: 0 },
	// { path: '/mnt/media', maxDepth: 0 },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

function MyQueue(concurrency = 1) {
	if (!(this instanceof MyQueue)) {
		return new MyQueue(concurrency);
	}
	EventEmitter.call(this);
	this.queue = [];
	this.activeCount = 0;
	this.runCount = 0;
	this.concurrency = concurrency;
}

util.inherits(MyQueue, EventEmitter);
MyQueue.prototype.constructor = MyQueue;

MyQueue.prototype.add = function add(fn, ...args) {
	const queue = this.queue;
	const next = () => {
		this.activeCount--;
		if (queue.length > 0) {
			console.log(`Dequeueing task : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
			if (queue.length === 1) {
				this.emit('empty');
			}
			const r = queue.shift()();
		} else {
			console.log(`Queue empty : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
			this.emit('idle');
		}
	};

	const run = (fn, ...args) => {
		this.activeCount++;
		this.runCount++;
		console.log(`Running task : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
		return new Promise((resolve, reject) => {
			process.nextTick(() => {
				fn(...args).then(resolve, reject).finally(next);
			})
		});
	};

	if (this.activeCount < this.concurrency) { 
		run(fn, ...args);
	} else {
		console.log(`Queueing task : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
		this.queue.push(() => run(fn, ...args));
	}
};
MyQueue.prototype.enqueue = MyQueue.prototype.add;

MyQueue.prototype.onEmpty = function onEmpty() {
	return new Promise((resolve, reject) => {
		this.once('empty', resolve);
	});
};

MyQueue.prototype.onIdle = function onIdle() {
	return new Promise((resolve, reject) => {
		this.once('idle', resolve);
	});
};

(async function main() {
	try {
		await app.dbConnect();
		await Disk.findOrPopulate();
		await pMap(searches, async search => {
			// const queue = new PQueue({concurrency: 1});
			// const limit = PLimit(2);
			const queue = new MyQueue(1);
			for await (let f of (fsIterate(search))) {
				queue.add(async function() {
					(await FsEntry.findOrCreate(f)).getArtefact(async a => {
						await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 }));
					});
				});
			}
			await queue.onEmpty();
		});
	} catch (err) {
		console.error(`main() error: ${err.stack||err}`);
	} finally {
		await app.quit();
	}
})();
