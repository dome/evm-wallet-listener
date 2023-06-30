FROM node:16-alpine3.11 as builder
WORKDIR /usr/app
COPY package.json .
RUN npm install
COPY . .
RUN apk update
RUN apk upgrade
RUN apk add bash
CMD ["npm", "start"]
