
"use strict";

const console = require('./stdio.js').Get('bin/fs/promise-pipe', { minLevel: 'log' });	// verbose debug log
const stream = require('stream');
const pipeline = stream.pipeline;
const _ = require('lodash');
const inspect = require('util').inspect;
const Q = require('q');
const pEvent = require('p-event');
const through2Concurrent = require('through2-concurrent');

const defaultCatch = err => { console.warn(`promisePipe error${err.promisePipeData ? (' (data: [' + typeof err.promisePipeData + '] ' + inspect(err.promisePipeData, { compact: true }) + ')') : ''}: ${err.stack||err}`); };
const defaultOptions = {
	catchErrors: defaultCatch,
	emitStreamErrors: false,
	concurrency: 4,
	dataThru: false
};

var self = {

	/* promisePipe([sourceStream, ] promiseFunctions [, options])
	 *	sourceStream: A node stream source to pipe into the promisePipe
	 *	promiseFunctions: An array of promise-returning functions that take one parameter (data), which will be chained together and called as data arrives
	 *	options.enableStreamErrors: (default: false) whether exceptions/promise rejections in the promiseFunctions pipeline get emitted on the emitter as an 'error' event
	 */
	promisePipe(...args) { //sourceStream, [, options = {}], ...promiseFunctions) {
		var sourceStream, options = {}, promiseFunctions = [];

		_.forEach(args, (arg, i) => {
			if (typeof arg === 'object') {
				if (promiseFunctions.length > 0) {
					throw new TypeError('promisePipe: arguments must end with promise functions');
				}
				if (arg.emit) {
					sourceStream = arg;
				} else {
					options = arg;
				}
			} else if (typeof arg === 'function') {
				promiseFunctions.push(arg);
			} else {
				throw new TypeError(`promisePipe: Argument #${i} unknown type '${typeof arg}'`);
			}
		});
		if (!sourceStream || !sourceStream.on) {
			throw new TypeError(`sourceStream must be a node stream emitter`);
		}
		if (typeof options.catchErrors === 'boolean' && options.catchErrors) {
			delete options.catchErrors;	// unset so default gets set
		}
		options = _.defaults(options, defaultOptions);

		console.verbose(`promisePipe: sourceStream=${sourceStream} options=${inspect(options, { compact: true })} promiseFunctions[${promiseFunctions.length}]`);

		/* The way this is set up, a promisePipe is potentially an array with multiple promise-returning func's
		 * If it is, the func's are chained together in a way that is sort of similar to a thru-stream (i think)
		 * Am I better piping to a series of thru streams, each representing one of the promisePipe functions (assuming an array of them) ?
		 * - This way (promise-returning func's chained) may actually be at least as good as using thru-streams, but have a proper think of it/experiment/test
		 * 	- Particularly with respect to buffering/stream flow control. As is, the aggregated promisePipe could potentially cause the source stream to pause
		 * 	  and/or the stream data to get buffered, as it will not call the callback for stream.Writeable.write until the promiseChain is fulfilled
		 * I think this is all ok, just give it a good proper think through and run experiemnts/tests if necessary */
		var writeable = self.writeablePromiseStream(options, ...promiseFunctions);
		var thenable = self.streamPromise(pipeline(sourceStream, writeable), { resolveEvent: 'finish' });
		// _.set(writeable, 'promisePipe', function promisePipe(...args) {
		// 	console.debug(`writeable.promisePipe(): this=${inspect(this)} writeable=${inspect(writeable)} thenable=${inspect(thenable)}`);
		// 	writeable.options.dataThru = true;
		// 	return self.promisePipe(
		// 		typeof args[0] === 'object' ? args.shift() : { },
		// 		writeable,
		// 		...args);
		// });
		return /*_.mixin*/(/*self, */thenable/*, writeable*/);
		// var pp = sourceStream.pipe());
		// if (typeof options.catchErrors === 'function') {
		// 	pp = pp.catch(err => options.catchErrors);
		// }
		// return pp;
	},

	artefactDataPipe(artefact, data, ...promiseFunctions) {
		// if (typeof artefact !== 'object') {
			// throw new TypeError(`artefact invalid`);
		// } else if (!(data instanceof mongoose.Document)) {
			// throw new TypeError(`data should be a mongoose.Document`);
		// }
		return (self.chainPromiseFuncs(promiseFunctions))(data).then(() => artefact);
		 // (a => 
			// );
	},

	writeablePromiseStream(...args/*[options,] ...promiseFunctions */) {
		var options, promiseFunctions = [], promiseChain;

		_.forEach(args, (arg, i) => {
			if (_.isArray(arg) && _.every(arg, element => _.isFunction(element))) {
				promiseFunctions = _.slice(arg);
			} else if (typeof arg === 'object') {
				if (promiseFunctions.length > 0) {
					throw new TypeError('promisePipe: arguments must end with promise functions');
				}
				options = arg;
			} else if (typeof arg === 'function') {
				promiseFunctions.push(arg);
			} else {
				throw new TypeError(`promisePipe: Argument #${i} unknown type '${typeof arg}'`);
			}
		});
		if (typeof options.catchErrors === 'boolean' && options.catchErrors) {
			delete options.catchErrors;	// unset so default gets set
		}
		options = _.defaults(options, defaultOptions);

		// var threads = new Queue();//Array(options.concurrency);
		var threadCount = 0;
		var writeCount = 0;
		var debugThreadInterval = null;

		promiseFunctions = self.chainPromiseFuncs(promiseFunctions);
		console.debug(`writeablePromiseStream(${args.join(', ')}): options=${inspect(options, { compact: true })} promiseFucntions=${promiseFunctions.toString()}`);
		
		return /*_.set*/(through2Concurrent.obj({ maxConcurrency: options.concurrency }, function (data, enc, callback) {

			writeCount++;
			threadCount++;
			// if (!debugThreadInterval) {
			// 	console.debug(`!debugThreadInterval`);
			// 	debugThreadInterval = setInterval(() => {
			// 		console.verbose(`writeablePromiseStream.write start: writeCount=${writeCount} threadCount=${threadCount}`);//data=${inspect(data instanceof mongoose.Document ? data.toObject() : data, { compact: true })}`);
			// 	}, 5000);
			// }
			console.debug(`through2Concurrent.obj(${inspect(options, {compact:true})}): writeCount=${writeCount} threadCount=${threadCount} data=${inspect(data, { compact:true })}`);
			
			promiseFunctions(data)
			.then(newData => {
				if (options.dataThru) {
					this.push(newData);
				}
				threadCount--;
				// process.nextTick(() =>
				 callback();
				 // );
				 return newData;
			})
			.catch(err => {
				threadCount--;
				Object.defineProperty(err, 'promisePipeData', { enumerable: true, value: /*_.clone*/(data) });
				if (options.catchErrors && typeof options.catchErrors === 'function') {
					options.catchErrors(err);
					// process.nextTick(() =>
					 callback();
					 // );
				} else {
					process.nextTick(() => callback(err));
				}
			}).done();

		}));/*, function(cb) {
			console.verbose(`through2Concurrent.obj.flush: debugThreadInterval=${debugThreadInterval} writeCount=${writeCount} threadCount=${threadCount}`);
			// if (debugThreadInterval) {
			// 	clearInterval(debugThreadInterval);
			// 	debugThreadInterval = null;
			// }
			cb();
		})*///, 'options', options);
	},

	chainPromiseFuncs(...args) {
		var chain;
		if (args.length === 1) {
			if (typeof args[0] === 'function') {
				return data => args[0](data);
			} else if (_.isArray(args[0])) {
				chain = args[0];
			} else {
				throw new TypeError(`chainPromiseFuncs: args: ${typeof args} ${inpect(args, { compact: false })}`);
			}
		} else {
			chain = args;
		}
		return data => _.reduce(chain, (chain, current) => chain.then(current), Q(data));
	},

	tap(fn) { 	// a thenable function for tapping the promise value tpo call a function, but returning the original value   
		return (v => Q(fn(v)).then(() => v));
	},
	
	conditionalPipe(condition, ...pipe1) {//, pipe2 = null) {
		return (data => condition(data) ? (self.chainPromiseFuncs(pipe1))(data).catch(() => data).then(() => data) : data);// (pipe2 ? self.chainPromiseFuncs(pipe2sdata) : data));
	},

	iff(condition, ...pipe1) {//, pipe2 = null) {
		return (data => (condition(data) ? (self.chainPromiseFuncs(pipe1))(data).catch(() => data).then(() => data) : data));// (pipe2 ? self.chainPromiseFuncs(pipe2sdata) : data));
	},

	streamPromise(stream, options = {}) {
		options = _.defaults(options, { resolveEvent: 'finish',/* 'end',*/ rejectEvent: undefined/*'error'*/ });
		return pEvent(stream, options.resolveEvent, !options.rejectEvent ? {} : { rejectionEvents: [ options.rejectEvent ] });
	}

};

module.exports = self;
