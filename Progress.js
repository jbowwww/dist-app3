
module.exports = class Progress {
	constructor(totalGetter, currentGetter) {
		if (typeof totalGetter !== 'function' || typeof currentGetter !== 'function') {
			throw new TypeError('Progress.constructor: totalGetter and currentGetter should both be functions');
		}
		Object.defineProperty(this, 'total', { get: totalGetter });
		Object.defineProperty(this, 'current', { get: currentGetter });
		Object.defineProperty(this, 'progress', { get: () => (totalGetter() === 0) ? 0 : (100 * currentGetter() / totalGetter()) });
	}
};
