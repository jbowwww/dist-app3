"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
const promisifyMethods = require('../utility.js').promisifyMethods;
const util = require('util');
const _ = require('lodash');
const nodeFs = promisifyMethods(require('fs'));
const nodePath = require('path');
const Q = require('q');
Q.longStackSupport = true;
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, ifPipe, conditionalTap, streamPromise }  = require('../promise-pipe.js');
const getDevices = require('./devices.js');
const pathDepth = require('./path-depth.js');

// creates a POJO FS item to be used by iterate. Takes a path and returns an object containing path, stats, and fileType
module.exports = {

	createFsItem, iterate };
	
	// TODO: Move this to models/filesys/index to a Fs.iterate() method
	function createFsItem(path) {
		return nodeFs.lstat(path).then(stats => ({
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
		}));
	};
	
	function iterate(options) {
		
		options = _.defaults(options, {
			path: '.',
			maxDepth: 1,
			queueMethod: 'shift',
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
	  	
		var self = _.extend({
			
			root: path,
			rootDepth: path.split(nodePath.sep).length - 1,
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
						self.push(null);
						return 0;
					}
					
					createFsItem(self.paths[options.queueMethod]()).then(item => {
						if (!options.filter || options.filter(item)) {
							var currentDepth = item.pathDepth; - self.rootDepth;	// +1 because below here next files are read from this dir
							if (item.fileType === 'dir' && ((options.maxDepth === 0) || (currentDepth <= options.maxDepth + self.rootDepth))/* && (!options.filter || options.filter(item))*/) {
								nodeFs.readdir(item.path).then(names => {
									console.debug(`${names.length} entries at depth=${currentDepth} in dir:${item.path} self.paths=[${self.paths.length}] item=${inspect(item)}`);
									_.forEach(names, name => self.paths.push(/*{ path:*/ nodePath.join(item.path, name)/*, dir: item, drive*/ /*}*/));
									/*return*/ self.push(item);
								}).catch(err => nextHandleError(err));
							} else {
								/*return*/ self.push(item);
							}
						}
					}).catch(err => nextHandleError(err));

					function nextHandleError(err) {
						options.handleError(err);
						self.errors.push(err); // process.nextTick(() => // self.emit('error', err);// );
						return next();
					}

				})();
			}
		}), {
			promisePipe(...args) {
				return promisePipe(self, ...args);
			}
		})

		.on('close', (...args) => console.verbose(`iterate: close: ${inspect(args)}`))
		.on('end', (...args) => console.verbose(`iterate: end: ${inspect(args)}`))
		.on('error', (err, ...args) => console.warn(`iterate: err: ${err} ${inspect(args)}`))
		
		return self;
	}
// };
