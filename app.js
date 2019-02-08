
"use strict";
const console = require('./stdio.js').Get('app', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q'); Q.longStackSupport = true;
// const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');
const fs = require('fs');
const mongoose = require('mongoose');

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

	db: {},// { connection: undefined, url: undefined },
	dbConnect(url = 'mongodb://localhost:27017/ArtefactsJS') {
		console.verbose(`dbConnect: Opening db '${url}'...`);
		return mongoose.connect(url, { useNewUrlParser: true })
		.then(connection => {
			console.log(`dbConnect: opened db '${url}'`);
			app.db = { connection, url };
		})
		.catch(err => { console.error(`dbConnect: Error opening db '${url}': ${err.stack||err}`); });
	},
	closeDb() {
		console.verbose(`closeDb: Closing db '${app.db.url}' ...`);
		return mongoose.connection.close()
		.then(() => {
			console.log(`closeDb: db closed '${app.db.url}'`);
			app.db = {};
		})
		.catch(err => { console.error(`closeDb: Error closing db '${app.db.url}': ${err.stack||err}`); });
	},
	logStats() {
		console.verbose( `mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
			`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
			(app.errors.length > 0 ? `global errors (${app.errors.length}): ${inspect(app.errors)}\n` : '') );
		app.logErrors();
	},

	errors: [],
	_errorLastWritten: 0,
	logErrors() {
		if (app.errors && app.errors.length > 0 && app._errorLastWritten < app.errors.length) {
			fs.appendFileSync('errors.txt', app.errors.join('\n'));
			console.log(`Errors: ${inspect(app.errors, { depth: 3, compact: false })}`);
			app._errorLastWritten = app.errors.length;
		}
	},
	onError(err, msg = '') {
		var m, d = err.promisePipeData;
		if (d && (m = d.constructor) && m._stats) {
			m._stats.errors.push(err);
			console.warn(`${msg?msg+' ':''}promisePipe error for ${d.fileType||'(non-fsEntry)'} '${d.path||d._id||d}': ${err.stack||err}`);
		} else {
			app.errors.push(err);
			console.warn(`${msg?msg+' ':''}error: ${err.stack||err}`);
		}
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
	onBeforeExit() {
		app.quit();
	},
	quit(exitCode = 0, exitMsg = 'Exiting') {
		if (typeof exitCode === 'string') {
			exitMsg = exitCode;
			exitCode = 0;
		}
		exitMsg += `  (exitCode=${exitCode}) ...`;
		app.logStats();
		app.closeDb().then(() => {
			console.log(exitMsg);
			process.nextTick(() => process.exit(exitCode));
		}).done();
	}

};

app = _.bindAll(app, _.functions(app));

process.on('uncaughtException', app.onUncaughtException);
process.once('SIGINT', app.onSigInt);
process.on('beforeExit', app.onBeforeExit);

module.exports = app;
