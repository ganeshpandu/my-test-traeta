FROM node:22.11.0-alpine

WORKDIR /app

COPY . .

RUN chmod +x /app/start.sh

RUN apk add --no-cache postgresql-client bash openssl

RUN cd user-service && npm install --legacy-peer-deps && npm run prisma:generate && npm run build

RUN cd masterData-service && npm install --legacy-peer-deps && npm run prisma:generate && npm run build

EXPOSE 3001 3002

CMD ["sh", "-c", "/app/start.sh"]
