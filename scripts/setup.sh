#!/usr/bin/env bash
# Bootstrap script for new contributors
# Usage: npm run setup

set -e

echo ""
echo "========================================="
echo "  Poligraph — Setup local dev environment"
echo "========================================="
echo ""

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example..."
  cp .env.example .env

  # Auto-configure for Docker Compose PostgreSQL
  if command -v docker &> /dev/null; then
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/poligraph"|' .env
    sed -i 's|^DIRECT_URL=.*|DIRECT_URL="postgresql://postgres:postgres@localhost:5432/poligraph"|' .env
    echo "   ✓ Configured for local Docker PostgreSQL"
  else
    echo "   ⚠ Docker not found. Edit .env manually with your PostgreSQL URL."
  fi
else
  echo "📝 .env already exists, skipping..."
fi

# 3. Start Docker PostgreSQL if available
if command -v docker &> /dev/null; then
  echo "🐘 Starting PostgreSQL (Docker Compose)..."
  docker compose up -d --wait 2>/dev/null || docker-compose up -d 2>/dev/null || {
    echo "   ⚠ Could not start Docker. Make sure Docker is running."
    echo "   You can start it manually: docker compose up -d"
  }
else
  echo "⚠ Docker not found. Make sure PostgreSQL is running and DATABASE_URL is set in .env"
fi

# 4. Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate

# 5. Push schema to database
echo "🗄️  Pushing schema to database..."
npx prisma db push --skip-generate

# 6. Seed fixtures
echo "🌱 Seeding fixture data..."
npx dotenv -e .env -- npx tsx scripts/seed-fixtures.ts --force

echo ""
echo "========================================="
echo "  ✅ Setup complete!"
echo "========================================="
echo ""
echo "  Start the dev server:  npm run dev"
echo "  Open in browser:       http://localhost:3000"
echo "  Admin dashboard:       http://localhost:3000/admin"
echo "  Prisma Studio:         npm run db:studio"
echo ""
echo "  Default admin password: your-secure-admin-password"
echo "  (change ADMIN_PASSWORD in .env)"
echo ""
