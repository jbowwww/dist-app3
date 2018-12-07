/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const mongoose = require('mongoose');
const hashFile = require('./fs/hash.js');
const fsIterate = require('./fs/iterate.js');
const FileSys = require('./model/filesys');
const { Disk, FsEntry, File, Dir } = FileSys;
const Audio = require('./model/audio.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');

var searches = [
	{ path: '/mnt/Stor', maxDepth: 0 },
	{ path: '/mnt/Storage', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

.then(() => Disk.findOrPopulate().catch(err => console.warn(`Disk.findOrPopulate: ${err.stack||err}`)))

.then(() => FileSys.iterate({ searches }).catch(err => console.warn(`fsIterate: ${err.stack||err}`)))

.then(() => File.find().getArtefacts().promisePipe(
	tap( a => console.verbose(`a=${inspect(a)}`) ),
	iff( a => !a.file.hash || !a.file.isCheckedSince(a.file.stats.mtime),	a => a.file.doHash() 				)	))

.then(() => File.find().getArtefacts().promisePipe(
	iff( a => (/^.*\.(wav|mp3|au|flac)$/i).test(a.file.path) && !a.audio,	a => a.addMetaData('audio', {})		),
	iff( a => a.audio && !a.audio.isCheckedSince(a.file.stats.mtime),		a => a.audio.loadMetadata(a.file) 	)	))

// tap(a => console.verbose(`a=${inspect(a)}`)))
.catch(err => console.warn(`Err: ${err.stack||err}`))

/*.delay(1500)*/.finally(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.finally(() => { console.log(`fsIterate: models[]._stats: ${/*_.values*/inspect(_.mapValues(mongoose.models, (model, modelName) => /*inspect*/(model._stats)), { compact: false })/*.join(",\n")*/}`); })

.done();
