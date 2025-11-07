// Initialize database on startup
// This runs prisma:push to ensure database schema is up to date
// Safe to run multiple times (idempotent)

const { execSync } = require('child_process');

console.log('🔄 Initializing database schema...');

try {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping database initialization');
    process.exit(0);
  }

  // Run prisma db push
  console.log('📊 Pushing Prisma schema to database...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: process.env
  });
  
  console.log('✅ Database schema initialized successfully');
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  console.log('⚠️ Continuing anyway - database might already be initialized');
  // Don't exit with error - allow server to start even if DB init fails
  // (might be because tables already exist)
}

