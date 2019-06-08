
const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const { EventEmitter } = require('events');

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
				console.log(`Queue empty : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
				this.emit('empty');
			}
			const r = queue.shift()();
		} else {
			console.log(`Queue idle : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
			this.emit('idle');
		}
	};

	const run = (fn, ...args) => {
		this.activeCount++;
		this.runCount++;
		console.log(`Running task : this.activeCount = ${this.activeCount} this.concurrency = ${this.concurrency} this.queue.length = ${this.queue.length} this.runCount = ${this.runCount}`);
		return fn(...args).finally(process.nextTick(next));//resolve, reject).finally(next);
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
