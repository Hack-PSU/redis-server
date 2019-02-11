//process.env.APP_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../src/server/app');
const Scanner = require('../../src/server/models/scanner');
const should = chai.should();

chai.use(chaiHttp);
let mochaAsync = (fn) => {
  return done => {
    fn.call().then(done, err => {
      done(err);
    });
  };
};

describe('INTEGRATION TEST: GET /auth/scanner/register', () => {
  let agent = chai.request.agent(app);
  let pin = 0;
  before( mochaAsync(async function (done){
    await agent.post('/auth/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASS });
    let res = await agent.post('/api/scanners/');
    console.log("AGENT BODY: " + JSON.stringify(res.body));
    res.should.have.status(200);
    res.body.should.contain.keys(["status", "data", "message"]);
    res.body.data.should.contain.keys(["pin", "name"]);
    pin = res.body.data.pin;
    agent.close();
  }));
  it('it should get api key for scanner', (done) => {
    let body = {
      "pin": pin
    };
    chai.request(app)
      .post('/auth/scanner/register')
      .send(body)
      .end((err, res) => {
        should.equal(err, null);
        res.should.have.status(200);
        res.body.should.contain.keys(["status", "data", "message"]);
        res.body.status.should.be.equal("success");
        res.body.data.should.contain.keys(["apikey", "name"]);
        //console.log(res.body);
        done();
      });
  });
});

describe('INTEGRATION TEST: GET /auth/updatedb', () => {
  let agent = chai.request.agent(app);

  it('it should get login and update redis db', (done) => {
    agent.post('/auth/login')
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASS })
      .then(function (res) {
        //res.should.have.cookie('sessionid');
        // The `agent` now has the sessionid cookie saved, and will send it
        // back to the server in the next request:
        return agent.get('/auth/updatedb')
          .then(function (res) {
            console.log("AGENT BODY: " + res.body);
            res.should.have.status(200);
            agent.close();
            done();
          });
      });
  });
});

//TODO: figure out how to reset redis to disassociate scans (maybe an after tag that unassociates them
describe('INTEGRATION TEST: ALL /rfid/ routes', () => {
  let apikey = "";
  //part of test data on redis
  let pin = 512;
  let pinName = "Caitlin Sanders";
  let wristbandID = "TEST_WID";
  let agent = chai.request.agent(app);

  //Needed to remove all extraneous data from Mongo and Redis and reload with proper data before moving forward.
  before( mochaAsync(async function (done) {
    await Scanner.deleteMany({}).exec();
    await agent.post('/auth/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASS });
    let pinRes = await agent.post('/api/scanners/');
    await agent.get('/auth/removeall');
    let updateDBRes = await agent.get('/auth/updatedb');
    updateDBRes.should.have.status(200);
    agent.close();
    console.log("AGENT BODY: " + JSON.stringify(pinRes.body));
    pinRes.should.have.status(200);
    pinRes.body.should.contain.keys(["status", "data", "message"]);
    pinRes.body.data.should.contain.keys(["pin", "name"]);
    let apiPin = pinRes.body.data.pin;

    let body = {
      "pin": apiPin
    };
    let scannerRes = await chai.request(app).post('/auth/scanner/register').send(body);
    console.log(scannerRes.body);
    console.log(scannerRes.status);
    scannerRes.should.have.status(200);
    scannerRes.body.should.contain.keys(["status", "data", "message"]);
    scannerRes.body.status.should.be.equal("success");
    apikey = scannerRes.body.data.apikey;

    //updateDBRes.should.have.status(200);

  }));

  it('it should get user info from pin', (done) => {
    let body = {
      "pin": pin,
      "apikey": apikey
    };
    chai.request(app)
      .post('/rfid/getpin')
      .send(body)
      .end((err, res) => {
        should.equal(err, null);
        res.should.have.status(200);
        res.body.should.contain.keys(["status", "data", "message"]);
        res.body.data.name.should.be.equal(pinName);
        res.body.status.should.be.equal("success");
        done();
      });
  });
  it('it should associate wristband id to user', (done) => {
    let body = {
      "wid": wristbandID,
      "pin": pin,
      "apikey": apikey
    };
    chai.request(app)
      .post('/rfid/assignment')
      .send(body)
      .end((err, res) => {
        should.equal(err, null);
        res.should.have.status(200);
        res.body.should.contain.keys(["status", "data", "message"]);
        res.body.status.should.be.equal("success");
        res.body.message.should.be.equal("Created tab.");
        done();
      });
  });
  it('it should get current active locations', (done) => {
    chai.request(app)
      .get('/rfid/active-locations')
      .end((err, res) => {
        should.equal(err, null);
        console.log(res.body);
        res.should.have.status(200);
        res.body.should.contain.keys(["status", "locations", "length", "message"]);
        res.body.status.should.be.equal("success");
        res.body.locations.should.be.a("array");
        done();
      });
  });
});