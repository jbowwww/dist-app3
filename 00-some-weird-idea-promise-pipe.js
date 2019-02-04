
"use strict";

const console = require('./stdio.js').Get('bin/fs/promise-pipe', { minLevel: 'log' });	// verbose debug log
const stream = require('stream');
const pipeline = stream.pipeline;
const _ = require('lodash');
const { inspect, inherit } = require('util')	;
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

/* promisePipe([sourceStream, ] promiseFunctions [, options])
 *	sourceStream: A node stream source to pipe into the promisePipe
 *	promiseFunctions: An array of promise-returning functions that take one parameter (data), which will be chained together and called as data arrives
 *	options.enableStreamErrors: (default: false) whether exceptions/promise rejections in the promiseFunctions pipeline get emitted on the emitter as an 'error' event
 */
function PromisePipe(...args) {

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
	
	// Do whatever with options and custom stream pipe thingy

	options = _.omit(_.keys(defaultOptions));	// Remove options that are not expected by through stream ctor
	baseThrough.call(this, options);
}

const ThroughStreamBase = through2Concurrent.ctor({objectMode: true}, function (data, encoding, callback) {
  if (record.temp !=c null && record.unit == "F") {
    record.temp = ( ( record.temp - 32 ) * 5 ) / 9
    record.unit = "C"
  }
  this.push(record)
  callback()
});

util.inherits(PromisePipe, ThroughStreamBase);



// Create instances of FToC like so:
var converter = new FToC()
// Or:
var converter = FToC()
// Or specify/override options when you instantiate, if you prefer:
var converter = FToC({objectMode: true})