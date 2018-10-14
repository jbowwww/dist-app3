
"use strict";

const console = require('./stdio.js').Get('bin/fs/source-pipe', { minLevel: 'verbose' });	// verbose debug log
const stream = require('stream');
const _ = require('lodash');
const inspect = require('util').inspect;
const Q = require('q');
const pEvent = require('p-event');

var self = {

	chainPromiseFuncs(chain) {
		return data => _.reduce(chain, (chain, current) => chain.then(current), Q(data));
	},

	/* promisePipe([sourceStream, ] promiseFunctions [, options])
	 *	sourceStream: A node stream source to pipe into the promisePipe
	 *	promiseFunctions: An array of promise-returning functions that take one parameter (data), which will be chained together and called as data arrives
	 *	options.enableStreamErrors: (default: false) whether exceptions/promise rejections in the promiseFunctions pipeline get emitted on the emitter as an 'error' event
	 */
	promisePipe(sourceStream, promiseFunctions, options = {}) {
		if (!sourceStream || !sourceStream.on) {
			throw new TypeError(`sourceStream must be a node stream emitter`);
		}
		if (_.isArray(promiseFunctions) && _.every(promiseFunctions, element => _.isFunction(element))) {
			promiseFunctions = self.chainPromiseFuncs(promiseFunctions);
		}
		if (typeof promiseFunctions !== 'function') {
			throw new TypeError(`promiseFunctions must be a function, but is ${typeof promiseFunctions}: ${inspect(promiseFunctions)}`);
		}
		options = _.defaults(options, {	enableStreamErrors: false });
		console.debug(`promiseFunctions: ${/*inspect*/(promiseFunctions)}`);

		/* The way this is set up, a promisePipe is potentially an array with multiple promise-returning func's
		 * If it is, the func's are chained together in a way that is sort of similar to a thru-stream (i think)
		 * Am I better piping to a series of thru streams, each representing one of the promisePipe functions (assuming an array of them) ?
		 * - This way (promise-returning func's chained) may actually be at least as good as using thru-streams, but have a proper think of it/experiment/test
		 * 	- Particularly with respect to buffering/stream flow control. As is, the aggregated promisePipe could potentially cause the source stream to pause
		 * 	  and/or the stream data to get buffered, as it will not call the callback for stream.Writeable.write until the promiseChain is fulfilled
		 * I think this is all ok, just give it a good proper think through and run experiemnts/tests if necessary */
		return pEvent(
			sourceStream.pipe(
				new stream.Writable({
					objectMode: true,
					write(data, encoding, callback) {
						promiseFunctions(data)//.finally(() => callback()).done();
						.then(newData => { callback(null /*, newData*/ ); })		// pass newData as 2nd arg if using a thru stream instead of a writeable
						.catch(err => {
							console.warn(`warning: ${err.stack||err}`);
							options.enableStreamErrors ? callback(err) : callback();
						})
						.done();
					}
				})
			), 'finish'
		);
	},

	conditional(condition, pipe1, pipe2 = null) {
		return (data => condition(data) ? pipe1(data) : (pipe2 ? pipe2(data) : data));
	}

};

module.exports = self;
