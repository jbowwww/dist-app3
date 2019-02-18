
const EventEmitter = require('events').EventEmitter;
const { inspect } = require('util');

const ee = new EventEmitter();

console.log(`\nee = ${inspect(ee)}\n\nee.prototype = ${inspect(ee.prototype)}\n\nee.constructor = ${(EventEmitter.constructor.toString())}\n\nEventEmitter.prototype = ${inspect(EventEmitter.prototype)}\n\nee.constructor.prototype = ${inspect(ee.constructor.prototype)}\n`);//\nee.prototype.prototype = ${inspect(ee.prototype.prototype)}\n`\nee.prototype.constructor.prototype = ${inspect(ee.prototype?.constructor.prototype)}\n`);