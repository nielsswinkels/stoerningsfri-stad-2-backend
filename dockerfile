# Use an official Node.js runtime as the base image
FROM node:16.20.0

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and package-lock.json into the directory /app in the container
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Bundle the app source inside the Docker image 
# (i.e., copy everything from the current directory into /app in the container)
COPY . .

# Make port 8080 available to the world outside the container
EXPOSE 8080

# Run the app when the container launches
CMD ["node", "server.js"]

# Adding a random comment here to trigger a git commit