
http.createServer(function (req, res) {	
  // Wrap your request with namespace.run
  namespace.run(() => {
    const transactionId = uuid.v1();

    // Set any variable using the set function
    namespace.set('tid', transactionId);

    someAsyncFunc.then((data) => {

      // Get your variable using namespace.get 
      console.log('Some message', { transactionId: namespace.get('tid') });
      res.end(data);
    }).catch((err) => {
      console.log(err.message, { transactionId: namespace.get('tid') });
    });
  });

}).listen(8079);

You can retrieve any context variable in any other file

const { getNamespace } = require('node-request-context');
const namespace = getNamespace('myapp.mynamespace');

class A {
  foo() {
    const tid = namespace.get('tid')
  }
}