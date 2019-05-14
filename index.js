
"use strict";
const console = require('./stdio.js').Get('index', { minLevel: 'log' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: true });
const util = require('util');
const _ = require('lodash');
const Q = require('q');
const pMap = require('p-map');
const pAll = require('p-all');
const hashFile = require('./fs/hash.js');
const fs = require('fs');
const fsIterate = require('./fs/iterate.js').iterate;
const mongoose = require('mongoose');
mongoose.Promise = Q;

const app = require('./app.js');
// const Task = require('./Task.js');
const expressApp = require('./express-app.js');

	// const FileSys = require('./model/filesys');
	const Disk = require('./model/filesys/disk.js');
	const FsEntry = require('./model/filesys/filesys-entry.js');
	const File = require('./model/filesys/file.js');
	const Dir = require('./model/filesys/dir.js');
	const Audio = require('./model/audio.js');

var searches = [
	// { path: '/mnt/media', maxDepth: 0 },
	{ path: '/etc', maxDepth: 0 },

	// { path: '/mnt/mystuff', maxDepth: 0 }
		// { path: '/mnt/Stor2/mystuff', maxDepth: 0 }
	// { path: '/', maxDepth: 0, filter: dirEntry => (!['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dirEntry.path)) }
];


/*
var tasks = {

	populateDisks: new Task(async function populateDisks() {
		await Disk.findOrPopulate();
	}),

	searchFilesystem: new Taskasync function (search) {
		for await (let f of fsIterate(search)) {
			f = await FsEntry.findOrCreate(f);
			console.debug(`f.path: '${f.path}'`);
			await (f.fileType === 'dir' ? f.save() : f.bulkSave());
		}
	}),
	searchFilesystems: new Task(`Searching filesystems`, async function (searches) {		// : ${inspect(searches, { compact: false })}
		await pMap(searches, async search => await tasks.searchFilesystem(search));
	})

};

console.verbose(`tasks: ${inspect(tasks)}`);
*/

function getAllSubdocs(topDoc) {
	const Document = mongoose.Document;
  let DocumentArray =  mongoose.Types.DocumentArray; //require('mongoose/types/documentarray');// mongoose.Schema.Types.DocumentArray;// || (DocumentArray = require('mongoose/types/documentarray'));
  let Embedded = mongoose.Types.Embedded; //require('mongoose/types/embedded');// mongoose.Schema.Types.Embedded; //Embedded || require('mongoose/types/embedded');

  function docReducer(doc, seed, path) {
    const val = path ? doc[path] : doc;
    if (val instanceof Embedded) {
      seed.push(val);
    }
    else if (val instanceof Map) {
      seed = Array.from(val.keys()).reduce(function(seed, path) {
        return docReducer(val.get(path), seed, null);
      }, seed);
    }
    else if (val && val.$isSingleNested) {
      seed = Object.keys(val._doc).reduce(function(seed, path) {
        return docReducer(val._doc, seed, path);
      }, seed);
      seed.push(val);
    }
    else if (val && val.isMongooseDocumentArray) {
      val.forEach(function _docReduce(doc) {
        if (!doc || !doc._doc) {
          return;
        }
        if (doc instanceof Embedded) {
          seed.push(doc);
        }
        seed = Object.keys(doc._doc).reduce(function(seed, path) {
          return docReducer(doc._doc, seed, path);
        }, seed);
      });
    } else if (val instanceof Document && val.$__isNested) {
      if (val) {
        seed = Object.keys(val).reduce(function(seed, path) {
          return docReducer(val, seed, path);
        }, seed);
      }
    }
    return seed;
  }

  // const _this = this;
  const subDocs = Object.keys(topDoc._doc).reduce(function(seed, path) {
    return docReducer(topDoc, seed, path);
  }, []);

  return subDocs;
};


// TODO: Run with --inspect, try to evaluate various internal variables

