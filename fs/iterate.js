"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
const promisifyMethods = require('../utility.js').promisifyMethods;
const util = require('util');
const _ = require('lodash');
const nodeFs = promisifyMethods(require('fs'));
const nodePath = require('path');
const stream = new require('stream');
stream.finished = util.promisify(stream.finished);
var pipeline = util.promisify(stream.pipeline);
const PromisePipe = require('../promise-pipe.js');
const Q = require('q');
Q.longStackSupport = true;
const getDevices = require('./devices.js');
const pathDepth = require('./path-depth.js');

// creates a POJO FS item to be used by iterate. Takes a path and returns an object containing path, stats, and fileType
module.exports = { createFsItem, iterate };

function createFsItem(path, stats) {
	return ({
		path: /*nodePath.resolve*/(path),
		stats,
		get fileType() { return stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : 'unknown'; },
		get pathDepth() { return this.path.split(nodePath.sep).length - 1; },
		get extension() {
			var n = this.path.lastIndexOf('.');
			var n2 = Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\'));
			return (n < 0 || (n2 > 0 && n2 > n)) ? '' : this.path.slice(n + 1);
		},
		[util.inspect.custom](depth, options) {
			return _.assign({}, this);
		}
	});
}

async function* iterate(options) {
	options = _.defaults(options, {
		path: '.',
		maxDepth: 1,
		// queueMethod: 'shift',
		filter: undefined,
		// removePathPrefix: undefined,
		objectMode: true,
		highWaterMark: 16,
		handleError(err) {
			console.warn(`iterate: ${err}`);//${err.stack||err}`);
		}
	});
	
	var path = nodePath.resolve(options.path);
	console.verbose(`iterate('${path}', ${inspect(options, { compact: false })})`);
  	
	var self = {
		
		root: path,
		// rootDepth: path.split(nodePath.sep).length - 1,
		rootItem: null,
		paths: [path],
		errors: [],
		promisePipe(...args) { return /*stream.finished*/(pipeline(self, new PromisePipe(...args).stream())); },
		task: { max: 1, current: 0 }
	};
_.assign(iterate.prototype, self);
	// yield (async function* next() {
		for (let i = 0; i < self.paths.length; i++) { //self.paths.length) {
			var path = self.paths[i];//options.queueMethod]();
			
			self.task.max = self.paths.length;
			self.task.current = i;

			var stats = await nodeFs.lstat(path);
			var item = createFsItem(path, stats);
			if (path === self.root) {
				self.rootItem = item;
			}

			if (!options.filter || options.filter(item)) {
				var currentDepth = item.pathDepth; - self.rootItem.pathDepth/*self.rootDepth*/;	// +1 because below here next files are read from this dir
				if (item.fileType === 'dir' && ((options.maxDepth === 0) || (currentDepth <= options.maxDepth + self.rootItem.pathDepth/*self.rootDepth*/))/* && (!options.filter || options.filter(item))*/) {
					var names = await nodeFs.readdir(item.path);
						// .then(names => {
						// if (options.filter) names = names.filter(typeof options.filter !== 'function' ? name => name.match(options.filter): options.filter);
						console.debug(`${names.length} entries at depth=${currentDepth} in dir:${item.path} self.paths=[${self.paths.length}] item=${inspect(item)}`);
						_.forEach(names, name => self.paths.push(/*{ path:*/ nodePath.join(item.path, name)/*, dir: item, drive*/ /*}*/));

						yield item;
						// next();
					// }).catch(err => nextHandleError(err));
				} else {
					yield item;
					// next();
				}
			}
		}
	// })();
			// .catch(err => {
			// 	console.error(err);
			// 	return next()
			// });
		
		// }
	// })();
	if (self.errors.length) {
		console.warn(`iterate('${self.root}'): stream end: ${self.errors.length} errors: ${self.errors.join('\n\t')}`);
	} else {
		console.debug(`iterate('${self.root}'): stream end`);
	}
	return;
	function nextHandleError(err) {
		options.handleError(err);
		self.errors.push(err);
		// process.nextTick(() =>
		 self.emit('error', err);
		 // );
		return next();//1;
	}
}
