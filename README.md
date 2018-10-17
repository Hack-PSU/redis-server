## Node + Express + Redis



This is a template for you to use on your Redis Caching Server. Follow the directions below to get started.


The back-end API includes:

1. User auth
1. Testing via Mocha and Chai as well as Istanbul for code coverage

## Quick Start

### Using Docker
1. Clone and install dependencies
1. Update the config:
  - Rename the *.env_sample* file to *.env* and update
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

### Using NPM & Redis Directly
1. Install Redis (skip if already done):
```
    sudo apt-get update
    sudo apt-get install build-essential tcl
    cd /tmp
    curl -O http://download.redis.io/redis-stable.tar.gz
    tar xzvf redis-stable.tar.gz
    cd redis-stable
    make
    sudo make install
```

1. Run Redis Server (skip if already done):
```
redis-server
```
1. Clone and install dependencies:
```
git clone [link to repo]
cd redis-server
npm install
```
1. Update the config:
  - Rename the *.env_sample* file to *.env* and update
1. Run the app - `npm start`

> The database, if empty, is seeded with an admin user - username: *ad@min.com* / password: *admin*

## Documentation
Documentation is stored in the `doc/` folder. We use `apidoc.js` to generate the files.
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