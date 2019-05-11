/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index5', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
const mongoose = require('mongoose');	
mongoose.Promise = Q;
const pEvent = require('p-event');
// const pMap = require('p-map');

const app = require('./app.js');
// const Task = require('./Task.js');
// const expressApp = require('./express-app.js');

// const FileSys = require('./model/filesys');
const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');
// const Artefact = require('./Artefact.js');

(async function main() {
	try {
		
		await app.dbConnect();
		
		const fileWatch = (FsEntry.watch([], { /*fullDocument: 'updateLookup'*/ }/*, 'change'*/));		
		console.debug(`fileWatch=${inspect(fileWatch)} funcs=${_.functionsIn(fileWatch).join(', ')}`);

		for await (const f of File.find({ hash: { $exists: false } }, null, { batchSize: 2 }).cursor()) {
			await processFile(f)
		}
		// TODO: It seems this is creating 2x audios for each fs(file) object. I think because watch() sees 2 events per file,
		// an insert and an update, in quick succession, so it gets both before either has finished processing the below logic,
		// hence creating 2 distinct audio objects and saving them both. Add some sort of queue, or keep track of currently processing
		// files, or something, or just process insert OR update (although that is not the right long-term soilution, since you
		// really do want to process both)
		await pEvent(
			fileWatch
			.on('change', async change => await processFile(await File.findById(change.documentKey._id))) 
			.on('error', error => {	console.error(`EE error: ${err.stack||err}`); }),
			{ resolutionEvents: [ 'end' ] }
		);

		console.log(`done watching`);

		async function processFile(f) {
			console.debug(`f = ${inspect(f)}`);
			if (f) {
				// try {
					await f.getArtefact(async a => {	// const a = await f.getArtefact();
						if (a.file) {
							await a.file.doHash();
							await a.bulkSave();
						}
					});
				// } catch (e) {
				// 	console.warn(`error on file '${f.path||'(undef)'}': ${e.stack||e}`);
				// }
			}
		}

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
