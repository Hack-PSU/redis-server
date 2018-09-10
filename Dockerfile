FROM node:latest
MAINTAINER Pranav Jain "pranajain@gmail.com"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app



# Bundle app source... USE git for server, but copy for developement
#RUN git clone git://github.com/ThePBJain/BarTab-Server.git .
#COPY .env .
COPY . .
COPY ./src/server/bin/keys/ src/server/bin/keys/
# Install app dependencies
RUN npm install
ENV RUN_ENV=mongo
EXPOSE 3000
CMD [ "npm", "start" ]
