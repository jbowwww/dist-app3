/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const mongoose = require('./mongoose.js');
const Q = require('q');

const hashFile = require('./fs/hash.js');
const fsIterate = require('./fs/iterate.js');

const FileSys = require('./model/filesys');
const { Disk, FsEntry, File, Dir } = FileSys;
// const FsEntry = require('./model/filesys/filesys-entry.js');
// const File = require('./model/filesys/file.js');
// const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');
const Artefact = require('./Artefact.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, ifPipe, conditionalTap, streamPromise }  = require('./promise-pipe.js');

// a thenable function for tapping the promise value tpo call a function, but returning the original value   
var tap = function(fn) { return (v => { fn(v); return v; }); };

var searches = [
	{ path: '/home/jk', maxDepth: 2 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

.then(() => Disk.findOrPopulate())												//Process filesystem(s)
.then(() => Q.all(_.map(searches, search =>
	// FileSys.iterate(search).promisePipe(
promisePipe(
		{ concurrency: 1 },
		fsIterate(search),			// Iterate the filesystem , populating the disk field on fsEntry dsocuments
		// fs => fs.dir ?  Dir.findOrCreate({ path: fs.dir.path }).then(dir => _.set(fs, 'dir', dir)) : fs,
		// fs => fs.disk ? Disk.findOrCreate({ path: fs.disk.path }).then(disk => _.set(fs, 'disk', disk)) : fs,
		fs => FsEntry.findOrCreate({ path: fs.path }, fs),
		fs => Artefact(fs),
		tap(a => console.verbose(`a: ${inspect(a)}`)),
		ifPipe(a => a.file,
			ifPipe(a => !a.file.isCheckedSince(a.file.stats.mtime), a => a.file.doHash()),
			ifPipe(a => (/^.*\.(wav|mp3|au|flac)$/i).test(a.file.path) && !a.audio, a => a.addMetaData('audio', {})),
			ifPipe( a => a.audio && !a.audio.isCheckedSince(a.file.stats.mtime), a => a.audio.loadMetadata(a.file))),
		a => a.bulkSave() )
		.catch(err => { console.warn(`fsIterate: ${err.stack||err}`); }) )))

.catch(err => { console.error(`error: ${err.stack||err}`); })
.delay(1500).finally(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.finally(() => { console.log(`fsIterate: models[]._stats: ${/*_.values*/inspect(_.mapValues(mongoose.models, (model, modelName) => /*inspect*/(model._stats)), { compact: false })/*.join(",\n")*/}`); })

.done();
