
"use strict";
const console = require('./stdio.js').Get('app', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q'); Q.longStackSupport = true;
const fs = require('fs');
const mongoose = require('mongoose');

const { createNamespace } = require('node-request-context');

	/// THIS IS THE WEIRDEST SHIT.
	// IT MADE MODEL.FIND() RETURN A FUNCTION (THAT LOOKED LIKE A PROMISE EXECUTOR)
	// nO ERRORS NO THING, FUCKED MY HEAD FOR HOURS
	//
	// because you're assigning a new instance of Q to mongoose (when it's already set somewhere ?)
	// Should I just be using native promises these days??
	//
	// .assign(require('mongoose'), { Promise: Q });
	//

var app = {

	_namespace: createNamespace('myapp.mynamespace'),

	db: {},// { connection: undefined, url: undefined },
	async dbConnect(url = 'mongodb://localhost:27017/ArtefactsJS') {
		console.verbose(`dbConnect: Opening db '${url}'...`);
		try {
			let connection = await mongoose.connect(url, { useNewUrlParser: true });
			console.log(`dbConnect: opened db '${url}'`);
			app.db = { connection, url };
			return connection;
		} catch (err) {
			console.error(`dbConnect: Error opening db '${url}': ${err.stack||err}`);
		}
	},
	async dbClose() {
		console.verbose(`dbClose: Closing db '${app.db.url}' ...`);
		try {
			await mongoose.connection.close();
			console.log(`dbClose: db closed '${app.db.url}'`);
			app.db = {};
		} catch (err) {
			console.error(`dbClose: Error closing db '${app.db.url}': ${err.stack||err}`);
		}
	},
	
	// Trying to conceive a neat way to track executing tasks(i.e. promises)
	// would like an easy way to name them without having to verbosely specify them in an object or array or such
	// perhaps model/document/? methods could be wrapped so that the promises they return automatically getAllResponseHeaders
	// properties set on them describing the method name, etc, 
	Task,
	tasks: {},

	_tasks: {
		running: [],
		finished: [],
		get all() { return _.concat(this.running, this.finished); }
	},
	// _taskCount: 0,
	async run(name, fn) {

		if (_.isFunction(name) && arguments.length === 1) {
			fn = name;
			name = fn.name || `Task #${++this._taskCount}`;
		} else if (!_.isString(name)) {
			throw new TypeError(`name should be a string but is ${typeof name}`);
		}
		if (!_.isFunction(fn)) {
			throw new TypeError(`fn should be function but is ${typeof fn}`);
		} /*else if (fn.length < 1) {
			throw new TypeError(`fn should take at least 1 argument, but takes ${fn.length}`);
		}*/
		
		let task = {
			name: name,
			fn,
			status: 'init',
			promise: null,
			r: undefined,
			startTime: Date.now(),
			endTime: null,
			get duration() {
				return (this.endTime || Date.now()) - this.startTime;
			},
			progress: {
				max: 100,
				current: 0,
				get percentage() { return this.current * 100 / this.max; }
			},
			_activeLastTimestamp: Date.now(),
			_activeTimeout: 10,
			markActive(timeout = 10) {
				this._activeLastTimestamp = Date.now();
				this._activeTimeout = timeout;
			},
			get isActive() {
				return (Date.now() - this._activeLastTimestamp >= this._activeTimeout);
			},
			async* queryProgress(query) {
				console.verbose(`queryProgress: query=${inspect(query.getQuery())}`);
				let count = await query.countDocuments();
				this.progress.max = count;
				this.progress.current = 0;
				for await (let r of query.cursor()) {
					this.markActive();
					yield await r;
					this.progress.current++;
				}
			},
			async* trackProgress(generator) {
				for await (let r of generator) {
					_.assign(this.progress, generator.task);
					yield await r;
				}
			}

		}; 
		this._tasks.running.push(task);
		console.verbose(`Starting task '${task.name}'`);
		task.status = 'running';
		task.promise = this._namespace.run(fn);//() => fn(task));
		task.r = await task.promise;
		this._tasks.running.splice(this._tasks.running.indexOf(task), 1);
		task.status = 'finished';
		task.endTime = Date.now();
		this._tasks.finished.push(task);
		console.verbose(`Finished task '${task.name}' in ${task.duration} ms: r=${inspect(task.r)} app._tasks=${inspect(app._tasks)}`);
	
	},

	logStats() {
		console.verbose( `mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
			`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}`);
		app.logErrors();
	},
	logErrors() {
		if (app.errors && app.errors.length > 0 && app._errorLastWritten < app.errors.length) {
			fs.appendFileSync('errors.txt', app.errors.join('\n'));
			console.log(`Errors: ${inspect(app.errors, { depth: 3, compact: false })}`);
			app._errorLastWritten = app.errors.length;
		}
	},
	
	errors: [],
	_errorLastWritten: 0,
	onError(err, msg = '') {
		app.errors.push(err);
		console.warn(`${msg?msg+' ':''}error: ${err.stack||err}`);
	},
	onUncaughtException(err, msg = '') {
		app.onError(err, msg);
		app.quit(1, 'Exiting due to uncaught exception');
	},
	
	onSigInt() {
		app.logStats();
		console.log('Press ctrl-c again to quit ...');
		process.once('SIGINT', quitHandler);
		Q.delay(1000).then(() => {
			process.off('SIGINT', quitHandler);
			process.once('SIGINT', app.onSigInt);
		}).done();
		function quitHandler() {
			app.quit(1, 'Exiting due to SIGINT');
		}
	},
	async onBeforeExit() {
		await app.quit();
	},
	async quit(exitCode = 0, exitMsg = 'Exiting') {
		if (typeof exitCode === 'string') {
			exitMsg = exitCode;
			exitCode = 0;
		}
		exitMsg += `  (exitCode=${exitCode}) ...`;
		app.logStats();
		await app.dbClose();
		console.log(exitMsg);
		process.nextTick(() => process.exit(exitCode));
	}

};

app = _.bindAll(app, _.functions(app));

process.on('uncaughtException', app.onUncaughtException);
process.once('SIGINT', app.onSigInt);
process.on('beforeExit', app.onBeforeExit);

module.exports = app;

function Task(description, fn) {
	console.debug(`Task(description=${description}, fn=${fn})`);
	if (!(this instanceof Task)) {
		return new Task(description, fn);
	}
	
	if (typeof description === 'function') {
		fn = description;
		description = undefined;
	} else if (typeof description !== 'string') {
		throw new TypeError(`description should be a string but is a ${typeof description}`);
	} else if (!_.isFunction(fn)) {
		throw new TypeError(`fn should be a function but is a ${typeof fn}`);
	}
	
	this.description = description;
	this.fn = fn;
	this.status = 'init';
	let innerRun = this.run.bind(this);

	return async function(...args) { 
		return await innerRun(this, ...args);
	};

	// if (app.tasks[name]) {
	// 	console.warn(`app.tasks already has a task named '${name}', getting replaced...`);
	// }
	// app.tasks[name] = this;
}

Task.finished = [];
Task.running = [];
Object.defineProperty(Task, 'all', { enumerable: true, writeable: false, configurable: true, get: () => _.concat(Task.finished, Task.running) });

Task.prototype.description;
Task.prototype.fn;
Task.prototype.promise;
Task.prototype.status;

Task.prototype.run = async function taskRun(fnThis, ...args) {
	
	console.log((this.description ? this.description : 'Running task') + (args.length > 0 ? ' (' + _.map(args, arg => inspect(arg)).join(', ') + ')' : '') + ' ...');
	this.promise = this.fn(...args);
	this.status = 'running';
	Task.running.push(this);
	console.debug(`Task.running=${inspect(Task.running)} Task.finished=${inspect(Task.finished)}`);
	
	this.promise.then(r => {
		this.status = r ? `done: ${inspect(r)}` : 'done';
		console.verbose((this.description ? 'Done ' + this.description : 'Done task') + (r ? ': ' + inspect(r) : ''));
	})
	.catch(e => {
		this.status = e ? `error: ${e.stack||e}` : 'error';
		console.error((this.description ? 'Error ' + this.description : 'Error task') + (e ? ': ' + (e.stack||e) : ''));
	})
	.finally(() => {
		let index = Task.running.indexOf(this);
		if (index < 0) { throw new Error(`Error: task not found: task=${inspect(this)}`); }
		Task.running.splice(index, 1);
		Task.finished.push(this);
	});

	return this.promise;
};
