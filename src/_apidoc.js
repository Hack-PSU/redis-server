// ------------------------------------------------------------------------------------------
// General apiDoc documentation blocks and old history blocks.
// ------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------
// Current Success.
// ------------------------------------------------------------------------------------------


// ------------------------------------------------------------------------------------------
// Current Errors.
// ------------------------------------------------------------------------------------------



// ------------------------------------------------------------------------------------------
// Current Permissions.
// ------------------------------------------------------------------------------------------



// ------------------------------------------------------------------------------------------
// History.
// ------------------------------------------------------------------------------------------

/**
 * @apiDefine UserData
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.uid        User's universal ID in remote db
 * @apiSuccess {String} data.pin        User's pin used to check-in
 * @apiSuccess {String} data.name       User's full name
 * @apiSuccess {String} data.shirtSize  User's shirt size
 * @apiSuccess {String} data.diet       User's dietary restrictions
 * @apiSuccess {Number} data.counter    Food counter for user.
 * @apiSuccess {Number} data.numScans   Number of scans taken for user (excluding food).
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status": "success",
 *       "data": {
 *         "uid": "nXNR0z8CrgT4TduIM6y0DpN6wRj1",
 *         "pin": "96",
 *         "name": "Dat Boi",
 *         "shirtSize": "M",
 *         "diet": "Vegetarian",
 *         "counter": 0,
 *         "numScans": 0
 *       },
 *       "message": "Successfully completed task."
 *     }
 */

/**
 * @api {post} /tabs/setup Register RFID Band to User
 * @apiVersion 1.0.0
 * @apiName Register RFID
 * @apiGroup RFID
 * @apiDescription
 * Register RFID Band to User. Sends assignment to main server, while locally replacing user key to RFID code.
 * @apiPermission Scanner
 *
 * @apiParam {Number} id  RFID code to set to user.
 * @apiParam {Number} pin Pin of user to add rfid code to.
 * @apiParam {String} apikey API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       id: "RFID1",
 *       pin: 94,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiSuccess {String} status  Status of response.
 * @apiSuccess {Object} data    Response from Redis.
 * @apiSuccess {String} message Response message.
 *
 * @apiSuccessExample {json} Success Response:
 *    HTTP/1.1 200 OK
 *    {
 *      status: "success",
 *      data: "OK",
 *      message: "Created tab."
 *    }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for rfid or pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {'err...'},
 *       message: "Invalid pin"
 *     }
 * @apiErrorExample {json} 409 Response
 *     HTTP/1.1 409 Not Found
 *     {
 *       status: 'error',
 *       data: {'Existing User data...'},
 *       message: 'RFID Tag already opened.'
 *     }
 */

/**
 * @api {post} /tabs/getpin Get User with Pin
 * @apiVersion 1.0.0
 * @apiName GetPin
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis that hasn't been assigned an rfid tag.
 * Pin is used to currently index user in redis if rfid hasn't been set.
 * @apiPermission Scanner
 *
 * @apiParam {Number} pin Pin of user.
 * @apiParam {String} apikey API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       pin: 94,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiUse UserData
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {},
 *       message: "Did not find anything"
 *     }
 */

/**
 * @api {post} /tabs/add Add User Scan
 * @apiVersion 1.0.0
 * @apiName ScanData
 * @apiGroup RFID
 * @apiDescription
 * Store and log scan location, rfid tag and timestamp. Verify if user is allowed to enter, and send response back.
 * Redis will also send the scan data to the main server asynchronously. Scanners will not find out if those requests will succeed or fail.
 * @apiPermission Scanner
 *
 * @apiParam {Number} id        RFID code of user.
 * @apiParam {Number} location  Location id that scan occurred at. (Set id's in admin app)
 * @apiParam {String} apikey    API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       id: 1695694065,
 *       location: 3,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.uid        User's universal ID in remote db
 * @apiSuccess {String} data.pin        User's pin used to check-in
 * @apiSuccess {String} data.name       User's full name
 * @apiSuccess {String} data.shirtSize  User's shirt size
 * @apiSuccess {String} data.diet       User's dietary restrictions
 * @apiSuccess {Number} data.counter    Food counter for user.
 * @apiSuccess {Number} data.numScans   Number of scans taken for user (excluding food).
 * @apiSuccess {Boolean} data.isRepeat  Whether user is a repeat scan or not (essentially allow/deny).
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "status": "success",
 *       "data": {
 *         "uid": "nXNR0z8CrgT4TduIM6y0DpN6wRj1",
 *         "pin": "96",
 *         "name": "Dat Boi",
 *         "shirtSize": "M",
 *         "diet": "Vegetarian",
 *         "counter": 0,
 *         "numScans": 0,
 *         "isRepeat": false
 *       },
 *       "message": "Successfully completed task."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for pin"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: 0,
 *       message: "Does not exist."
 *     }
 * @apiErrorExample {json} 417 Response
 *    HTTP/1.1 417 Expectation Failed
 *    {
 *      status: 'error',
 *      data: {...},
 *      message: 'Couldn\'t find rfid'
 *    }
 *
 */

