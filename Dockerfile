FROM node:18

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install deps
RUN npm install

# Start the app
CMD ["node", "server.js"]
