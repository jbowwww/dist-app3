/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index3', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
// const fs = promisifyMethods(require('fs'));
// const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');	
mongoose.Promise = Q;
const pEvent = require('p-event');
const pMap = require('p-map');

const app = require('./app.js');
const Task = require('./Task.js');
// const expressApp = require('./express-app.js');

// const FileSys = require('./model/filesys');
const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');
// const Artefact = require('./Artefact.js');

async function* streamify(element, event) {
	let _resolve = null;
	element.on(event, (...args) => _resolve && _resolve(...args));
	while (true) {
		yield new Promise(resolve => _resolve = (...args) => resolve(...args));
	}
};

(async function main() {
	try {
		await app.dbConnect();
		const fileWatch = /*streamify*/(FsEntry.watch([], { fullDocument: 'updateLookup' })/*, 'change'*/);		
		console.log(`fileWatch=${inspect(fileWatch)} funcs=${_.functionsIn(fileWatch).join(', ')}`);
		// for await (let change of fileWatch) {
		await pEvent(fileWatch.on('change', async change => {
			console.log(`change: insert: _id=${inspect(change)}`);
			const f = File.hydrate(change.fullDocument);
			console.verbose(`f = ${inspect(f)}`);
			const a = await f.getArtefact();
			if (a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path)) {
				if (!a.audio) {
					await a.addMetaData('audio', {});
				}
				if (a.audio.isNew || !a.audio.isCheckedSince(a.file._ts.updatedAt)) {
					await a.audio.loadMetadata(a.file);
				}
				console.verbose(`a1 = ${inspect(a)}`);
				await a.bulkSave();
			}
			console.verbose(`a = ${inspect(a)}`);
		})
		.on('error', error => {
			console.error(`EE error: ${err.stack||err}`);
		}), { resolutionEvents: [ 'end' ]});
		console.log(`done watching`);
	} catch (err) {
		console.error(`Other error: ${err.stack||err}`);
	} finally {
		await app.quit();
	}
})();

// .then(() => promisePipe(promisePipeOptions,
// 	File.find({ hash: { $exists: false } }).cursor(),
// 	f => f.getArtefact(),
// 	pipelines.doHash,
// 	pipelines.debug,
	// pipelines.bulkSave))

// .then(async function() {
// 	for await (const f of File.find({ hash: { $exists: false } }).cursor()) {
// 		await pipelines.doAudio(f);
// 		await pipelines.bulkSave(f);
// 	}
// })


// .then(doStats)
// .then(doCloseDb);
