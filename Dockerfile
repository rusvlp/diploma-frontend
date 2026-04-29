FROM node:25-bookworm

WORKDIR app

COPY . .

RUN npm install 

CMD ["npm", "run", "dev", "--host"]

