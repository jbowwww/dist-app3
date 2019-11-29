
"use strict";

const debug = require('@jbowwww/debug')('index')
const inspect = require('./utility.js').makeInspect({ depth: 3, compact: true });
const util = require('util');
const FsIterable = require('@jbowwww/fs-iterable');
const { /*delay, event,*/ map } = require('@jbowwww/promise');
// const Recur = async function(fn, interval = 60000) { while (1) { await fn(); await pDelay(interval); } };
const Limit = require('@jbowwww/limit');
const { combine, emitter } = require('@jbowwww/Source2');
// const streamAsync = require('@jbowwww/stream-async');
const clusterProcesses = require('@jbowwww/cluster-processes');

const app = require('./app.js');
const Disk = require('./model/filesys/disk.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

var searches = [
	{ path: '/etc', maxDepth: 0, progress: true },
	{ path: '/mnt/media', maxDepth: 0, progress: true },
	// { path: '/mnt/mystuff', maxDepth: 0 }
	// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];


(async function main() {
	try {
		await app.dbConnect();
		await clusterProcesses(

			async function populate () {
				await map(searches, async search => {
					// try {
						for await (const f of new FsIterable(search)) {
							try {			// /*Limit({ concurrency: 1 },*/ async function (f) {
								debug(`this=${inspect(this)} f=${inspect(f)}`);
								let a = await (await FsEntry.findOrCreate(f)).getArtefact();
								await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 2000 })); 
							} catch (e) {
								debug(`warn for search: ${inspect(search)}: ${e.stack||e}`);
							}				// });
						}
					// } catch (e) {
					// 	debug(`error for search: ${inspect(search)}: ${e.stack||e}`);
					// }			
				});
				app.logStats();
			},

			async function hash () {
				// try {
					for await (const f of combine(
						File.find({ hash: { $exists: false } }).cursor(),
						emitter(File.watch([], { fullDocument: 'updateLookup' }), { event: 'change' },
						change => { 
							debug(`change=${inspect(change)}`);
							return FsEntry.hydrate(change.fullDocument);
						}) )) {
						try {
							debug(`this=${inspect(this)} f=${inspect(f)}`); 
							if (f.fileType === 'file') {
								await f.doHash();
							}
							await f.save();
							debug(`fullDoc.hash.save=${inspect(f)}`);
						} catch (e) {
							debug(`warn for hash: f=${inspect(f)}: ${e.stack||e}`);
						} 
					}
				// } catch (e) {
				// 	debug(`error for hash: ${e.stack||e}`);
				// }
				app.logStats();			
			},

			async function populateAudio() {
				// try {
					for await (const f of combine(
						File.find({ hash: { $exists: false } }).cursor(),					
						emitter(
							File.watch([], { fullDocument: 'updateLookup' }),
							{ event: 'change' },
							change => { 
								debug(`File.watch this=${inspect(this)} change=${inspect(change)}`);
								return FsEntry.hydrate(change.fullDocument);
							}))) {			///*Limit*/(/*{ concurrency: 1 },*/ async function (f) {
						try {
							let a = await (await FsEntry.findOrCreate(f)).getArtefact();
							if (a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path)) {
								debug(`populateAudio: a=${inspect(a)}`); 
								if (!a.audio) {
									await a.addMetaData('audio', {});
								}
								if (a.audio.isNew || !a.audio.isCheckedSince(a.file._ts.updatedAt)) {
									await a.audio.loadMetadata(a.file);	
								}
								if (a.audio && (a.audio.isNew || a.audio.isModified)) {
									debug(`populateAudio: a2=${inspect(a)}`);
								}
								await a.save();	//bulkSave
							}
						} catch (e) {
							debug(`warn for audio: f=${inspect(f)} ${e.stack||e}`);	
						}
					}
				// } catch (e) {
				// 	debug(`error for audio: ${e.stack||e}`);
				// }
				app.logStats();
			}

		);
	
	} catch (err) {
		debug(`Overall cluster error: ${err.stack||err}`);
	}
}) ();

