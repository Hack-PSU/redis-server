/**
 * Created by PranavJain on 2/20/17.
 */
var express = require('express');
var router = express.Router();

var passport = require('../../lib/auth');
var helpers = require('../../lib/helpers');
var redis = require('../../lib/redis');
var request = require("request-promise-native");
var serverOptions = require('../../lib/remoteServer');
// using redis, create, edit and delete tabs
//(todo) set up authentication for each merchant to access redis (NO ONE ELSE)

//commands for redis
/*
create
(create)
 HMSET tab:MerchantID.UserID userID "<UserID>" merchantID "<MerchantID>" tabTotal <total tab money spent> Products "[{productID: \"product3\", name: \"product3\", time: { type: Date, default: Date.now }}]"

    (add to running list) so its searchable...
    SADD tabs:MerchantID MerchantID.UserID

 (get)
 HMGET tab:MerchantID.UserID tabTotal merchantID Products etc.

(search for tabs that are associated with a merchant)
 SSCAN tabs 0 MATCH MerchantID*

 (delete)
  DEL tab:MerchantID.UserID
    (delete from running list) so its no longer searched...
    SREM users "MerchantID.UserID"

    tabs: {
        MerchantID : {
            userID1 : {
                userID: "",
                merchantID: "",
                tabTotal: 0,
                numProducts: 0,
                Products: [
                    {
                        productID: "",
                        name: "",
                        time: "Date.now"
                    },
                    {
                        productID: "",
                        name: "",
                        time: "Date.now"
                    }
                ]
            },
            userID2 : {
                userID: "",
                merchantID: "",
                tabTotal: 0,
                numProducts 0,
                Products: [
                    {
                        productID: "",
                        name: "",
                        time: "Date.now"
                    },
                    {
                        productID: "",
                        name: "",
                        time: "Date.now"
                    }
                ]
            }
        }
    }





 */
//todo: move queues to redis
var unsent_scans = [];
var unsent_assignments = [];

function clone(a) {
    return JSON.parse(JSON.stringify(a));
}
//Todo: set up failsafes for all methods!!!!

//authorization functions
const requireAuth = passport.authenticate('user-mobile', { session: false });
//all functions with "requireAuth" used to have helpers.ensureAuthenticated

//rename Tab localhost:3000/tabs/setup/ with rfid tag
//btw we know pin exists
router.post('/setup', function(req, res, next) {
        //var store = new Store({
        //    'name': req.body.name,
        //    'description': req.body.description,
        //});
    var userRFID = req.body.id;
    //we know pin exists
    var pin = req.body.pin;

    console.log("OPENING TAB WITH USER: " + userRFID);
    console.log("WE HAVE PIN: " + pin);
        //todo: if redis.exists(tabkey) then throw danger error.
        //could mean that they are trying to override their currently open tab...
        redis.hgetall(userRFID, function (err, obj) {
            if(err){
                res.status(500)
                    .json({
                        status: 'error',
                        data: err,
                        message: 'Something went wrong'
                    });
            }else {
                console.log("This is what we found when checking if tab is already open");
                console.dir(obj);
                if (obj) {
                    res.status(200)
                        .json({
                            status: 'success',
                            data: obj,
                            message: 'Already Opened.'
                        });
                }else{
                    redis.rename(pin, userRFID, function(err, reply) {
                        // returns error if couldn't find pin...
                        if(err){
                            console.log("ERR Could not find pin: " + err);
                            res.status(500).json({
                                status: "error",
                                data: err,
                                message: "invalid pin"
                            });
                        }else {
                            console.log("Successfully set rfid to tab!");
                            res.status(200)
                                .json({
                                    status: 'success',
                                    data: reply,
                                    message: 'Created tab.'
                                });
                            //send rfid change to server asynchronously
                            //get user
                            redis.hgetall(userRFID, function (err, obj) {
                                if(err){
                                    console.log(err);
                                }else{
                                    console.dir(obj);

                                    //prep request to send asynch
                                    var options = clone(serverOptions);
                                    options.method = 'POST';
                                    options.uri = options.uri + '/v1/pi/assignment';
                                    var scan = {
                                        "rfid_uid": userRFID,
                                        "user_uid": obj.uid,
                                        "time": Date.now()
                                    };
                                    unsent_assignments.push(scan);
                                    options.body = {
                                        assignments: unsent_assignments
                                    };
                                    console.dir(unsent_assignments);
                                    request(options).then(function (response) {
                                        console.dir("SUCCESS: " + response);
                                        unsent_assignments = [];
                                    }).catch(function (err) {
                                        // Something bad happened, handle the error
                                        console.log(err);
                                        //don't delete unsent_assignments...
                                    });
                                }
                            });


                        }
                    });
                }
            }
        });


    });


