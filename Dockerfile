FROM node:12-slim
WORKDIR /Users/vn55pko/workflow1/testing-wrokflow
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
