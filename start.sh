#!/bin/sh
set -e

# --- wait for Postgres ---
until pg_isready -h traeta-postgres -U postgres -d traeta-db >/dev/null 2>&1; do
  echo "Waiting for Postgres..."
  sleep 2
done

cd /app
npx prisma migrate deploy --schema=libs/prisma/schema.prisma

case "$SERVICE_NAME" in
  "user-service")
    cd /app/user-service
    exec npm run start:dev
    ;;
  "master-service")
    cd /app/masterData-service
    exec npm run start:dev
    ;;
  *)
    exit 1
    ;;
esac
