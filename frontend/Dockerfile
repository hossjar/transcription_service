# frontend/Dockerfile

FROM node:18

WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Environment variables for build-time and runtime
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Copy the application code
COPY . .

# Build the application for production
RUN npm run build

# Document that the container uses port 3000
EXPOSE 3000

# Use production start command
CMD ["npm", "start"]

# Use development 
#CMD ["npm", "run", "dev"]