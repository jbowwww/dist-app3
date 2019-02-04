
const { promisePipe, artefactDataPipe, writeablePromiseStream, chainPromiseFuncs, nestPromiseFuncs, tap, iff, streamPromise }  = require('./promise-pipe.js');
const app = require('./app.js');

module.exports = {
	_options: { catchErrors: null },//	 app.handleError },
	debug: tap(a => {/* a = a.file; if (!a)*/ return; console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a/*.toObject({ getters: true })*/)}\n\n!!\n`); }),
	bulkSave: a => a.bulkSave(),
	doHash: iff( a => a.file && (!a.file.hash || a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ),
	doAudio: iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
		iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
		iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
};
