#!/bin/bash

# PostgreSQL + Prisma Setup Script
# Automates database setup for Helvino

set -e

echo "🚀 Helvino PostgreSQL Setup"
echo "============================"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
cd "$(dirname "$0")"
docker compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is healthy
if ! docker compose ps | grep -q "healthy"; then
    echo "⚠️  PostgreSQL is starting... waiting a bit longer..."
    sleep 5
fi

echo "✅ PostgreSQL is running"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
cd apps/api
npx prisma generate

echo ""

# Run migrations
echo "📊 Running database migrations..."
npx prisma migrate dev --name init

echo ""

# Run seed
echo "🌱 Seeding database..."
npx pnpm db:seed

echo ""

# Run smoke test
echo "🧪 Running smoke test..."
npx pnpm db:smoke-test

echo ""
echo "============================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start API: cd apps/api && npx pnpm dev"
echo "  2. Test API: curl -H 'x-org-key: demo' http://localhost:4000/conversations"
echo "  3. View data: cd apps/api && npx pnpm db:studio"
echo ""
echo "Useful commands:"
echo "  - docker compose ps       # Check PostgreSQL status"
echo "  - docker compose logs -f  # View PostgreSQL logs"
echo "  - docker compose down     # Stop PostgreSQL"
echo ""
