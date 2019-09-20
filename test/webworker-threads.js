
function fibo (n) {
  return n > 1 ? fibo(n - 1) + fibo(n - 2) : 1;
}

function cb (err, data) {
  process.stdout.write(" ["+ this.id+ "]"+ data);
  this.eval('fibo(35)', cb);
}

var Threads= require('webworker-threads');

Threads.create().eval(fibo).eval('fibo(35)', cb);
Threads.create().eval(fibo).eval('fibo(35)', cb);
Threads.create().eval(fibo).eval('fibo(35)', cb);
Threads.create().eval(fibo).eval('fibo(35)', cb);
Threads.create().eval(fibo).eval('fibo(35)', cb);

(function spinForever () {
	// console.log('.');
  setImmediate(spinForever);
})();