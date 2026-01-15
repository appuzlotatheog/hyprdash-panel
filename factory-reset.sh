#!/bin/bash
echo "⚠️  WARNING: This will delete the database (dev.db) and all logs!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo "Deleting database..."
rm -f prisma/dev.db

echo "Clearing logs..."
rm -rf logs/*

echo "Deleting .env config..."
rm -f .env

echo "✅ Panel reset complete."
echo "👉 Run 'npm run db:push' to create a fresh database."
echo "👉 Run 'npm run db:seed' to create the default admin account."
