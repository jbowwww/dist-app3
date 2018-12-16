/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const mongoose = require('mongoose');
const hashFile = require('./fs/hash.js');
const fsIterate = require('./fs/iterate.js').iterate;
const fs = require('fs');
const FileSys = require('./model/filesys');
const { Disk, FsEntry, File, Dir } = FileSys;
const Audio = require('./model/audio.js');
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');

var errors = [];
process.on('uncaughtException', (err) => {
  fs.writeSync(1, `process.on('uncaughtException'): ${err.stack||err}\n`);
  errors.push(err);
});
process.on('beforeExit', () => {
	if (errors && errors.length > 0) {
		fs.writeSync(fs.createWriteStream('errors.txt', errors.join('\n')));
	}
});

var searches = [
	{ path: '/mnt/Stor', maxDepth: 0 },
	{ path: '/mnt/Storage', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];

var pipelines = {
	debug: tap( a => {
		var _a = (a.file||a.dir);
		console.verbose(`bs_a=${_a.path} isNew=${_a.isNew} isModified=${_a.isModified()} modPaths=${_a.modifiedPaths()}`);
	} ),
	bulkSave: chainPromiseFuncs(
		a => a.bulkSave() ),
	doHash: chainPromiseFuncs(
		iff( a => a.file && (!a.file.hash || !a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ) ),
		///*tap( a => console.verbose(`a1=${inspect(a)}`) )*/ ),
	doAudio: chainPromiseFuncs(
		iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
			iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
			iff( a => !a.audio.isCheckedSince(a.file._ts.updated), a => a.audio.loadMetadata(a.file) ) ) )
		///*tap( a => console.verbose(`a2=${inspect(a)}`) )*/ )	
}
// File.on('post.bulkSave', onFileSave);
// File.on('post.save', onFileSave);

// function onFileSave(doc, next) {
// 	console.log(`onFileSave`);
// 	var model = doc.constructor;
// 	var debugPrefix = `[model ${model.modelName}]`;//`[${typeof model} ${model.modelName}]`;
// 	console.verbose(`${debugPrefix}.post('/(bulkS|s)?ave/'): doc=${inspect(doc)}`);
// 	!doc.hash || doc.hashUpdated < doc._ts.checkedAt ? doc.doHash()
//  : 	iff( a => (/^.*\.(wav|mp3|au|flac)$/i).test(a.file.path) && !a.audio
// 		// .catch(e => { console.warn(`${debugPrefix}.pre('validate'): error: ${err.stack||err}`); model._stats.errors.push(e); })
// 	} else if { 
// 		console.verbose(`${debugPrefix}.pre('validate'): doc.hash already current (=...${doc.hash.substr(-6)})`);
// 		return Q(doc);
// 	}
// };

mongoose.connect("mongodb://localhost:27017/ArtefactsJS", { useNewUrlParser: true })

.then(() => Disk.findOrPopulate()/*.catch(err => console.warn(`Disk.findOrPopulate: ${err.stack||err}`))*/)

.then(() => FileSys.iterate({ searches },
	pipelines.doHash,// pipelines.debug,
	pipelines.doAudio,//, //pipelines.debug,
	// a => a.save(),
	pipelines.debug,
	pipelines.bulkSave))//)/*pipelines.bulkSave*//*, pipelines.debug*/))//*.catch(err => console.warn(`fsIterate: ${err.stack||err}`))*/)
// .then(() => Q.all(_.map(searches, search => promisePipe({ concurrency: 1 },
// 	fsIterate(search),
// 	tap( a => console.verbose(`a=${inspect(a)}`) )
// 	))))
// Artefact.find({
// 	file: { hash: { $exists: false } },

// })
// .then(() => File.find().getArtefacts().promisePipe(
	// tap( a => console.verbose(`a=${inspect(a)}`) ),
	// iff( a => !a.file.hash || !a.file.isCheckedSince(a.file.stats.mtime),	a => a.file.doHash() 				)	))

// .then(() => File.find().getArtefacts().promisePipe(
// 	iff( a => (/^.*\.(wav|mp3|au|flac)$/i).test(a.file.path) && !a.audio,	a => a.addMetaData('audio', {})		),
// 	iff( a => a.audio && !a.audio.isCheckedSince(a.file.stats.mtime),		a => a.audio.loadMetadata(a.file) 	)	))

// .tap(a => console.verbose(`a=${inspect(a)}`))
.catch(err => console.warn(`Err: ${err.stack||err}`))

/*.delay(1500)*/.then(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.then(() => { console.log(`fsIterate: models[]._stats: ${/*_.values*/inspect(_.mapValues(mongoose.models, (model, modelName) => /*inspect*/(model._stats)), { compact: false })/*.join(",\n")*/}`); })

.done();
