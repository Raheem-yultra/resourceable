# Database Setup Guide for ResourceAble

Your schema requires PostgreSQL. You have two options:

## Option 1: Free Cloud Database with Supabase (RECOMMENDED - 5 minutes)

1. **Create a free account**: https://supabase.com/
2. **Create a new project** (it takes ~2 minutes to provision)
3. **Get your connection string**:
   - Go to Project Settings → Database
   - Look for "Connection string" → "URI"
   - Copy the connection string
4. **Update your `.env` file**:
   ```
   DATABASE_URL="your-connection-string-from-supabase"
   ```
5. **Run migrations**:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
6. **Restart your dev server**

## Option 2: Local PostgreSQL Installation

### Windows:
1. **Download PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Install with these settings**:
   - Password: `password` (or update `.env` with your chosen password)
   - Port: `5432`
   - Locale: Default
3. **Create database**:
   ```bash
   # Open Command Prompt as Administrator
   psql -U postgres
   CREATE DATABASE special_needs_services;
   \q
   ```
4. **Run migrations**:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

### macOS (using Homebrew):
```bash
brew install postgresql@16
brew services start postgresql@16
createdb special_needs_services
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb special_needs_services
```

## After Database Setup

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Restart your Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **Test business signup** - Should work now!

## Current Error

The "Internal server error" during business signup is because:
- ✅ Your code is correct
- ❌ Database is not connected
- Need to run `npx prisma migrate dev` after database is set up

## Verification

After setup, verify the database connection:
```bash
npx prisma db push
```

This should show: "Your database is now in sync with your schema."
