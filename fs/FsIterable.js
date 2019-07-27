"use strict";

const console = require('../stdio.js').Get('fs/iterate', { minLevel: 'debug' });	// console verbose log
// const debug = require('debug')('fs/iterate.js');
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0, compact: false });
const promisifyMethods = require('../utility.js').promisifyMethods;
const util = require('util');
const _ = require('lodash');
const Queue = require('../Queue.js');
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
const { trace } = require('../Task.js');
const inspectWithGetters = function(wrapped, inspectFn) {
	return Object.assign(wrapped, {
		[util.inspect.custom]: typeof inspectFn === 'function' ? inspectFn
		 : () => inspect(_.assign({}, wrapped))
	});
};
const inspectArray = function(wrapped, inspectFn) {
	return Object.assign(wrapped, {
		[util.inspect.custom]: typeof inspectFn === 'function' ? inspectFn
		 : () => 'Array[' + this.items.length + ']'
	});
};

module.exports = /*trace*/({ FsIterable });

function FsIterable(options) {
	if (!(this instanceof FsIterable)) {
		return new FsIterable(options);
	} else if (typeof options === 'string') {
		options = { path: options };
	}
	const fsIterable = this;
	this.options = options = _.defaults(options, {
		path: nodePath.resolve(options.path || '.'),
		maxDepth: 1,
		filter: item => true,
		handleError(err) { console.warn(`iterate: ${err/*.stack*/}`); }
	});
	this.root = options.path;
	this.rootItem = null;
	this.count = inspectWithGetters({
		file: 0,
		dir: 0,
		unknown: 0,
		get all() { return this.file + this.dir + this.unknown; }
 	});
	this.errors = [];
	this.items = inspectWithGetters([], () => 'Array[' + this.items.length + ']');
	this.itemIndex = 0;
	this[Symbol.asyncIterator] = async function* () {
		while (this._fsIterateInnerCalls > 0 || this.itemIndex < this.items.length) {
			yield this.items[this.itemIndex++];
		}
		this.itemIndex = 0;
	};

	console.verbose(`FsIterate(${inspect(options, { compact: false })}): this=${inspect(this, { compact: false })}`);
	
	this.progress = inspectWithGetters({
		get total() { return fsIterable.count.all; },
		get current() { return fsIterable.itemIndex; },
		get progress() { return this.total === 0 ? 0 : 100 * fsIterable.itemIndex / this.total; }
	});

	this._fsIterateInnerCalls = 0;
	const fsIterateInner = async path => {
		try {
			this._fsIterateInnerCalls++;
			var stats = await nodeFs.lstat(path);
			var item = inspectWithGetters({
				path: /*nodePath.resolve*/(path),
				stats,
				get fileType() { return stats.isDirectory() ? 'dir' : stats.isFile() ? 'file' : 'unknown'; },
				get pathDepth() { return this.path.split(nodePath.sep).length - 1; },
				get extension() {
					var n = this.path.lastIndexOf('.');
					var n2 = Math.max(this.path.lastIndexOf('/'), this.path.lastIndexOf('\\'));
					return (n < 0 || (n2 > 0 && n2 > n)) ? '' : this.path.slice(n + 1);
				}
			});
			if (path === this.root) {
				this.rootItem = item;
			}
			if (!this.options.filter || this.options.filter(item)) {
				var currentDepth = item.pathDepth; - this.rootItem.pathDepth
				this.items.push(item);
				this.count[item.fileType]++;
				if (item.fileType === 'dir' && ((this.options.maxDepth === 0) || (currentDepth <= this.options.maxDepth + this.rootItem.pathDepth))) {
					var names = (await nodeFs.readdir(item.path)).filter(this.options.filter);
					console.debug(`${names.length} entries at depth=${currentDepth} in dir:${item.path} this.items=[${this.items.length}] item=${inspect(item)}`);
					await Promise.all(names.map(name => fsIterateInner(nodePath.join(item.path, name))));
				}
			}
		} catch (e) {
			this.errors.push(e);
			this.options.handleError(e);
		} finally {
			this._fsIterateInnerCalls--;
		}
	};
	fsIterateInner(this.options.path);
}
