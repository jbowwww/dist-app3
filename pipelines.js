
"use strict";
const app = require('./app.js');
const console = require('./stdio.js').Get('pipelines', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const { tap, iff } = require('./promise-pipe.js');


// TODO: separate the model-specific functions (doHash, doAudio) and relocate them to their relevant models
// refactor so that they operate on and take as a single parameter, the relevant typeof document, rather than
// an artefact containing it. (i.e. instead of a => a.file.hash it will be f => f.hash)
// artefacts can be factored in at a higher level (perhaps composing these functions, somehow..)
module.exports = {
	
	debug: tap(a => {/* a = a.file; if (!a)*/ return; console.verbose(`\n!!\n\na.isNew=${a.isNew} a.isModified=${a.isModified} a.modifiedPaths=${a.modifiedPaths}\na = ${inspect(a/*.toObject({ getters: true })*/)}\n\n!!\n`); }),
	
	bulkSave: a => a.bulkSave(),
	
	doHash: iff( a => a.file && (!a.file.hash || a.file.hashUpdated < a.file._ts.updated),	a => a.file.doHash() ),
	doAudio: iff( a => a.file && (/^.*\.(wav|mp3|mp4|au|flac)$/i).test(a.file.path),
		iff( a => !a.audio,	a => a.addMetaData('audio', {}) ),
		iff( a => !a.audio.isCheckedSince(a.file._ts.updatedAt), a => a.audio.loadMetadata(a.file) ) )
};
