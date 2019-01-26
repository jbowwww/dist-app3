const path = require('path');

var tests = [ '/etc/home/network.conf', '/etc/home/network', '/etc/home/network/', '/', '/media/jk/Backup/RECOVERED_FILES/mystuff/Backup/crypto' ];

for (var test of tests) {
	var dirname = path.dirname(test);
	var basename = path.basename(test);

	console.log(`\ntest: '${test}'\ndirname: '${dirname}'\nbasename: '${basename}'\n`);
}
