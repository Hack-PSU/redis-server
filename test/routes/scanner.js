//process.env.APP_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../src/server/app');
const Scanner = require('../../src/server/models/scanner');
const should = chai.should();

chai.use(chaiHttp);

describe('INTEGRATION TEST: GET /auth/scanner/register', () => {
  it('it should get api key for scanner', (done) => {
    let body = {
      "pin": process.env.SCANNER_ADMIN_PIN
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
      .send({ email: 'ad@min.com', password: process.env.ADMIN_PASS })
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
  let wristbandID = "TEST_WID";
  let agent = chai.request.agent(app);

  //Needed to remove all extraneous data from Mongo and Redis and reload with proper data before moving forward.
  before(function (done){

    Scanner.deleteMany({}, (err) => {
      if(err) {
        console.log(err);
      }else{
        let body = {
          "pin": process.env.SCANNER_ADMIN_PIN
        };
        chai.request(app)
          .post('/auth/scanner/register')
          .send(body)
          .end((err, res) => {
            should.equal(err, null);
            res.should.have.status(200);
            res.body.should.contain.keys(["status", "data", "message"]);
            res.body.status.should.be.equal("success");
            apikey = res.body.data.apikey;
            //reset redis
            agent.post('/auth/login')
              .send({ email: 'ad@min.com', password: process.env.ADMIN_PASS })
              .then(function (res) {
                //res.should.have.cookie('sessionid');
                // The `agent` now has the sessionid cookie saved, and will send it
                // back to the server in the next request:
                agent.get('/auth/removeall')
                  .then(function(res){
                    console.log(res.body);
                    return agent.get('/auth/updatedb')
                      .then(function (res) {
                        res.should.have.status(200);
                        agent.close();
                        done();
                      });
                  });

              });
          });
      }
    });
  });

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