(async function main() {
	
	try {
	
		await app.dbConnect();
		// console.verbose(`Disk.findOrPopulate.name=${Disk.findOrPopulate.name} Disk.findOrPopulate.length=${Disk.findOrPopulate.length}`);

		await Disk.findOrPopulate();

		// debugger;
		await pMap(searches, async search => {	// do i need this to be async when i return an await'ed value ? can i just directly return the promise?
			// await new Task(async function fsSearch(task) {
				// for await (let f of /*task.trackProgress*/Task.parallel({ concurrency: 2 }, (fsIterate(search)))) {
				for await (let f of /*task.trackProgress*/(fsIterate(search))) {
					// await new Task(async function fSEntry(/*f*/) {
						(await FsEntry.findOrCreate(f)).getArtefact(async a => {
							// console.log(`a.fs.path: '${a.fs.path}' a=${inspect(a)}`);//, f.subdocs['${typeof f}' ${f.constructor.name} ${f.constructor.modelName}]=${inspect(getAllSubdocs(f))}`);
							await (!!a.dir ? a.save() : a.bulkSave({ maxBatchSize: 20, batchTimeout: 1250 }));
						});
					// }).run();
					// console.verbose(`task=${inspect(task)}`);
				}
			});//.run());

		// await new Task(async function hashFiles(task) {
		// 	async function showHashTotals() {
		// 		var hashedFileCount = await File.find({ hash: { $exists: true } }).countDocuments();
		// 		var unhashedFileCount = await File.find({ hash: { $exists: false } }).countDocuments();
		// 		var totalFileCount = hashedFileCount + unhashedFileCount;
		// 		console.log(`Counted ${totalFileCount} files... ${hashedFileCount} hashed and ${unhashedFileCount} not`);
		// 	};
		// 	await showHashTotals();
		// 	var hashCount = 0;
		// 	for await (let f of /*task.queryProgress*/(File.find({ hash: { $exists: false } })).cursor()) {	//q.cursor())
		// 		hashCount++;
		// 		try {
		// 			await f.doHash();
		// 			await f.bulkSave();
		// 		} catch (e) {
		// 			console.warn(`error hashing for f.path='${f.path}': ${e.stack||e}`);
		// 		} finally {
		// 			// console.verbose(`task=${inspect(task)}`);
		// 		}
		// 	}
		// 	console.log(`Done Hashing ${hashCount} files...`);
		// 	await showHashTotals();
		// }).run();

		// await new Task(async function doAudio(task) {
		// 	for await (const f of /*task.queryProgress*/(File.find({ hash: { $exists: false } })).batchSize(5).cursor()) {
		// 		const a = await f.getArtefact();
		// 		if (a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path)) {
		// 			if (!a.audio) {
		// 				await a.addMetaData('audio', {});
		// 			}
		// 			if (!a.audio.isCheckedSince(a.file._ts.updatedAt)) {
		// 				await a.audio.loadMetadata(a.file);
		// 			}
		// 		}
		// 		await a.bulkSave();
		// 	}
		// }).run();

		// iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
		// 	iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
		// 	iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
	
	} catch (err) {

		console.error(`main() error: ${err.stack||err}`);

	} finally {

		await app.quit();

	}
})();

// .then(() => {
// 	return Q(FsEntry.find({})/*.exec()*//*.cursor()*/).then(entries => {
// 		console.log(`entries: ${inspect(entries)}`);
// 	})
// })

// .then(() => { console.verbose(
// 	`mongoose.models count=${_.keys(mongoose.models).length} names=${mongoose.modelNames().join(', ')}\n` + 
// 	`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => (model._stats)))}\n` +
// 	(errors.length > 0 ? `global errors (${errors.length}): ${inspect(errors)}\n` : '') ); })

// .then(() => mongoose.connecxtion.close()
// 	.then(() => { console.log(`mongoose.connection closed`); })
// 	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

// .catch(err => console.error(`Other error: ${err.stack||inspect(err)}`))
// .then(() => app.quit())
// .done();
