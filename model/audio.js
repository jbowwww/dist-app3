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

// var metadataSchema = new mongoose.Schema({
//         format: {
//             tagTypes: [mongoose.Schema.Types.Mixed],
//             dataFormat: String,
//             bitsPerSample: Number,
//             sampleRate: Number,
//             numberOfChannels: Number,
//             bitrate: Number,
//             lossless: Boolean,
//             numberOfSamples: Number,
//             Duration: Number
//         },
//         native: mongoose.Schema.Types.Mixed,
//         common: {
//             track: mongoose.Schema.Types.Mixed,
//             disk: mongoose.Schema.Types.Mixed
//         }
//     });

var audioSchema = new mongoose.Schema({
    fileId: { type: mongoose.SchemaTypes.ObjectId, required: true, unique: true },
    metadata:// mongoose.SchemaTypes.Mix{}//metadataSchema
    {
        format: {},
        //     tagTypes: [],//[mongoose.SchemaTypes.String],
        //     dataformat: String,
        //     bitsPerSample: Number,
        //     sampleRate: Number,
        //     numberOfChannels: Number,
        //     bitrate: Number,
        //     lossless: Boolean,
        //     numberOfSamples: Number,
        //     duration: Number
        // },
        native: {},//mongoose.Schema.Types.Mixed,
        common: {}
        // {
        //     track: mongoose.Schema.Types.Mixed,
        //     disk: mongoose.Schema.Types.Mixed
        // }
    }
}, { /*_id: false*/ });

// audioSchema.virtual('file').set(function(file) {
//     this._file = file;
//     this.fileId = file._id;
// })

audioSchema.plugin(require('./plugin/timestamp.js'));
audioSchema.plugin(require('./plugin/standard.js'));
audioSchema.plugin(require('./plugin/bulk-save.js'));
audioSchema.plugin(require('./plugin/stat.js'), { data: { save: {}, validate: {} } });

audioSchema.method('loadMetadata', function loadMetadata(file) {
    var audio = this;
    var model = this.constructor;
    console.debug(`audio=${inspectPretty(audio)} file=${inspectPretty(file)}`);
    return mm.parseFile(file.path).then(metadata => {
        console.debug(`metadata=${inspectPretty(metadata)}`);
        audio.metadata = metadata;
        return audio;
    }).catch(err => {
        console.warn(`mm.parseFile error: ${err.stack||err}`);//\nmodel._stats:${inspect(model._stats)}`)
        model._stats.errors.push(err);
    });
});

// audioSchema.method('toString', function toString(options) {
//     return inspect(this, options || { depth: 0, compact: true });
// })
module.exports = mongoose.model('Audio', audioSchema);