/**
 * @api {post} /tabs/user-info Get User with RFID tag
 * @apiVersion 1.0.0
 * @apiName GetRFID
 * @apiGroup RFID
 * @apiDescription
 * Get all user information from redis for an RFID tag if it has been assigned.
 * RFID is used to index user in redis after user has been setup.
 * @apiPermission Scanner
 *
 * @apiParam {Number} id      RFID code of user.
 * @apiParam {String} apikey  API key for scanner to authenticate.
 * @apiParamExample {json} Request Body Example
 *     {
 *       id: 1695694065,
 *       apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *     }
 *
 * @apiUse UserData
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid values passed for rfid"
 * @apiErrorExample {json} 404 Response
 *     HTTP/1.1 404 Not Found
 *     {
 *       status: "error",
 *       data: {},
 *       message: "Did not find anything"
 *     }
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       message: "Redis database is down"
 *     }
 */

/**
 * @api {get} /tabs/active-locations Get all Active Locations
 * @apiVersion 1.0.0
 * @apiName GetActiveLocations
 * @apiGroup RFID
 * @apiPermission Scanner
 *
 * @apiSuccess {String} status    Status of response.
 * @apiSuccess {Number} length    Length of active locations returned
 * @apiSuccess {Array} locations  Array of currently active locations
 * @apiSuccess {String} message   Response message.
 * @apiSuccessExample {json} Success Response:
 *  HTTP/1.1 200 OK
 *  {
 *    status: 'success',
 *    length: 5,
 *    locations: [
      {
        "location_name": "Cybertorium",
        "uid": 2
      },
      {
        "location_name": "Atrium",
        "uid": 5
      },
      {
        "location_name": "Business Building Room 120",
        "uid": 6
      },
      {
        "location_name": "Atrium Staircase",
        "uid": 11
      },
      {
        "location_name": "Game room",
        "uid": 15
      }
    ],
    message: 'Found active locations.'
   }
 *
 */

/**
 * @api {post} /auth/scanner/register Register Scanner
 * @apiVersion 1.0.0
 * @apiName RegisterScanner
 * @apiGroup Admin
 * @apiDescription
 * Authenticate and register scanner on Redis-Server. This will provide an API Key in return which the scanner will use
 * for any and all requests to redis.
 * @apiPermission Admin
 *
 * @apiParam {String} pin Pin to use to prove that valid scanner is connecting to Redis. (Set valid pin in .env file)
 * @apiParamExample {json} Request Body Example
 *     {
 *       pin: "MASTER_KEY"
 *     }
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.name       Auto-Generated Name for Scanner
 * @apiSuccess {String} data._id        Scanner's universal ID
 * @apiSuccess {String} data.apikey     The API key that the scanner can now use
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         name: "2018-10-01T00:57:23.370Z",
 *         _id: "5bb170f354fd0f590ddf4103",
 *         apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *       },
 *       message: "Scanner Added. API Key Generated."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       data: {err},
 *       message: "There was an error."
 *     }
 */

/**
 * @api {post} /auth/scanner/register Register Scanner
 * @apiVersion 1.0.0
 * @apiName RegisterScanner
 * @apiGroup Admin
 * @apiDescription
 * Authenticate and register scanner on Redis-Server. This will provide an API Key in return which the scanner will use
 * for any and all requests to redis.
 * @apiPermission Admin
 *
 * @apiParam {String} pin Pin to use to prove that valid scanner is connecting to Redis. (Set valid pin in .env file)
 * @apiParamExample {json} Request Body Example
 *     {
 *       pin: "MASTER_KEY"
 *     }
 *
 * @apiSuccess {String} status          Status of response.
 * @apiSuccess {Object} data            User tab information.
 * @apiSuccess {String} data.name       Auto-Generated Name for Scanner
 * @apiSuccess {String} data._id        Scanner's universal ID
 * @apiSuccess {String} data.apikey     The API key that the scanner can now use
 * @apiSuccess {String} message         Response Message.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       status: "success",
 *       data: {
 *         name: "2018-10-01T00:57:23.370Z",
 *         _id: "5bb170f354fd0f590ddf4103",
 *         apikey: "0f865521-2c05-467d-ad43-a9bac2108db9"
 *       },
 *       message: "Scanner Added. API Key Generated."
 *     }
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 * @apiErrorExample {json} 500 Response
 *     HTTP/1.1 500 Server Error
 *     {
 *       status: "error",
 *       data: {err},
 *       message: "There was an error."
 *     }
 */

/**
 * @api {get} /auth/updatedb Update Redis DB
 * @apiVersion 1.0.0
 * @apiName UpdateRedis
 * @apiGroup Admin
 * @apiDescription
 * Update Redis Database with user information. All information will be stored with their pin as the key.
 * Users that have been assigned RFID tags will not be changed by this update.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} Returns Success page
 *
 * @apiErrorExample {json} 401 Response
 *     HTTP/1.1 401 Unauthorized
 *     "Invalid pin passed"
 */

/**
 * @api {get} /auth/resetcounter Reset Counter
 * @apiVersion 1.0.0
 * @apiName ResetCounter
 * @apiGroup Admin
 * @apiDescription
 * Used to reset the food counter when needed for next food event.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */

/**
 * @api {get} /auth/removeall Empty Redis
 * @apiVersion 1.0.0
 * @apiName EmptyRedis
 * @apiGroup Admin
 * @apiDescription
 * Remove all users from Redis. Flush all information from redis.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */

/**
 * @api {get} /auth/scanner/removeall Remove all Scanners
 * @apiVersion 1.0.0
 * @apiName EmptyScanners
 * @apiGroup Admin
 * @apiDescription
 * Remove all scanner objects from MongoDB. Cancels all active api keys and requires scanners to get new ones.
 * @apiPermission Admin
 *
 *
 * @apiSuccess {HTML} SuccessFlash Returns Success page
 *
 * @apiError {HTML} ErrorFlash Returns Error Message.
 */
