"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'log' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
// const util = require('util');
const _ = require('lodash');
const nodeFs = require('fs');
const nodePath = require('path');
const Q = require('q');
Q.longStackSupport = true;

const getDevices = require('./devices.js');

const pathDepth = require('./path-depth.js');

// Iterate over file system structure at a given path
module.exports = /* fs.iterate
// options is optinoal
// options.filter: can be a function that takes a path and returns boolean, or a regex
// pipeStream (optional): a writeable stream that the fs.iterate readable stream will pipe too, except fs.iterate will still return its own readable unlike
*/
function /*async*/ iterate(options) {
	options = _.assign({ path: '.', queueMethod: 'shift', filter: undefined, maxDepth: 1, removePathPrefix: undefined, objectMode: true, highWaterMark: 8 }, options);
	var path = nodePath.resolve(options.path);
	var drive;
	getDevices().then(drives => {
  		drive = _.find(_.sortBy(_.filter(drives,
	  			drive => typeof drive.mountpoint === 'string'),
	  		drive => drive.mountpoint.length ),
	  	drive => path.startsWith(drive.mountpoint));
	  	console.verbose(`iterate('${path}'): drive=${inspect(drive)}`);
  	});
  	console.verbose(`iterate('${path}', ${inspect(options)})`);
  	var dirName = nodePath.dirname(path);
	var self = _.extend({
		root: path,
		rootDepth: pathDepth(path),
		paths: [{ path/*, dir: { path: dirName, stats: nodeFs.lstatSync(dirName) }*/ }],
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
				var item = self.paths[options.queueMethod]();
				try {
					nodeFs.lstat(item.path, (err, stats) => {
						if (err) return nextHandleError(err);
						item.stats = stats;
						// item.drive = drive;
						item.fileType = stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : 'unknown';
						var currentDepth = pathDepth(item.path) - self.rootDepth + 1;	// +1 because below here next files are read from this dir
						if (item.fileType === 'dir' && ((options.maxDepth === 0) || (currentDepth <= options.maxDepth)) && (!options.filter || options.filter(item))) {
							nodeFs.readdir(item.path, (err, names) => {
								if (err) return nextHandleError(err);
								// if (options.filter) names = names.filter(typeof options.filter !== 'function' ? name => name.match(options.filter): options.filter);
								console.debug(`${names.length} entries at depth=${currentDepth} in dir:${item.path} self.paths=[${self.paths.length}]`);
								_.forEach(names, name => self.paths.push({ path: nodePath.join(item.path, name)/*, dir: item, drive*/ }));
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
