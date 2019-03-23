/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas. 
 */

"use strict";
const console = require('./stdio.js').Get('index3', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const _ = require('lodash');
const Q = require('q');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');	
mongoose.Promise = Q;
const pEvent = require('p-event');
const pMap = require('p-map');

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');// } = FileSys;
	const Audio = require('./model/audio.js');
	// const Artefact = require('./Artefact.js');

const app = require('./app.js');
var promisePipeOptions = { catchErrors: app.onError };
/* var pipelines = require('./pipelines.js');
 * var pipelines = {
 * 	debug: tap(a => { console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a)}\n\n!!\n`); }),
 * 	bulkSave: a => a.bulkSave(),
 * 	doHash: iff( a => a.file && (!a.file.hash || !a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ),
 * 	doAudio: iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
 * 		iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
 * 		iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
 * };
 */
/* New idea - use Artefact to define promise pipes, something like:
 * Artefact.pipeFrom(fsIterate(search), )
 * or maybe
 *
 * fsIterate.pipe(FsEntry.artefactPipe({
 *	 [pipeline ops...]
 * ))
 *
 * ..yeah fuck i dunno haha
 * but see if you can clean up this syntax a bit by putting it into Artefact
 * and combine that with (optionally?) specifying extra types to include in the artefact
 * (artefact still needs an initial mongo doc (newly created or retrieved) to go and find other types associated with the artefact)
 * (how to map dependencies/ordering of type construction in artefacts? e.g. file -> audio -> sample)
 */

//	pipeline(sourceStream, writeable)
		// { $match: { operation: "insert", hash: null  } }
 let streamify = async function* ( element, event )
  {
    let _resolve = null;
    let handler = ( ...args ) => { if ( _resolve ) _resolve( ...args ); }

    element.on( event, handler );
    
    while( true )
    {
      yield new Promise( resolve =>
      {
        _resolve = ( ...args )=>{ resolve( ...args ); }
      });
    }
  };

(async function main() {
	try {
		await app.dbConnect();
		const fileWatch = streamify(File.watch([]), 'change');
		
		console.log(`fileWatch=${inspect(fileWatch)} funcs=${_.functionsIn(fileWatch).join(', ')}`);

		// this don't work etiher, just for a change the mongoose and mongo docs are wrong or it must be a version thing?? but who knows, its all clear as mud
		// while (!fileWatch.isExhausted()) {
		// 	if (fileWatch.hasNext()) {
		// 		let change = fileWatch.next();
		// 		console.log(`change: insert: _id=${inspect(change)}`);
		// 	}
		// }

		// doesn't work ; not async iterable
		for await (let change of fileWatch) {
			console.log(`change: insert: _id=${inspect(change)}`);
		}

		// yield pEvent(, 'change');
		// 	.on('change', change => {
		// 		console.log(`change: insert: _id=${inspect(change)}`);	//.documentKey
		// 	})
		// 	.on('error', err => {
		// 		console.error(`Other error: ${err.stack||err}`);
		// 	}),
		// 	{ resolveEvent: 'end' });
		console.log(`done watching`);
	} catch (err) {
		console.error(`Other error: ${err.stack||err}`);
	}
	await app.quit();
})();

// (function looper() { return Q.delay(1000).then(looper); })();



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
