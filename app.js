
"use strict";
const console = require('./stdio.js').Get('app', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const fs = require('fs');
const mongoose = require('mongoose');
const Task = require('./Task.js');
const v8 = require('v8');

function formatSizes(v) {
	if (_.isPlainObject(v)) {
		return _.mapValues(v, (value, key) => formatSizes(value));
	} else if (_.isFinite(v)) {
		const suffixes = [ '', 'k', 'm', 'g', 't' ];
		let pwr = 0;
		for (var f = v; f >= 1024; f /= 1024) {
			pwr++
			console.verbose(`formatSizes: v=${v} f=${f} pwr=${pwr} suffix[pwr]=${suffixes[pwr-1]}`);
		}
		v = f;
		// for (var pwr = 1; v > 1024**pwr; pwr++) {
		// 	console.verbose(`formatSizes: v=${v} pwr=${pwr} suffix[pwr]=${suffixes[pwr-1]}`);
		// }

		return '' + (v /*/ pwr*/).toFixed(1) + suffixes[pwr];
	} else {
		throw new TypeError(`formatSizes: typeof v = '${typeof v}'`);
	}
}

var app = {

	// _namespace: createNamespace('myapp.mynamespace'),

	db: {},	// { connection: undefined, url: undefined },
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
	
	/*
	Task,
	tasks: {},

	_tasks: {
		running: [],
		finished: [],
		get all() { return _.concat(this.running, this.finished); }
	},
	// _taskCount: 0,

	 run(... function funcs) 
	 execute an async task registered with the app
	async run(...funcs) {
		if (!_.isArray(args) || args.length < 1 || !_.every(args, arg => _.isFunction(arg))) {
			throw new TypeError(`run(... function functions): has incorrect args: ${inspect(args)}`);
		}
		await Promise.all(_.map(funcs, fn => (fn instanceof Task ? fn : new Task(fn)).run()));
		
		console.verbose(`Starting task '${task.name}'`);
		task.status = 'running';
		task.promise = this._namespace.run(fn);//() => fn(task));
		task.r = await task.promise;
		this._tasks.running.splice(this._tasks.running.indexOf(task), 1);
		task.status = 'finished';
		task.endTime = Date.now();
		this._tasks.finished.push(task);
		console.verbose(`Finished task '${task.name}' in ${task.duration} ms: r=${inspect(task.r)} app._tasks=${inspect(app._tasks)}`);
	
	}
	*/

	logStats() {
		console.verbose( `mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
			`models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
			`heap stats: ${inspect(formatSizes(v8.getHeapStatistics()))}\n` + 
			`mem usage: ${inspect(formatSizes(process.memoryUsage()))}\n` +
			`cpu usage: ${inspect(/*formatSizes*/(_.mapValues(process.cpuUsage(), v => v / 1000000)))}\n` +
			`uptime: ${process.uptime()}\n`);
			// `Tasks.all (${Task.all.length}): ${inspect(Task.all, { depth: 3, compact: false } )} Tasks.uniqueContexts (${Task.uniqueContexts.length})=${inspect(Task.uniqueContexts, { depth: 3, compact: false })}`);
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
		setTimeout(() => {
			process.off('SIGINT', quitHandler);
			process.once('SIGINT', app.onSigInt);
		}, 1000);
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