router.get('/updatedb', function(req, res, next) {
    //var store = new Store({
    //    'name': req.body.name,
    //    'description': req.body.description,
    //});
    var options = clone(serverOptions);
    var uri = options.uri;
    options.uri = uri + '/v1/pi/registrations';
    request(options)
        .then(function (response) {
            // Request was successful, use the response object at will
            console.log(response);
            //do redis stuff then
            //todo: this is being treated synchronously when it's not synchronous fix with promises
            var numErrors = 0;
            var promises = [];
            //code to build promises to run
            response.map(function(element) {
                promises.push(new Promise(function(resolve, reject){
                        redis.hmset(element.pin, {
                            "uid": element.uid,
                            "pin": element.pin || "NULL",
                            "name": element.firstname + ' ' + element.lastname,
                            "shirtSize": element.shirt_size,
                            "diet": element.dietary_restriction || "NULL",
                            "counter": 0,
                            "numScans": 0

                        }, function(err, reply) {
                            // reply is null when the key is missing
                            if (err) {
                                //todo: make queue to reinsert into db
                                numErrors++;
                                console.log("ERROR inserting into db: " + err);
                                resolve();
                            } else {
                                console.log("Successfully opened tab with info!");
                                resolve();
                            }
                        });
                    })
                );

            });
            /*
            for(var i = 0;  i < response.length; i++){
                redis.hmset(response[i].pin, {
                    "uid": response[i].uid,
                    "pin": response[i].pin || "NULL",
                    "name": response[i].firstname + ' ' + response[i].lastname,
                    "shirtSize": response[i].shirt_size,
                    "diet": response[i].dietary_restriction || "NULL",
                    "counter": 0,
                    "numScans": 0

                }, function(err, reply) {
                    // reply is null when the key is missing
                    if (err) {
                        //todo: make queue to reinsert into db
                        numErrors++;
                        console.log("ERROR inserting into db: " + err);
                    } else {
                        console.log("Successfully opened tab with info!");
                    }
                });
            }*/

            //run promises
            Promise.all(promises).then(function(){
                //return to homepage with success flash.
                if(numErrors > 0){
                    //err
                    console.log("REDIRECTED TO ERR");
                    req.flash('message', {
                        status: 'danger',
                        value: 'Some inserts into redis failed.'
                    });
                    return res.redirect('/');
                }else{
                    //success
                    console.log("REDIRECTED TO SUCC");
                    req.flash('message', {
                        status: 'success',
                        value: 'Successfully added all users to redis.'
                    });
                    return res.redirect('/');
                }
            });


        })
        .catch(function (err) {
            // Something bad happened, handle the error
            console.log(err);
            res.status(500)
                .json({
                    status: 'err',
                    data: err,
                    message: 'Something went wrong'
                });
        });


});

