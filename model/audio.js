"use strict";
var console = require('../stdio.js').Get('modules/audio', { minLevel: 'debug' });	// debug verbose
const inspect =	require('../utility.js').makeInspect({ depth: 1, compact: true });
const inspectPretty = require('../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const baseFs = require('../fs.js');
const _ = require('lodash');
const Q = require('q');
const mongoose = require('../mongoose.js');
// const moment = require('moment');
const mm = require('music-metadata');
// const app = require('../app.js');

var audioSchema = new mongoose.Schema({

    fileId: { type: mongoose.SchemaTypes.ObjectId, required: true, unique: true },
    length: { type: Number, required: true, default: 0 },
    metadata: {}
}, { /*_id: false*/ });

audioSchema.virtual('file').set(function(file) {
    this._file = file;
    this.fileId = file._id;
})

audioSchema.plugin(require('./plugin/timestamp.js'));
audioSchema.plugin(require('./plugin/standard.js'));
audioSchema.plugin(require('./plugin/bulk-save.js'));
audioSchema.plugin(require('./plugin/stat.js'), { data: { save: {}, validate: {} } });

audioSchema.method('loadMetadata', function loadMetadata() {
    var audio = this;
    var artefact = this.$parent;
    var model = this.$parent.constructor;
    console.verbose(`audio=${inspectPretty(audio)} artefact=${inspectPretty(artefact)}`);
    return mm.parseFile(artefact.fs.path).then(metadata => {
        console.verbose(`metadata=${inspectPretty(metadata)}`);
        audio.metadata = metadata;
        return artefact;
    }).catch(err => {
        console.warn(`mm.parseFile error: ${}`)
        model._stats.errors.push(err);
    });
});

module.exports = mongoose.model('Audio', audioSchema);
