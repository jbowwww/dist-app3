"use strict";

const mongoose = require('mongoose');
const FsEntry = require('./fs-entry.js');

module.exports = FsEntry.discriminator('Dir', new mongoose.Schema({}));;
