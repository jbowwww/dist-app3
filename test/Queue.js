var assert = require('assert');
var { inspect } = require('util');

var Queue = require('../Queue.js');

console.log(inspect(assert));

describe('Queue', function() {
	var q = new Queue();
  describe('#add()', function() {
    it('should return a Promise', function() {
      assert.ok(q.add(() => {}) instanceof Promise);
    });
  });
});
