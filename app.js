
"use strict";
const console = require('./stdio.js').Get('app', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
// const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');
const mongoose = require('mongoose')

	/// THIS IS THE WEIRDEST SHIT.
	// IT MADE MODEL.FIND() RETURN A FUNCTION (THAT LOOKED LIKE A PROMISE EXECUTOR)
	// nO ERRORS NO THING, FUCKED MY HEAD FOR HOURS
	//
	// because you're assigning a new instance of Q to mongoose (when it's already set somewhere ?)
	// Should I just be using native promises these days??
	//
	// .assign(require('mongoose'), { Promise: Q });
	//
	
// const setSigInt = require('./set-sig-int.js');

const app = {
	
	errors: [],
	_errorLastWritten: 0,

	quit(exitCode = 0) {
		process.nextTick(() => process.exit(exitCode));
	},

	dbConnect() {
		return mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })
		.then(() => { console.log(`dbConnect: opened`); });
	},

	closeDb() {
		return mongoose.connection.close()
		.then(() => { console.log(`mongoose.connection closed`); })
		.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); });
	},

	logStats() {
		console.verbose( `mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
			`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
			(app.errors.length > 0 ? `global errors (${app.errors.length}): ${inspect(app.errors)}\n` : '') );
		if (app.errors && app.errors.length > 0 && app._errorLastWritten < app.errors.length) {
			fs.appendFileSync('errors.txt', app.errors.join('\n'));
			console.log(`Errors: ${inspect(app.errors, { depth: 3, compact: false })}`);
			app._errorLastWritten = app.errors.length;
		}
	},

	handleError(err, msg = '') {
		var m, d = err.promisePipeData;
		if (d && (m = d.constructor) && m._stats) {
			m._stats.errors.push(err);
			console.warn(`${msg?msg+' ':''}promisePipe error for ${d.fileType||'(non-fsEntry)'} '${d.path||d._id||d}': ${err.stack||err}`);
		} else {
			app.errors.push(err);
			console.warn(`${msg?msg+' ':''}error: ${err.stack||err}`);
		}
	}
};

process.on('uncaughtException', function uncaughtException(err) {
	app.handleError(err, `process.on('uncaughtException')`);
	app.logStats();
	console.log(`Closing db...`);
	app.closeDb().then(() => {
		console.log(`Exiting...`);
		app.quit(1);
	});
});

process.once('SIGINT', function sigIntHandler() {
	
	app.logStats();
	
	// process.off('SIGINT');
	process.once('SIGINT', quitHandler);
	
	Q.delay(1000).then(() => {
		process.off('SIGINT', quitHandler);
		process.once('SIGINT', sigIntHandler);
	}).done();

	function quitHandler() {
		app.logStats();
		console.log(`Closing db...`);
		app.closeDb().then(() => {
			console.log(`Exiting due to SIGINT...`);
			app.quit(1);
		});
	}
});

process.on('beforeExit', () => {	
	app.logStats();
	console.log(`Closing db...`);
	app.closeDb().then(() => {
		console.log(`Exiting...`);
		app.quit(1);
	});
});

module.exports = app;
