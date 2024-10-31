FROM --platform=linux/arm64 node:20.10-alpine3.19
WORKDIR /app
ADD . .
EXPOSE 3000
ENTRYPOINT [ "npm", "start" ]
