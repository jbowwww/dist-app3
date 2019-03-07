
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');

function Task(fn) {
	console.debug(`${this instanceof Task ? 'new ' : ''}Task(fn=[function ${fn.name||'(anon)'} [${fn.length||0}]]`);
	if (!(this instanceof Task)) { return new Task(fn); }
	if (!_.isFunction(fn)) { throw new TypeError(`fn should be a function but is a ${typeof fn}`); }
	this.fn = fn;
	this.status = 'init';
}

Object.defineProperty(Task, 'created', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'running', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'finished', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'all', { enumerable: true, get: task_getAll() => _.concat(Task.created, Task.running, Task.finished) });

Task.prototype.fn;
Object.defineProperty(Task.prototype, 'name', { enumerable: true, get: function task_getName() {
	return this.fn && this.fn.name || '(anon)';
} });

Task.prototype._promise;
Object.defineProperty(Task.prototype, 'status', { enumerable: true, get: function task_getStatus() {
	const p = this._promise;
	return p ? p.status === 'pending' ? 'running' :
		p.status === 'fulfilled' ? 'finished' :
			p.status === 'rejected' ? 'error' :
			'unkonwn' :
		'init';
} });

Task.prototype.startTime;
Task.prototype.endTime;
Object.defineProperty(Task.prototype, 'duration', { enumerable: true, get: function() {
	return (this.endTime || new Date()) - this.startTime;
} });
Task.prototype.progress = {
	max: 100,
	current: 0,
	get percentage() { return this.current * 100 / this.max; }
};

Task.prototype._activeLastTimestamp;
Task.prototype._activeTimeout: 10,
Task.prototype.markActive = function task_nmarkActive(timeout = 10) {
	this._activeLastTimestamp = new Date();
	this._activeTimeout = timeout;
};
Object.defineProperty(Task.prototype, 'isActive', { enumerable: true, get: function task_getIsActive() {
	return this._activeLastTimestamp && (new Date() - this._activeLastTimestamp) < this._activeTimeout;
} });

Task.prototype.run = async function task_run(...args) {
	console.verbose(`Running task '${this.name}'${args.length > 0 ? ' with args=' + inspect(args) : ''} ... `);	
	this._promise = this.fn(...args)
	.then(r => { console.verbose(`Completed task '${this.name}': r=${inspect(r)}`); return r; })
	.catch(e => { console.error(`Error in task ${this.name}: ' ${e.stack||e}`); })
	.finally(() => {
		_.pull(Task.running, this);
		Task.finished.push(this);
	});
	this.markActive();
	_.pull(Task.created, this);
	Task.running.push(this);
	return this._promise;
};

Task.prototype.queryProgress = async* function task_queryProgress(query) {
	console.verbose(`queryProgress: query=${inspect(query.getQuery())}`);
	let count = await query.countDocuments();
	this.progress.max = count;
	this.progress.current = 0;
	for await (let r of query.cursor()) {
		this.markActive();
		yield await r;
		this.progress.current++;
	}
};
Task.prototype.trackProgress = async* function task_trackProgress(generator) {
	for await (let r of generator) {
		_.assign(this.progress, generator.task);
		yield await r;
	}
};
