/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas.
 * Simplicity will be a focus on this version, not just technically but conceptually..
 *	- No overall, all-encompassing, universal container "artefact" type to speak of - not like dist-app2
 *		181028: This is not true now :) 
 *	- Any document model may reference another as required, whether its conceptually inheriting, containing, or referencing the referenced type,
 *	  but does so directly and explicitly in it's own terms
 *	- In such cases I think document IDs and mongoose populate() will be used, although not 100% decided here yet */

"use strict";

const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const util = require('util');
const _ = require('lodash');
const mongoose = require('./mongoose.js');
const Q = require('q');

const hashFile = require('./fs/hash.js');

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
	{ path: '/home/jk', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) },
	{ path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

// .then(() => Disk.findOrPopulate())												//Process filesystem(s)
.then(() => Q.all(_.map(searches, search =>	FileSys.iterate(search).promisePipe(
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
