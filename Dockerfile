FROM node

COPY package.json package.json 
COPY package-lock.json package-lock.json 
COPY main.js main.js

RUN npm i

CMD ["node", "main.js"]

