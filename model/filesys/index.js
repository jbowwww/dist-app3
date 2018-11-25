"use strict";

const console = require('../../stdio.js').Get('model/fs/filesys', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
const rawFsIterate = require('../../fs/iterate.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, ifPipe, conditionalTap, streamPromise }  = require('../../promise-pipe.js');

const FsEntry = require('./filesys-entry.js');
const Disk = require('./disk.js');
const Dir = require('./dir.js');
const File = require('./file.js');

const Artefact = require('../../Artefact.js');

module.exports.iterate = function fsIterate(options) {
	return promisePipe(
		{ concurrency: 8 },
		rawFsIterate(options),			// Iterate the filesystem , populating the disk field on fsEntry dsocuments
		// fs => fs.dir ?  Dir.findOrCreate({ path: fs.dir.path }).then(dir => _.set(fs, 'dir', dir)) : fs,
		// fs => fs.disk ? Disk.findOrCreate({ path: fs.disk.path }).then(disk => _.set(fs, 'disk', disk)) : fs,
		fs => FsEntry.findOrCreate({ path: fs.path }, fs),
		fs => Artefact(fs));
};

module.exports.FsEntry = FsEntry;
module.exports.Disk = Disk;
module.exports.Dir = Dir;
module.exports.File = File;
