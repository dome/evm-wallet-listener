FROM node:16-alpine3.11 as builder
WORKDIR /usr/app
COPY package.json .
RUN npm install
RUN apk update
RUN apk upgrade
RUN apk add bash
CMD ["npm","run","dev"]