//increment counter to tab of rfid: https://redis.io/commands/hincrby
router.post('/add', function(req, res, next) {
    //var store = new Store({
    //    'name': req.body.name,
    //    'description': req.body.description,
    //});
    var location = req.body.piid;
    var userRFID = req.body.id;
    //apparently location isn't readable: will look something like this: 0e55dd370be84d68b9e02d9642061de0
    console.log("Scanned RFID: " + userRFID + "\n with pi ID: " + location);

    //send to server asynchronously
    var scan = {
        "rfid_uid": userRFID,
        "scan_location": location,
        "scan_time": Date.now()
    };
    unsent_scans.push(scan);
    var options = clone(serverOptions);
    var uri = options.uri;
    options.uri = uri + '/v1/pi/scans';
    options.method = 'POST';
    options.body = {
        scans: unsent_scans
    };

    console.log("UNSENT SCANS: " + JSON.stringify(unsent_scans));
    //todo:worry about promises and mutli data usage
    request(options).then(function (response) {
        //empty list of unsent scans
        console.dir("SUCCESS: " + response);
        unsent_scans = [];
    }).catch(function (err) {
        // Something bad happened, handle the error
        console.log(err);
        //do not remove unsent scans
    });


    //todo: if redis.exists(tabkey) then throw danger error.
    //could mean that they are trying to override their currently open tab...
    //redis.hget(tabKey, "numProducts", function (err, reply) {
    //add to redis
    if(location == "Atrium"){
        redis.HINCRBY(userRFID, "counter", 1, function (err, obj) {
            if(err){
                res.status(500)
                    .json({
                        status: 'error',
                        data: err,
                        message: 'Something went wrong'
                    });
            }else {
                console.log("Incrementing counter for # times RFID has been scanned for food");
                console.dir(obj);
                if (obj) {
                    redis.hgetall(userRFID, function (err, user) {
                        console.dir(user);
                        if(err){
                            res.status(500)
                                .json({
                                    status: 'error',
                                    data: err,
                                    message: 'Something went wrong'
                                });
                        }else{
                            var retVal = {
                                name: user.name,
                                diet: user.diet,
                                isRepeat: false
                            };
                            if(parseInt(obj) > 1){
                                retVal.isRepeat = true;
                            }

                            res.status(200)
                                .json({
                                    status: 'success',
                                    data: retVal,
                                    message: 'Incremented Tab.'
                                });
                        }

                    });
                }else{
                    res.status(500)
                        .json({
                            status: 'error',
                            data: obj,
                            message: 'Couldn\'t find rfid'
                        });
                }
            }
        });
    }else{
        redis.HINCRBY(userRFID, "numScans", 1, function (err, obj) {
            if(err){
                res.status(500)
                    .json({
                        status: 'error',
                        data: err,
                        message: 'Something went wrong'
                    });
            }else {
                console.log("Incrementing numScans for # times RFID has been scanned");
                console.dir(obj);
                if (obj) {

                    var numScans = parseInt(obj.toString()) - 1;
                    var scanLocKey = "Scan." + numScans + ".location";
                    var scanTimeKey = "Scan." + numScans + ".time";
                    var data = {};
                    var date = scan.scan_time;
                    console.log("DATE: "+ date);
                    data[scanLocKey] = location;
                    data[scanTimeKey] = date;
                    redis.hmset(userRFID, data, function(err, reply) {
                        // reply is null when the key is missing
                        if (err) {
                            return next(err);
                        } else {
                            console.log("Successfully added to tab!");
                            redis.hgetall(userRFID, function (err, user) {
                                console.dir(user);
                                if(user) {
                                    res.status(200)
                                        .json({
                                            status: 'success',
                                            data: user,
                                            message: 'Incremented Tab.'
                                        });
                                }else{
                                    res.status(200)
                                        .json({
                                            status: 'success',
                                            data: reply,
                                            message: 'Incremented Tab.'
                                        });
                                }
                            });

                        }
                    });

                }else{
                    res.status(500)
                        .json({
                            status: 'error',
                            data: obj,
                            message: 'Something went wrong'
                        });
                }
            }
        });
    }




});

router.get('/name', function(req, res, next) {

    var location = req.body.piid.toString();
    var userRFID = req.body.id;
    //this is the index number of the item we would like to remove from the tab
    //test output
    redis.hget(userRFID, "name", function (err, obj) {
        if(err){
            return next(err);
        }else {
            console.dir(obj);
            if(obj){
                res.status(200)
                    .json({
                        status: 'success',
                        data: obj,
                        message: 'Retrieved tab.'
                    });
            }else{
                res.status(404)
                    .json({
                        status: 'error',
                        data: obj,
                        message: 'Could not find.'
                    });
            }
        }
    });


    });

