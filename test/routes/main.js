//process.env.APP_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../src/server/app');

const should = chai.should();

chai.use(chaiHttp);

// First index test
describe('index test', () => {
  it('it should respond with the main page', (done) => {
    chai.request(app)
      .get('/')
      .end((err, res) => {
        should.equal(err, null);
        res.should.have.status(200);
        done();
      });
  });
  it('it should respond with "pong"', (done) => {
    chai.request(app)
      .get('/ping')
      .end((err, res) => {
        should.equal(err, null);
        res.should.have.status(200);
        res.should.have.header('content-type', /^text\/html.*/);
        res.text.should.be.a("string");
        res.text.should.equal("pong!");
        done();
      });
  });
});