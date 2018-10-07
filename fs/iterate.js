"use strict";

const console = require('../stdio.js').Get('fs-iterate', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('../utility.js').makeInspect({ depth: 2, breakLength: 0 });
// const util = require('util');
const _ = require('lodash');
const fs = require('fs');
const nodePath = require('path');
const Q = require('q');

const FsEntry = require('../model/fs-entry.js');
const File = require('../model/file.js');
const Dir = require('../model/dir.js');

const fsLstat = Q.denodeify(fs.lstat);
const fsReaddir = Q.denodeify(fs.readdir);

const pathDepth = require('./path-depth.js');

// Iterate over file system structure at a given path
module.exports = function iterate(options) {
	options = _.assign({
		path: '.',
		includeTopLevelDirectory: true,
		queueMethod: 'shift',
		filter: name => true,	// TODO: removed regex support below, re-add by checvking for regex and converting to filter func
		maxDepth: 1,
		fileHandler() {},// = () => (),
		dirHandler() {},// = () => (),
		unknownHandler() {},
		errHandler() {},// = () => ()
	}, options);
	
	var path = nodePath.resolve(options.path);
	var self = {
		rootDepth: pathDepth(path),
		paths: [path]
	};

	console.verbose(`iterate(): options=${inspect(options)} self=${inspect(self)}`);

	return (function iterateNext() {
		var path = self.paths[options.queueMethod]();
		var depth = pathDepth(path) - self.rootDepth;// + 1;
		console.debug(`iterateNext(): typeof path=${typeof path} path='${path}' self.paths=${inspect(self.paths)}`);
		return fsLstat(path).then(stats =>
			FsEntry.findOrCreate({ path }, { path, stats }).then(fsEntry =>
			stats.isFile() ? options.fileHandler(fsEntry /*new File({ path, stats })*/ )
		: 	stats.isDirectory() ? Q(depth === 0 && !options.includeTopLevelDirectory ? null : options.dirHandler(fsEntry /*new Dir({ path, stats })*/ )).then(recurseDir =>
				((typeof recurseDir === 'boolean' && recurseDir === false) || (options.maxDepth !== 0 && depth > options.maxDepth)) ? Q()
			:	fsReaddir(path).tap(names => self.paths = _.concat(self.paths, _.filter(names, options.filter).map(name => nodePath.join(path, name)))))
		: 	options.unknownHandler(fsEntry /*new FsEntry({ path, stats })*/) ) )
		.then(() => self.paths.length ? iterateNext() : Q())
		.catch(options.errHandler);
	})();
}
