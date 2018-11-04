/* 180926 : dist-app3
 * Another re-write, where artefact types are each in their own table
 * This should hopefully avoid the difficulty and awkardness related to static member functions and data properties on embedded document schemas.
 * Simplicity will be a focus on this version, not just technically but conceptually..
 *	- No overall, all-encompassing, universal container "artefact" type to speak of - not like dist-app2
 *		181028: This is not true now :) 
 *	- Any document model may reference another as required, whether its conceptually inheriting, containing, or referencing the referenced type,
 *	  but does so directly and explicitly in it's own terms
 *	- In such cases I think document IDs and mongoose populate() will be used, although not 100% decided here yet */

"use strict";

const console = require('./stdio.js').Get('index', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const util = require('util');
const _ = require('lodash');
const mongoose = require('./mongoose.js');
const Q = require('q');

const Artefact = require('./model/Artefact.js');
const FsEntry = require('./model/filesys/filesys-entry.js');
const File = require('./model/filesys/file.js');
const Dir = require('./model/filesys/dir.js');
const Audio = require('./model/audio.js');

const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, conditionalPipe, streamPromise }  = require('./promise-pipe.js');
const { Observable, Subject, ReplaySubject, from, of, range, fromEvent, interval, iif, pipe } = require('rxjs');
const { map, tap, filter, switchMap } = require('rxjs/operators');

const fsIterate = (...args) => fromEvent(require('./fs/iterate.js')(...args), 'data');
// const hashFile = require('./fs/hash.js');

function fromPromise(promiseFunction) {
	return function fromPromiseImplementation(source) {
		return Observable.create(subscriber => {
			return source.subscribe(inValue => {
				promiseFunction(inValue)
				.then(outValue => subscriber.next(outValue))
				.catch(err => subscriber.error(err));
			},
			err => subscriber.error(err),
			() => subscriber.complete());
		})
	};
}

function objectFromPromises(promiseObjectFunction = () => ({})) {
	return function objectFromPromisesImplementation(source) {
		return Observable.create(subscriber => {
			return source.subscribe(inValue => {
				var outValue = promiseObjectFunction(inValue);
				Q.all(_.values(_.mapValues(outValue, (field, fieldName) => Q.isPromiseAlike(field) ?
					field.then(newField => Object.defineProperty(outValue, fieldName, { configurable: true, writeable: true, enumerable: true, value: newField }))
				 : 	Q(field))))
				.then(() => subscriber.next(outValue))
				.catch(err => subscriber.error(err));
			},
			err => subscriber.error(err),
			() => subscriber.complete());
		});
	};
}


function conditional(conditionFunction, conditinalAction) {
	return function conditionalImplementation(source) {
		return Observable.create(subscriber => {
			return source.subscribe(inValue => {
				try {
					Q(conditionFunction(value) ? conditionalAction(value) : value)
					.then(value => subscriber.next(value);
				} catch (err) {
					subscriber.error(err);
				}
			},
			err => subscriber.error(err),
			() => subscriber.complete());
		});
	};
}
// var debug = interval(5000).subscribe(() => console.log(`fsIterate: models[]._stats: ${util.inspect(_.mapValues(mongoose.models, model => model._stats), { compact: false })}`));

mongoose.connect("mongodb://localhost:27017/ArtefactsJS2", { useNewUrlParser: true })
.then(() => Q.Promise((resolve, reject) => {
	fsIterate({
		path: '/media/jk/Stor/mystuff/Moozik/samples', maxDepth: 2,
		filter: (dir) => !['/proc', '/sys', '/lib', '/lib64', '/bin', '/boot', '/dev' ].includes(dir.path)
	}).pipe(
		objectFromPromises(fsEntry => new Artefact({ [fsEntry.fileType]: FsEntry.findOrCreate({ path: fsEntry.path }, fsEntry) })),
		conditional(
			a => a.file &&  (!a.file.hash || !a.file.isCheckedSince(a.file.stats.mtime)),
			a => a.file.doHash() ),
		tap(a => console.verbose(`A1: ${inspect(a)} file.isNew=${(a.file||a.dir).isNew}`)),
		// filter(a => a.file &&  (!a.file.hash || !a.file.isCheckedSince(a.file.stats.mtime))),
		// tap(a => console.verbose(`A2: ${inspect(a)} file.isNew=${a.file.isNew}`)),
		// tap(a => a.file.doHash()),
		conditional(
			a => a.file && (/^.*\.(wav|mp3|au|flac)$/i).test(a.file.path)
			),
		objectFromPromises(a => _.assign(a, { audio: Audio.findOrCreate({ _primary: a.file }) })),
		tap(a => console.verbose(`A3: ${inspect(a)} file.isNew=${a.file.isNew} audio.isNew=${a.audio.isNew}`)),
		filter(a => !a.audio.isCheckedSince(a.file.stats.mtime)),
		tap(a => a.audio.loadMetadata(a.file))
	).subscribe(
		a => {
			console.verbose(`Observable fsIterate: a=${inspect(a)}`);
			return a.bulkSave();
		},
		err => reject(err),
		() => resolve()
	);
}))
// .then(() => promisePipe({ concurrency: 8 },
// 	File.getArtefacts({ path: { $regex: /^.*\.(wav|mp3|au|flac)$/i } }, { meta: {
// 	audio: conditionalPipe( 
// 		audio => !audio.isCheckedSince(audio._artefact.file._ts.updatedAt),
// 		audio => {
// 			hashPaths.push(audio._artefact.file.path);
// 			return audio.loadMetadata(audio._artefact.file).finally(() => {
// 				_.remove(hashPaths, path => path === audio._artefact.file.path);
// 			});
// 		}) } } ),
// 	a => a.bulkSave() 				 ) )

.catch(err => { console.error(`error: ${err.stack||err}`); })

.finally(() => mongoose.connection.close()
	.then(() => { console.log(`mongoose.connection closed`); })
	.catch(err => { console.error(`Error closing mongoose.connection: ${err.stack||err}`); }))

.finally(() => {
	console.log(`fsIterate: models[]._stats: ${inspect(_.mapValues(mongoose.models, (model, modelName) => model._stats ))}`);
	// debug./*unsubscribe*/complete();
})

.done();
