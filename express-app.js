
"use strict";
const console = require('./stdio.js').Get('expressApp', { minLevel: 'verbose' });	// debug verbose log
const inspect = require('./utility.js').makeInspect({ depth: 3, /*breakLength: 0,*/ compact: false });
const app = require('./app.js');

var expressApp = require('express')();
const expressPort = 3000;
expressApp.get('/', (req, res) => {
	res.send('hello');
});
expressApp.get('/tasks', (req, res) => {
	res.json(app._tasks);
});
expressApp.listen(expressPort, () => console.log(`expressApp listening on port ${expressPort}`));