router.get('/shirtSize', function(req, res, next) {

    var location = req.body.piid.toString();
    var userRFID = req.body.id;
    //this is the index number of the item we would like to remove from the tab
    //test output
    redis.hget(userRFID, "shirtSize", function (err, obj) {
        if(err){
            return next(err);
        }else {
            console.dir(obj);
            res.status(200)
                .json({
                    status: 'success',
                    data: obj,
                    message: 'Retrieved tab.'
                });
        }
    });


});

router.get('/diet', function(req, res, next) {

    var location = req.body.piid.toString();
    var userRFID = req.body.id;
    //this is the index number of the item we would like to remove from the tab
    //test output
    redis.hget(userRFID, "diet", function (err, obj) {
        if(err){
            return next(err);
        }else {
            console.dir(obj);
            res.status(200)
                .json({
                    status: 'success',
                    data: obj,
                    message: 'Retrieved tab.'
                });
        }
    });


});

/*
keys   for index 0
 Products.0.productID = ProductID
 Products.0.time = Date.now
 */


//get all tabs w/ merchantID
//what information should we return?
router.post('/getall', helpers.ensureMerchantAuthenticated,
    function(req, res, next) {

        var merchantID = req.user._id.toString();

        //this is the index number of the item we would like to remove from the tab

        console.log("Getting all tabs for MERCHANT: " + merchantID);

        var tabsKey = "tabs:" + merchantID;
        redis.smembers(tabsKey, function (err, reply) {
            if(err){
                return next(err);
            }
            else {
                var allTabs = reply;
                console.log("All tabs: " + allTabs);
                res.status(200)
                    .json({
                        status: 'success',
                        data: allTabs,
                        message: 'Retrieved all tabs from merchant.'
                    });
            }
        });


    });


//get tab info for user w/ userID like tabTotal and products bought
//passing in merchantID for this specific user
router.get('/tab/:id', requireAuth,
    function(req, res, next) {

        var userID = req.user._id.toString();
        var merchantID = req.params.id;
        //this is the index number of the item we would like to remove from the tab

        var tabKey = "tab:" + merchantID + "." + userID;
        //test output
        redis.hgetall(tabKey, function (err, obj) {
            if(err){
                return next(err);
            }else {
                console.dir(obj);
                res.status(200)
                    .json({
                        status: 'success',
                        data: obj,
                        message: 'Retrieved tab.'
                    });
            }
        });


    });

//get User for merchant to populate information on bartender dashboard
//passing in userID
router.get('/user/:id', helpers.ensureMerchantAuthenticated,
    function(req, res, next) {

        var merchantID = req.user._id.toString();
        var userID = req.params.id;
        //this is the index number of the item we would like to remove from the tab

        var tabKey = "tab:" + merchantID + "." + userID;
        //test output
        redis.hgetall(tabKey, function (err, obj) {
            if(err){
                return next(err);
            }else {
                console.dir(obj);
                res.status(200)
                    .json({
                        status: 'success',
                        data: obj,
                        message: 'Retrieved tab.'
                    });
            }
        });


    });





//close tab
router.post('/close', helpers.ensureOAuthenticated,
    function(req, res, next) {
        //var store = new Store({
        //    'name': req.body.name,
        //    'description': req.body.description,
        //});
        var userID = req.user._id.toString();
        var merchantID = req.body.id;
        console.log("CLOSING TAB WITH USER: " + userID + "\n and MERCHANT: " + merchantID);


        var tabKey = "tab:" + merchantID + "." + userID;

        redis.hgetall(tabKey, function (err, tab) {
            if(err || !tab){
                return next(err);
            }else {
                console.dir(tab);


            }
        });


    });

module.exports = router;
