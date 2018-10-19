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
    - Rename the *.env_sample* file to *.env* and update all the *change_me* 
    values to values that you would like to use.
1. Run the app - `npm start`
1. Go to `http://localhost:3000` to see running website.

> The database, if empty, is seeded with an admin user - username: *ad@min.com* / password: *admin*

## Enable HTTPS

1. Generate an SSL certificate (must be self-signed if hosting locally)
    ```sh
    # generate private key and enter pass phrase
    openssl genrsa -des3 -out private_key.pem 2048
    
    # create certificate signing request, enter "*" as a "Common Name", leave "challenge password" blank
    openssl req -new -sha256 -key private_key.pem -out server.csr
    
    # generate self-signed certificate for 1 year
    openssl req -x509 -sha256 -days 365 -key key.pem -in server.csr -out cert.pem
    
    # validate the certificate
    openssl req -in server.csr -text -noout | grep -i "Signature.*SHA256" && echo "All is well" || echo "This certificate doesn't work in 2017! You must update OpenSSL to generate a widely-compatible certificate"

    ```
1. Copy the cert.pem and key.pem files to the `src/server/bin/keys/` directory.
1. Open the `src/server/bin/www` file.
    1. Uncomment the `Create HTTPS server.` section
    1. Comment the `Create HTTP server.` section
1. Get the fingerprint of the certificate: `openssl x509 -noout -in cert.pem -fingerprint`
1. Save the fingerprint for verifying Redis identity on Scanners.


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