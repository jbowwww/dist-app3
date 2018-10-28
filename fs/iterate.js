"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'log' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
// const util = require('util');
const _ = require('lodash');
const fs = require('fs');
const nodePath = require('path');
const Q = require('q');
Q.longStackSupport = true;

const fsLstat = Q.denodeify(fs.lstat);
const fsReaddir = Q.denodeify(fs.readdir);

const pathDepth = require('./path-depth.js');

// Iterate over file system structure at a given path
module.exports = /* fs.iterate
// options is optinoal
// options.filter: can be a function that takes a path and returns boolean, or a regex
// pipeStream (optional): a writeable stream that the fs.iterate readable stream will pipe too, except fs.iterate will still return its own readable unlike
*/
function iterate(options) {
	options = _.assign({ path: '.', queueMethod: 'shift', filter: undefined, maxDepth: 1, objectMode: true, highWaterMark: 8 }, options);
	var path = nodePath.resolve(options.path);
  	console.verbose(`iterate('${path}', ${inspect(options)})`);
	var self = _.extend({
		root: path,
		rootDepth: pathDepth(path),
		paths: [path],
		errors: []
	}, new require('stream').Readable({
		objectMode: true,
		read: function (size) {
			return (function next() {
				if (!self.paths.length) {
					if (self.errors.length) {
						console.warn(`iterate('${self.root}'): stream end: ${self.errors.length} errors: ${self.errors.join('\n\t')}`);
					} else {
						console.debug(`iterate('${self.root}'): stream end`);
					}
					// process.nextTick(() => {
					self.push(null);
					// self.emit('end');
					// })
					;
					return 0;
				}
				var path = self.paths[options.queueMethod]();
				try {
					fs.lstat(path, (err, stats) => {
						if (err) return nextHandleError(err);
						var item = { path, stats, fileType: stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : 'unknown' };
						if (!stats.isDirectory()) return self.push(item);
						var currentDepth = pathDepth(item.path) - self.rootDepth + 1;	// +1 because below here next files are read from this dir
						if (((options.maxDepth === 0) || (currentDepth <= options.maxDepth)) && (!options.filter || options.filter(item))) {
							fs.readdir(path, (err, names) => {
								if (err) return nextHandleError(err);
								// if (options.filter) names = names.filter(typeof options.filter !== 'function' ? name => name.match(options.filter): options.filter);
								console.verbose(`${names.length} entries at depth=${currentDepth} in dir:${item.path} self.paths=[${self.paths.length}]`);
								_.forEach(names, name => self.paths.push(nodePath.join(path, name)));
								return self.push(item);
							});
						} else {
							return self.push(item);
						}
					});
				} catch (err) {
					return nextHandleError(err);
				}
				function nextHandleError(err) {
					console.warn(`iterate: ${err.stack||err}`);
					self.errors.push(err);
					process.nextTick(() => self.emit('error', err));
					return next();//1;
				}
			})();
		}
	}))
	.on('close', (...args) => console.verbose(`iterate: close: ${inspect(args)}`))
	.on('end', (...args) => console.verbose(`iterate: end: ${inspect(args)}`))
	.on('error', (err, ...args) => console.warn(`iterate: err: ${err.stack||err} ${inspect(args)}`))
	return self;
	// var r = self;//promisifyEmitter(self, { errorEvent: null });
	// r.promisePipe = function(writeable) {  return promisifyEmitter(r.pipe(writeable)); };//, { errorEvent: null }
	// r.then((...args) => { console.verbose(`iterate.then: ${inspect(args)}`); });
	// return r;
};
