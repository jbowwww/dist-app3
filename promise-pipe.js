
"use strict";

const console = require('./stdio.js').Get('bin/fs/source-pipe', { minLevel: 'log' });	// verbose debug log
const stream = require('stream');
const _ = require('lodash');
const inspect = require('util').inspect;
const Q = require('q');

module.exports = function promisePipe(promiseFunctions/*, options*/) {
	var promisePipe;
	if (_.isArray(promiseFunctions) && _.every(promiseFunctions, element => _.isFunction(element))) {
		promisePipe = data => _.reduce(promiseFunctions, (chain, current) => chain.then(current), Q(data));
	} else if (typeof promiseFunctions === 'function') {
		promisePipe = data => promiseFunctions(data);
	} else {
		throw new TypeError(`promiseFunctions must be a function, but is ${typeof promiseFunctions}: ${inspect(promiseFunctions)}`);
	}
	console.verbose(`promisePipe: promiseFunctions=${inspect(promisePipe)}`);
	/* The way this is set up, a promisePipe is potentially an array with multiple promise-returning func's
	 * If it is, the func's are chained together in a way that is sort of similar to a thru-stream (i think)
	 * Am I better piping to a series of thru streams, each representing one of the promisePipe functions (assuming an array of them) ?
	 * - This way (promise-returning func's chained) may actually be at least as good as using thru-streams, but have a proper think of it/experiment/test
	 * 	- Particularly with respect to buffering/stream flow control. As is, the aggregated promisePipe could potentially cause the source stream to pause
	 * 	  and/or the stream data to get buffered, as it will not call the callback for stream.Writeable.write until the promiseChain is fulfilled
	 * I think this is all ok, just give it a good proper think through and run experiemnts/tests if necessary */
	return new stream.Writable({
		objectMode: true,
		write(data, encoding, callback) {
			promisePipe(data)
			.then(newData => { callback(null /*, newData*/); })		// pass newData as 2nd arg if using a thru stream instead of a writeable
			// .catch(err => { callback(err); })		// callback(err) will emit('error') on the stream, handled by options.onError. User should catch() in their promisePipe to avoid erroring the stream
			.done();
		}
	});
};
