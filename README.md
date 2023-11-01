# Backend

This is a backend to be able to make a connection to the database hosting the data of the simulations.

## How to use

1. Install with `npm install`
2. Run with `npm run start` (or `node server.js`)

This will run it as a server listening for requests at localhost:3000

## Docker

Instead of running it locally you can use it in the form of a docker image.

Build the Docker image:
`docker build -t stoerningsfri-stad-2-backend .`

Run the Docker container: (You will need to fill in the correct passwords etc)
`docker run -p 3000:3000 -d stoerningsfri-stad-2-backend -e "SSH_USERNAME=xx" -e "SSH_PASSWORD=xx" -e "SSH_HOST=1.1.1.1" -e "SSH_PORT=1234" -e "DESTINATION_IP=1.1.1.1" -e "DESTINATION_PORT=1234" -e "DATABASE_PORT=1234" -e "DATABASE_USERNAME=" -e "DATABASE_PASSWORD=xx" -e "DATABASE_NAME=xx"`

