
"use strict";

const console = require('./stdio.js').Get('bin/fs/promise-pipe', { minLevel: 'log' });	// verbose debug log
const stream = require('stream');
const pipeline = stream.pipeline;
const _ = require('lodash');
const inspect = require('util').inspect;
const Q = require('q');
const pEvent = require('p-event');
const through2Concurrent = require('through2-concurrent');
const PromisePipeError = require('./promise-pipe-error.js');

PromisePipe.defaultOptions = {
	concurrency: 1
};
PromisePipe.stream = function PromisePipe_stream(...args) {
	return new PromisePipe(...args).stream();
};

// standard args for promisePipe and related funcs. Returns { options, pipeline } where options is POJO and pipeline is array of functions or promisePipes
function getArgs(args) {
	var options, pipeline = [];
	_.forEach(args, (arg, i) => {
		if (_.isArray(arg) && _.every(arg, a => _.isFunction(a) || a._isStream)) {
			pipeline = _.slice(arg);
		} else if (typeof arg === 'object') {
			if (pipeline.length > 0) {
				throw new TypeError('promisePipe: arguments must end with promise functions');
			}
			options = arg;
		} else if (typeof arg === 'function') {
			pipeline.push(arg);
		} else {
			throw new TypeError(`promisePipe: Argument #${i} unknown type '${typeof arg}'`);
		}
	});
	options = _.defaults(options, PromisePipe.defaultOptions);
	return { options, pipeline };
}

function PromisePipe(...args) {
	if (args.length === 1 && args[0] instanceof PromisePipe) {
		return args[0];
	} else if (!(this instanceof PromisePipe)) {
		return new PromisePipe(...args);
	}
	var { options, pipeline } = getArgs(args);
	this.options = options;
	this.pipeline = pipeline;
	this.threadCount = 0;
	this.writeCount = 0;
	this.stages = [];
}

PromisePipe.prototype = {
	set pipeline(pipeline) {
		if (!_.isArray(pipeline) || !_.every(pipeline, p => p instanceof PromisePipe || _.isArray(p) || typeof p === 'function')) {
			throw new TypeError(`pipeline is not an array with elements of type function, array or PromisePipe, it is type ${typeof pipeline}: ${inspect(pipeline, { compact: true })}`);
		}
		this._pipeline = pipeline;
		this._run = this._build();
	},
	get pipeline() {
		return this._pipeline;
	},

	async run(data) {
		return this._run(data);
	},
	threadCount: undefined,
	writeCount: undefined,

	stream(options = {}) {
		options = _.defaults(options, this.options, PromisePipe.options);
		var self = this;
		return through2Concurrent.obj({ maxConcurrency: options.concurrency }, function (data, enc, callback) {
			try {
				self.run(data)
				.then(newData => callback(null, newData))
				.catch(err => process.nextTick(() => callback(new PromisePipeError(self, data, err))));
			} catch (err) {
				err = new PromisePipeError(self, data, err);
				self.error = err;
				callback(err);
			}
		});
	},

	_build() {
		this.stages = _.map(pipeline, stage => ({
			stage: stage instanceof PromisePipe ? stage.run.bind(stage)
			 : 	_.isArray(stage) ? (stage = new PromisePipe(this.options, stage)).run.bind(stage)
			 : 	stage,
		 	threadCount: 0,
			writeCount: 0,
			data: null
		}));
		var innerPipeline = _.map(this.stages, (stage, i) => async data => {
			stage.threadCount++;
			stage.writeCount++;
			stage.data = data;
			try {
				return await stage.stage(data);
			} catch (err) {
				err = new PromisePipeError(this, data, err);
				stage.error = this.error = err;
			} finally {
				stage.data = null;
				stage.threadCount--;
			}
		});
		var innerRun = _.flow(innerPipeline);//_.reduce(innerPipeline, (innerPipeline, current) => innerPipeline.then(current), Q(data))
		this._run = async data => {
			this.threadCount++
			this.writeCount++;
			// try {
				return innerRun.call(this, data);
			// } catch(err) {

			// }			
		};
		return this._run;
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
		return _.extend(
			pEvent(stream, options.resolveEvent, !options.rejectEvent ? {} : { rejectionEvents: [ options.rejectEvent ] }),
			{
				promisePipe(...args) {
					return self.promisePipe(stream, ...args);
				}
			});
	}

};

module.exports = PromisePipe;
