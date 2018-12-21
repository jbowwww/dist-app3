"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
const promisifyMethods = require('../utility.js').promisifyMethods;
const _ = require('lodash');
const nodeFs = promisifyMethods(require('fs'));
const nodePath = require('path');
const Q = require('q');
Q.longStackSupport = true;

const getDevices = require('./devices.js');

const pathDepth = require('./path-depth.js');

// creates a POJO FS item to be used by iterate. Takes a path and returns an object containing path, stats, and fileType
module.exports = {

	createFsItem, iterate };

	function createFsItem(path) {
		return nodeFs.lstat(path).then(stats => ({
			path,
			stats,
			get fileType() { return stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : 'unknown'; },
			get pathDepth() { return pathDepth(this.path); }
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
			highWaterMark: 8,
			handleError(err) {
				console.warn(`iterate: ${err.stack||err}`);
			}
		});

		var path = nodePath.resolve(options.path);
		console.verbose(`iterate('${path}', ${inspect(options)})`);
	  	
	  	var drive;/*
		getDevices().then(drives => {
	  		drive = _.find(_.sortBy(_.filter(drives,
		  			drive => typeof drive.mountpoint === 'string'),
		  		drive => drive.mountpoint.length ),
		  	drive => path.startsWith(drive.mountpoint));
		  	console.verbose(`iterate('${path}'): drive=${inspect(drive)}`);
	  	});*/

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
						self.push(null);
						return 0;
					}
					
					createFsItem(self.paths[options.queueMethod]()).then(item => {
						var currentDepth = item.pathDepth - self.rootDepth + 1;	// +1 because below here next files are read from this dir
						if (item.fileType === 'dir' && ((options.maxDepth === 0) || (currentDepth <= options.maxDepth)) && (!options.filter || options.filter(item))) {
							nodeFs.readdir(item.path).then(names => {
								// if (options.filter) names = names.filter(typeof options.filter !== 'function' ? name => name.match(options.filter): options.filter);
								console.debug(`${names.length} entries at depth=${currentDepth} in dir:${item.path} self.paths=[${self.paths.length}]`);
								_.forEach(names, name => self.paths.push(/*{ path:*/ nodePath.join(item.path, name)/*, dir: item, drive*/ /*}*/));
								/*return*/ self.push(item);
							}).catch(err => nextHandleError(err));
						} else {
							/*return*/ self.push(item);
						}
					}).catch(err => nextHandleError(err));

					function nextHandleError(err) {
						options.handleError(err);
						self.errors.push(err);
						// process.nextTick(() =>
						 self.emit('error', err);
						 // );
						return next();//1;
					}

				})();
			}

		}))

		.on('close', (...args) => console.verbose(`iterate: close: ${inspect(args)}`))
		.on('end', (...args) => console.verbose(`iterate: end: ${inspect(args)}`))
		.on('error', (err, ...args) => console.warn(`iterate: err: ${err.stack||err} ${inspect(args)}`))
		
		return self;
	}
// };
