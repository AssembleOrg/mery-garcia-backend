FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies using npm (more compatible)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main.js"]
