## Node + Express + Redis



This is a template for you to use on your Redis Caching Server. Follow the directions below to get started.


The back-end API includes:

1. User auth
1. Testing via Mocha and Chai as well as Istanbul for code coverage

## Quick Start

### Using Docker
1. Clone and install dependencies
1. Update the config:
  - Rename the `.env_sample` file to `.env` and update *change_me* to your custom keys
    - This is where all our environment variables and passwords go.
    - To learn more check out the section on [.env](#environment-variables) files and how it's used.
1. Run the app - `docker-compose up -d --build`

#### Some useful docker commands:
Use this to rebuild containers and have it pull from Github:
```
docker-compose build --no-cache [container if necessary]
```

To rebuild and redeploy only web container when redis is up:
```
docker-compose up -d --build web
```

To just restart it… call this:
```
docker-compose restart web
```
To just start and stop all of the instances (and preserve data):
```
docker-compose start
docker-compose stop
```

To bring everything down and remove the containers, use:
```
docker-compose down
```

### Using NPM & Redis Directly
1. Install Redis (skip if already done):
    ```
    wget http://download.redis.io/redis-stable.tar.gz
    tar xvzf redis-stable.tar.gz
    cd redis-stable
    make
    sudo make install
    ```
 1. Install MongoDB (skip if already done):
    - MacOS using Homebrew: `brew update; brew install mongodb`
    - Ubuntu: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/
    - Red Hat: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-red-hat/
    - Amazon Linux: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-amazon/
    - For other methods check here: https://docs.mongodb.com/manual/administration/install-community/

1. Run Redis Server (skip if already done):
    ```
    redis-server
    ```
 1. Run MongoDB (skip if already done):
    ```
    mongod --config /usr/local/etc/mongod.conf
    ```
1. Clone and install dependencies:
    ```
    git clone https://github.com/Hack-PSU/redis-server.git
    cd redis-server
    npm install
    ```
1. Update the config:
     - Rename the `.env_sample` file to `.env` and update *change_me* to your custom keys
       - This is where all our environment variables and passwords go.
       - To learn more check out the section on [.env](#environment-variables) files and how it's used.
1. Run the app - `npm start`
1. Go to `http://localhost:3000` to see running website.

> The database, if empty, is seeded with an admin user - username: *ad@min.com* / password: *change_me*

## Enable/Disable HTTPS

1. View the [HTTPS.md](src/server/bin/keys/HTTPS.md) file to learn more.

## Environment Variables
The function of environment variables is to make sure that you don't have important passwords and keys in your code.
Doing this is good practice, so we use a `.env` file to help us load those variables at runtime. To help you get started,
we made a `.env_sample` file that you can rename to `.env`. 

Here are the variables that we currently use in our codebase:

| Variable  | Purpose/Explanation | Possible Values |
| --------- | ------------------- | --------------- |
| SECRET_KEY  | Random string used to sign the session ID cookie. This should be as unidentifiable as possible. | String |
| NODE_ENV | The current use case of the whole application. Change this value when you're testing this or developing this instead of running this in full production.  | test/development/stage |
| SECRET | Used to sign JWT (JSON Web Tokens) tokens for authentication. Make this as random as possible. | String |
| PORT | The port that this application will run on. | Number *(i.e: 80, 443, 3000, 8080)* |
| SERVER_HOSTNAME | Redis server acts as a cache for your main API server handling your data. This is the variable that contains the URL of the server you ultimately hope to get and send your requests to. | URL *(i.e: https://api.hackpsu.org)*|
| SERVER_PORT | The port your main API server is running on. Sometimes when you run the API directly on your computer this port may change from 443 to 5000. This gives you the opportunity to handle that. | Number *(i.e: 80, 443, 3000, 8080) |
| SERVER_VERSION | This variable details the version of code your main API server is running. Your main API server could be running multiple versions, each hosted on the same hostname but a different route (i.e */v1/* vs */v2/*). | Route *(i.e: v1, v2, v3, ...)* |
| SERVER_API_KEY | This is the API_KEY that you'll use to authenticate yourself to your main API server. | String |
| FOOD | This is the number that represents the location ID for food events so we can understand if people have been trying to get a second serving before others have gotten a first. | Number (Integer for location ID) |
| USE_HTTPS | This is a true/false flag that identifies if we will be running this using https or not. To learn more on how to set this up read [HTTPS.md](src/server/bin/keys/HTTPS.md). | true/false |
| SSL_KEY_PASS | This is the password that was used to generate the private key for the SSL cert that is used for HTTPS. To learn more on how to set this works, read [HTTPS.md](src/server/bin/keys/HTTPS.md) | String |
| SCANNER_ADMIN_PIN | This is the pin that we use to authenticate scanners when they connect to redis server and try to get an API_KEY. Scanners will not be able to get an api key without this pin. | String |
| ADMIN_PASS | This is the password to login into the ad@min.com user that is the default admin of the redis-server. | String

## Documentation
Documentation is stored in the `doc/` folder. To view it, open the 
`index.html` file inside the folder using a browser. 
We use `apidoc.js` to generate the files.
To update the generated doc files, run:
```
npm run apidoc
```
## Todo

- Setup unit tests
- Setup proper security (ssl, proper auth workflow)
- Implement csrf

## Development Workflow

1. Create feature branch
1. Develop/test locally (hack! hack! hack!)
1. Create PR, which triggers Travis CI
1. After tests pass, merge the PR
1. Tests run again on Travis CI
1. Once tests pass, code is deployed automatically to staging server on AWS

## Tests

Without code coverage:

```sh
$ npm test
```

With code coverage:

```sh
$ npm run cov
```

## Changelog

1. 02/20/2018 - Initial Commit

## JSON API Documentation


### Tabs

- POST `/tabs/setup` - Associate user with rfid tag
- GET `/tabs/updatedb` - Pull user data from remote DB to redis cache
- POST `/tabs/add` - increment counter to # of scans for RFID & food
- POST `/tabs/getpin` - pull user information from pin
- GET `/tabs/resetcounter` - reset all food counters to 0



## Screenshots