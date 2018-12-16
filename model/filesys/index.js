"use strict";

const console = require('../../stdio.js').Get('model/fs/filesys', { minLevel: 'verbose' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
const _ = require('lodash');
const Q = require('q');
const { createFsItem, iterate } = require('../../fs/iterate.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, ifPipe, conditionalTap, streamPromise }  = require('../../promise-pipe.js');

const FsEntry = require('./filesys-entry.js');
const Disk = require('./disk.js');
const Dir = require('./dir.js');
const File = require('./file.js');

const Artefact = require('../../Artefact.js');

module.exports.iterate = function fsIterate(options, ...promisePipeFuncs) {
	options = _.defaults(options, { searches: [], saveImmediate: false, concurrency: 8 });
	return Q.all(_.map(options.searches, search => createFsItem(search.path)
		.then(searchRootDir => FsEntry.findOrCreate({ path: searchRootDir.path }, searchRootDir))
		.then(searchRootDirDoc => searchRootDirDoc.save())
		// .then(searchRootDirDoc => Artefact(searchRootDirDoc))
		// .tap(a => console.verbose(`a=${inspect(a)}`))
		.then(searchRootDirDoc => promisePipe(
			iterate(search),
			{ concurrency: options.concurency },			 //promisePipe({ concurrency: options.concurency },
			fs => FsEntry.findOrCreate({ path: fs.path }, fs, { saveImmediate: fs.fileType === 'dir' || options.saveImmediate }),	//false }),
			fs => Artefact(fs),
			a => a.dir || options.saveImmediate ? a/*.save()*/ : a.bulkSave(),		// saves at least directories immediately, because files may reference them 
			...promisePipeFuncs))));
};

module.exports.FsEntry = FsEntry;
module.exports.Disk = Disk;
module.exports.Dir = Dir;
module.exports.File = File;
