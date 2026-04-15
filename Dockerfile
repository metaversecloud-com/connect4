FROM node:22-alpine
WORKDIR /app
ADD build ./build
ADD package* ./
ADD node_modules ./node_modules
EXPOSE 3000
ENTRYPOINT [ "node", "build/src/index.js" ]
