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

module.exports.iterate = function fsIterate(options, ...promisePipeFuncs) {
	options = _.defaults(options, { searches: [], saveImmediate: false, concurrency: 8 });
	return Q.all(_.map(options.searches, search =>
		promisePipe({ concurrency: options.concurency },
			rawFsIterate(search),
			fs => FsEntry.findOrCreate({ path: fs.path }, fs, { saveImmediate: fs.fileType === 'dir' || options.saveImmediate }),
			fs => fs.fileType !== 'dir' && !options.saveImmediate ? fs.bulkSave() : fs,
			...promisePipeFuncs)));
};

module.exports.FsEntry = FsEntry;
module.exports.Disk = Disk;
module.exports.Dir = Dir;
module.exports.File = File;
