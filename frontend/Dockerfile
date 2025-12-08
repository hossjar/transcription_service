# frontend/Dockerfile

FROM node:18-alpine

WORKDIR /app

# Install dependencies needed for some node modules
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm install

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm run build

# [STABILITY] Fix permissions so the secure user can manage the cache
RUN chown -R node:node /app

# [SECURITY] Switch to the secure 'node' user
USER node

EXPOSE 3000

CMD ["npm", "start"]