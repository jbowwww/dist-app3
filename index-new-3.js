
"use strict";
const debug = require('debug')('index')
// const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, compact: true });
const util = require('util');
const obj = require('@jbowwww/object-util');
const FsIterable = require('@jbowwww/fs-iterable');
const pMap = require('p-map');
const pDelay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));
const pEvent = (em, ev) => new Promise((resolve, reject) => em.once(ev, resolve).on('error', reject));/*require('p-event');*/

// const Recur = async function(fn, interval = 60000) { while (1) { await fn(); await pDelay(interval); } };
const Limit = require('@jbowwww/limit');
const source = require('@jbowwww/source');
const streamAsync = require('@jbowwww/stream-async');
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
		// TODO: Give names to each process somehow for identificatoin. Use object instead of array?
		await clusterProcesses(

			async function populate () {
				await pMap(searches, async search => {
					try {
						for await (const { f, fsIterable } of 
							new FsIterable(search)) { 		/*Progress(new FsIter...)*/
								Limit({ concurrency: 1 }, async function f() {
									try {
										console.verbose(`this=${inspect(this)} f=${inspect(f)}`);
												let a = await (await FsEntry.findOrCreate(f)).getArtefact();
												!!a.file && //await a.file.doHash();
												await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 2000 })); 
												// TODO: Make an option on Artefact/model that enables calls to .save() to pass to bulkSave(), which woudl eliminate the need for this step here
											} catch (e) {
												console.warn(`warn for search: ${inspect(search)}: ${e.stack||e}`);
											}
										});
									} catch (e) {
										console.error(`error for search: ${inspect(search)}: ${e.stack||e}`);
									}
								}
							})
						)
					} catch (e) {

					}	
				});
			},

			async function hash () {
				await streamAsync(
					File.find({ hash: { $exists: false } }).cursor(),
					source(
						File.watch([], { fullDocument: 'updateLookup' }), { event: 'change' }
						async change => { 
							console.log(`change=${inspect(change)}`);
							return await FsEntry.hydrate(change.fullDocument);
						}),
					async f => {
						console.log(`f=${inspect(f)}`); 
						await f.doHash();
						await f.save();
						console.log(`fullDoc.hash.save=${inspect(f)}`); 
					});
			},

			// async function hashExistingFiles() {
			// 	await streamAsync(source(File.find({ hash: { $exists: false } }).cursor()),
			// 		async f => {
			// 			await f.doHash();
			// 			await f.save();
			// 			console.log(`fullDoc.hash.save=${inspect(f)}`);
			// 		});
			// },

			async function populateAudio() {
				await streamAsync(
					source(File.watch([], { fullDocument: 'updateLookup' }), { event: 'change' }), 
					async change => {
						const f = await FsEntry.hydrate(change.fullDocument);
						let a = await (await FsEntry.findOrCreate(f)).getArtefact();
						if (a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path)) {
							console.log(`populateAudio: a=${inspect(a)}`); 
							if (!a.audio) {
								await a.addMetaData('audio', {});
							}
							if (a.audio.isNew || !a.audio.isCheckedSince(a.file._ts.updatedAt)) {
								await a.audio.loadMetadata(a.file);	
							}
							if (a.audio && a.audio.isNew || a.audio.isModifed) {
								console.log(`populateAudio: a2=${inspect(a)}`);
							}
							await a.save();	//bulkSave
						}
					});
			}

		);
	
	} catch (err) {
		console.error(`Overall cluster error: ${err.stack||err}`);
	}
}) ();

