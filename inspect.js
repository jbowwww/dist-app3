
const inspect = require('./utility.js').makeInspect({ depth: 2, breakLength: 0, compact: false });
const util = require('util');
const _ = require('lodash');

module.exports = {
	withGetters(wrapped, inspectFn) {
		return Object.assign(wrapped, {
			[util.inspect.custom]: typeof inspectFn === 'function' ? inspectFn
			 : () => inspect(_.assign({}, wrapped))
		});
	},
	array(wrapped, inspectFn) {
		return Object.assign(wrapped, {
			[util.inspect.custom]: typeof inspectFn === 'function' ? inspectFn
			 : () => 'Array[' + this.items.length + ']'
		});
	}
};
