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
		File.watch([])
			.on('change', async change => 
				pipeline( 
					change.fullDocument, 
					f => f.hash(),
					f => f.save(),
					f => { console.log(`fullDoc.hash.save=${inspect(f)}`); }) 
			.on('error', error => {
				console.error(`fsEntry.watch() error: ${err.stack||err}`);
			}) );
		File.find({ hash: { $exists: false } }).cursor()
			.on('data', async data =>
				pipeline( 
					change.fullDocument, 
					f => f.hash(),
					f => f.save(),
					f => { console.log(`fullDoc.hash.save=${inspect(f)}`); }) 
			.on('error', error => {
				console.error(`File.find error: ${err.stack||err}`);
			}) );
	} catch (err) {
		console.error(`Other error: ${err.stack||err}`);
	} finally {
		// await app.quit();
	}
})();
