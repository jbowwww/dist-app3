/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index5', { minLevel: 'debug' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
const mongoose = require('mongoose');	
mongoose.Promise = Q;
const pEvent = require('p-event');
const pMap = require('p-map');
const { DataStream } = require('scramjet');

const app = require('./app.js');
// const Task = require('./Task.js');
// const expressApp = require('./express-app.js');

class EventTranslate extends require('stream').Readable {
	constructor(source, event) {
		super({ objectMode: true });
		source.on(event, data => { this.push(data); });
	}
	_read() {}
	_destroy() {
		source.off(event);
	}
}

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
		// console.debug(`fileWatch=${inspect(fileWatch)} funcs=${_.functionsIn(fileWatch).join(', ')}`);

		// for await (const f of 
		const fileFind = File.find({ hash: { $exists: false } }, null, { batchSize: 2 }).cursor();//.eachAsync(processFile);

		// await /*pMap*/([/*fileWatch*/ fileFind].map((source, sourceIndex) => {
		// 	console.debug(`source[${sourceIndex}]=${inspect(source)} funcs=${_.functionsIn(source).join(', ')}`);
			await Promise.all([
				DataStream.from(fileFind)
					.map(processFile)
					.run(),
				DataStream.from(new EventTranslate(fileWatch, 'change'))
					.map(async change => await File.findById(change.documentKey._id))
					.map(processFile)
					.run()
				]);
		// }));

		//  {
		// 	await processFile(f)
		// }
		// TODO: It seems this is creating 2x audios for each fs(file) object. I think because watch() sees 2 events per file,
		// an insert and an update, in quick succession, so it gets both before either has finished processing the below logic,
		// hence creating 2 distinct audio objects and saving them both. Add some sort of queue, or keep track of currently processing
		// files, or something, or just process insert OR update (although that is not the right long-term soilution, since you
		// really do want to process both)
		// await pEvent(
		// 	fileWatch
		// 	.on('change', async change => await processFile(await File.findById(change.documentKey._id))) 
		// 	.on('error', error => {	console.error(`EE error: ${err.stack||err}`); }),
		// 	{ resolutionEvents: [ 'end' ] }
		// );

		console.log(`done watching`);

		async function processFile(/*err,*/f) {
			// if (err) {
			// 	console.warn(`error on file '${f.path||'(undef)'}': ${e.stack||e}`);
			// 	return;
			// }
			console.debug(`f = ${inspect(f)}`);
			if (f) {
				try {
					await f.getArtefact(async a => {	// const a = await f.getArtefact();
						console.debug(`a = ${inspect(a)}`);
						if (a.file) {
							await a.file.doHash();
						console.debug(`a2 = ${inspect(a)}`);
							await a.save();
						}
					});
				} catch (e) {
					console.warn(`error on file '${f.path||'(undef)'}': ${e.stack||e}`);
				}
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
