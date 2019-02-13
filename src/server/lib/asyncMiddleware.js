/** https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
 * When using async/await with express endpoints, errors could be handled improperly and we
 * need to design a try/catch block around each function.
 * Alex Bazhenov wrote this medium article about how to solve that problem while keeping your code clean.
 * I've linked the article above and used a version of his code below.
 **/
const asyncUtil = fn =>
  function asyncUtilWrap(...args) {
    const fnReturn = fn(...args);
    const next = args[args.length-1];
    return Promise.resolve(fnReturn).catch(next)
  };

module.exports = asyncUtil;