
const console = require('./stdio.js').Get('Queue', { minLevel: 'verbose' });// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

util.inherits(Queue, EventEmitter);
Queue.prototype.constructor = Queue;

function Queue(concurrency = 1) {
	if (!(this instanceof Queue)) {
		return new Queue(concurrency);
	}
	EventEmitter.call(this);
	this.queue = [];
	this.activeCount = 0;
	this.runCount = 0;
	this.successCount = 0;
	this.errors = [];
	this.concurrency = concurrency;
}

Queue.prototype._debug = function _debug() {
	return JSON.stringify({
		'queue.length': this.queue.length,
		concurrency: this.concurrency,
		activeCount: this.activeCount,
		runCount: this.runCount,
		successCount: this.successCount,
		'errors.length': this.errors.length
	});
};

// Runs a function, up to the configured concurrency. If maximum concurrency not yet reached, add returns immediately. If maximum concurrency
// has been reached, returns a Promise that resolves when one of the currently executing functions finishes.
// TODO: ^ think that through, i'm not sure its quite what you want
Queue.prototype.add = function add(fn, ...args) {
	const queue = this.queue;
	const next = () => {
		this.activeCount--;
		this.emit('next');
		if (queue.length > 0) {
			console.verbose(`Dequeueing task : ${this._debug()}`);
			if (queue.length === 1) {
				console.verbose(`Queue empty : ${this._debug()}`);
				this.emit('empty');
			}
			const r = queue.shift()();
		} else {
			console.verbose(`Queue idle : ${this._debug()}`);
			this.emit('idle');
		}
	};
	const run = (fn, ...args) => {
		const runStart = Date.now();
		let runEnd;
		this.activeCount++;
		this.runCount++;
		console.log(`Running task : ${this._debug()}`);
		return (fn(...args)
		.then(result => {
			runEnd = Date.now();
			const runDuration = runEnd - runStart;
			this.successCount++;
			console.verbose(`Task success : result=${inspect(result)} runDuration=${runDuration}ms ${this._debug()}`);
		}, err => {
			runEnd = Date.now();
			const runDuration = runEnd - runStart;
			this.errorCount++;
			console.verbose(`Task error : err=${err.stack||err} runDuration=${runDuration}ms ${this._debug()}`);
		}).then(() => process.setTimeout(next, 0)));
	};
	if (this.activeCount < this.concurrency) { 
		run(fn, ...args);
	} else {
		console.verbose(`Queueing task : ${this._debug()}`);
		this.queue.push(() => run(fn, ...args));
		return new Promise((resolve, reject) => {
			this.on('next', () => {
				this.off('next');
				resolve();
			});
		})
	}
};
Queue.prototype.enqueue = Queue.prototype.add;

Queue.prototype.onEmpty = function onEmpty() {
	return this.queue.length === 0 ? Promise.resolve() : new Promise((resolve, reject) => {
		this.on('empty', () => {
			this.off('enpty');
			resolve();
		})
	});
};

Queue.prototype.onIdle = function onIdle() {
	return this.activeCount === 0 ? Promise.resolve() : new Promise((resolve, reject) => {
		this.on('idle', () => {
			this.off('idle');
			resolve();
		});
	});
};

module.exports = Queue;
