"use strict";
var console = require('../stdio.js').Get('modules/audio', { minLevel: 'log' });	// debug verbose
const inspect =	require('../utility.js').makeInspect({ depth: 1, compact: true });
const inspectPretty = require('../utility.js').makeInspect({ depth: 1, compact: false /* true */ });
// const baseFs = require('../fs.js');
const _ = require('lodash');
const Q = require('q');
const mongoose = require('../mongoose.js');
// const moment = require('moment');
const mm = require('music-metadata');
// const app = require('../app.js');

var formatSchema = new mongoose.Schema({
    tagTypes: [String],
    dataformat: String,
    bitsPerSample: Number,
    sampleRate: Number,
    numberOfChannels: Number,
    bitrate: Number,
    lossless: Boolean,
    numberOfSamples: Number,
    duration: Number
});

var commonSchema = new mongoose.Schema({
    track: {
        no: Number,
        of: Number
    },
    disk: {
        no: Number,
        of: Number
    },
    year: String,
    date: String,
    engineer: [String],
    encodedBy: String,
    encodersettings: String,
    title: String,
    artist: String,
    artists: [String],
    genre: [String],
    bpm: String
});

var nativeSchema = new mongoose.Schema({

});

var audioSchema = new mongoose.Schema({
    format: formatSchema,
    common: commonSchema,
    native: nativeSchema
});

// audioSchema.virtual('file').set(function(file) {
//     this._file = file;
//     this.fileId = file._id;
// })

audioSchema.plugin(require('./plugin/timestamp.js'));
audioSchema.plugin(require('./plugin/standard.js'));
audioSchema.plugin(require('./plugin/bulk-save.js'));
audioSchema.plugin(require('./plugin/stat.js'), { data: { loadMetadata: {} } });

audioSchema.method('loadMetadata', function loadMetadata(file) {
    var audio = this;
    var model = this.constructor;
    console.debug(`audio=${inspectPretty(audio)} file=${inspectPretty(file)}`);
    return mm.parseFile(file.path).then(metadata => {
        if (!audio.format && !audio.common && !audio.native) { model._stats.loadMetadata.created++; }
        else { model._stats.loadMetadata.updated++; }
        console.debug(`metadata=${inspectPretty(metadata)}`);
        audio.updateDocument(metadata);//metadata = metadata;
        return audio;
    }).catch(err => {
        var e = new Error( `mm.parseFile('${file.path}'): ${/*err.stack||*/err}`);
        e.stack = err.stack;
        console.warn(e.message);//\nmodel._stats:${inspect(model._stats)}`)
        model._stats.loadMetadata.errors.push(e);
        return audio;
        // throw e;
    });
});

// audioSchema.method('toString', function toString(options) {
//     return inspect(this, options || { depth: 0, compact: true });
// })
module.exports = mongoose.model('audio', audioSchema);
