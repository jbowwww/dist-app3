
"use strict";
const console = require('./stdio.js').Get('Task', { minLevel: 'debug' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const cluster = require('cluster');
const { createNamespace, getNamespace } = require('node-request-context');
const asyncHooks = require('async_hooks');
const defaultTaskOptions = {
	nameIdLength: 1
};

// [new ]Task([options, ], fn)
function Task(options, fn) {
	if (arguments.length === 1) {
		fn = options;
		options = {};
	}
	if (!_.isFunction(fn)) { throw new TypeError(`fn should be a function but is a ${typeof fn}`); }
	if (!(this instanceof Task)) { return new Task(options, fn); }
	Object.defineProperty(this, 'rootAsyncId', { enumerable: true, value: asyncHooks.executionAsyncId() });
	Object.defineProperty(this, 'fn', { enumerable: true, value: fn });
	Object.defineProperty(this, 'options', { enumerable: true, value: _.defaults(options, defaultTaskOptions) });
	Object.defineProperty(this, 'id', { enumerable: true, value: Task.generateUniqueTaskId(this.name, this.options.nameIdLength) });
	this.namespace = createNamespace(this.id);
	console.debug(`${inspect(this)}`);
}

Object.defineProperty(Task, 'defaultOptions', { enumerable: true, value: defaultTaskOptions });
Object.defineProperty(Task, 'names', { enumerable: true, value: [] });
Object.defineProperty(Task, 'generateUniqueTaskId', {
	enumerable: true,
	value: function Task_generateUniqueTaskId(task, length = 1) {
		var baseName = task.name;// || '(anon)';
		var baseId = 0;
		var name;
		while (Task.names.indexOf(
			name = `${baseName}.${baseId.toString().padStart(length)}`
		) >= 0) {
			baseId++;
		}
		Task.names.push(name);
		return name; 
	}
});

Object.defineProperty(Task, 'created', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'running', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'finished', { enumerable: true, value: [] });;
Object.defineProperty(Task, 'all', { enumerable: true, get: function Task_getAll() {
	return _.concat(Task.created, Task.running, Task.finished);
} });

Task.prototype.fn;
Object.defineProperty(Task.prototype, 'name', { enumerable: true, get: function task_getName() {
	return this.fn && this.fn.name ? this.fn.name : '(anon)';
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
Task.prototype._activeTimeout = 10,
Task.prototype.markActive = function task_nmarkActive(timeout = 10) {
	this._activeLastTimestamp = new Date();
	this._activeTimeout = timeout;
};
Object.defineProperty(Task.prototype, 'isActive', { enumerable: true, get: function task_getIsActive() {
	return this._activeLastTimestamp && (new Date() - this._activeLastTimestamp) < this._activeTimeout;
} });

Task.prototype.run = async function task_run(...args) {
	const namespace = createNamespace(this.name)
	console.verbose(`Running task '${this.name}' with args=${inspect(args)}, namespace=${inspect(namespace)} ... `);	
	this._promise = this.fn(...args)
	.then(r => { console.verbose(`Completed task '${this.name}': r=${inspect(r)}`); return r; })
	.catch(e => { console.error(`Error in task '${this.name}': ${e.stack||e}`); })
	.finally(() => {
		_.pull(Task.running, this);
		Task.finished.push(this);
	});
	this.markActive();
	_.pull(Task.created, this);
	Task.running.push(this);
	return this._promise;
};
Task.prototype.runInFork = async function task_runInFork(...args) {
	cluster.fork()
	.on('online', worker => {
		this._fork = worker;
		console.verbose(`Worker online for task '${this.name}': task=${inspect(this)}`);
	})
	.on('disconnect', worker => {
		console.verbose(`The worker #${worker.id} has disconnected for task '${this.name}': task=${inspect(this)}`);
	})
	.on('exit', (worker, code, signal) => {
		console.verbose(`worker ${worker.process.pid} died (${signal || code}) for task '${this.name}': task=${inspect(this)}`);
	})
	.on('message', (worker, message, handle) => {
		console.verbose(`worker ${worker.process.pid} sent message '${message}' (handle=${handle}) for task '${this.name}': task=${inspect(this)}`);
	});
};

Task.prototype.queryProgress = async function* task_queryProgress(query) {
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
Task.prototype.trackProgress = async function* task_trackProgress(generator) {
	for await (let r of generator) {
		_.assign(this.progress, generator.task);
		yield await r;
	}
};

module.exports = Task;
