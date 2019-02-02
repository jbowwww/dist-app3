"use strict";
const console = require('../../stdio.js').Get('model/fs/filesys', { minLevel: 'log' });	// log verbose debug
const inspect = require('../../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const { pipeline } = require('stream');
const pPipe = require('p-pipe');
const _ = require('lodash');
// const Q = require('q');
const { /*createFsItem,*/ iterate } = require('../../fs/iterate.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, ifPipe, conditionalTap, streamPromise }  = require('../../promise-pipe.js');
const { pipeline } = require('stream');

const mongoose = require('mongoose');

var Disk = require('./disk.js');
var Partition = require('./partition.js');
var FsEntry = require('./filesys-entry.js');
var Dir = require('./dir.js');
var File = require('./file.js');


module.exports = {
		Disk,
		Partition,
		FsEntry,
		Dir,
		File,

	enumerate(options) {
		// options = _.merge({
		// 	handleError(err) {
				
		// 	}
		// })
		return promisePipe( iterate(options), /*.pipe(*/
			// writeablePromiseStream(/*{ dataThru: true },*/
			 fsEntry => /*this.*/FsEntry.findOrCreate(fsEntry))
			  // );
	}

};

// const Artefact = require('../../Artefact.js');

// const debug = function(msg = 'promiseFunc: val=') { return (val => { console.debug(`${msg}${val}`); return val; }); };

// module.exports.iterate = function fsIterate(options, ...promisePipeFuncs) {
// 	options = _.defaults(options, { searches: [], saveImmediate: false, concurrency: 8 });
// 	console.verbose(`fsIterate(options=${inspect(options, {depth: 3, compact:true})}), promisePipeFuncs=[\n\t${promisePipeFuncs.map(ppf => ppf.toString()).join('\n\t')} ]`);
// 	return Q.all(_.map(options.searches, search => createFsItem(search.path).then(debug())
// 		.then(searchRootDir => FsEntry.findOrCreate({ path: searchRootDir.path }, searchRootDir)).then(debug())
// 		.then(searchRootDirDoc => searchRootDirDoc.save()).then(debug())
// 		// .then(searchRootDirDoc => Artefact(searchRootDirDoc))
// 		// .tap(a => console.verbose(`a=${inspect(a)}`))
// 		.then(searchRootDirDoc => promisePipe(iterate(search), { concurrency: options.concurency },
// 			fs => FsEntry.findOrCreate({ path: fs.path }, fs, { saveImmediate: fs.fileType === 'dir' || options.saveImmediate }),
// 			fs => Artefact(fs),
// 			// a => a.dir || options.saveImmediate ? a/*.save()*/ : a.bulkSave(),			// saves at least directories immediately, because files may reference them 
// 			...promisePipeFuncs))
// 		.then(debug('fsIterate(${inspect(search, {compact:true})}) return: '))))
// 	.then(`Finished ${options.searches.length} searches`);
// };
