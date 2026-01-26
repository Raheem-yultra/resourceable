# Quick Start Guide

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string
   - Generate a secret: `openssl rand -base64 32`
   - Update `NEXTAUTH_SECRET` in `.env`

3. **Setup Database**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Open Application**
   - Navigate to http://localhost:3000

## First Steps

### Create Admin User (via Prisma Studio)
```bash
npx prisma studio
```
1. Open User table
2. Create a new user with:
   - email: admin@example.com
   - password: (hash using bcrypt - see below)
   - role: ADMIN

### Generate Password Hash (Node.js)
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your-password', 10);
console.log(hash);
```

Or use this one-liner in terminal:
```bash
node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"
```

### Create Test Business

1. Sign up as a BUSINESS user at http://localhost:3000/auth/signup
2. Login with business credentials
3. Complete business profile
4. Add services

### Approve Business (as Admin)

1. Login as admin
2. Navigate to http://localhost:3000/admin
3. Approve pending businesses

## Testing the Application

### Test User Flow
1. Browse services without account at http://localhost:3000/search
2. Sign up as USER
3. Search for services
4. Click on a service to view business profile
5. Send message to business

### Test Business Flow
1. Sign up as BUSINESS
2. Complete business profile
3. Add services
4. Wait for admin approval (or approve yourself if you're admin)
5. Receive messages from users

### Test Admin Flow
1. Login as ADMIN
2. View pending business verifications
3. Approve or reject businesses

## Common Issues

### Database Connection Error
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env
- Check database exists: `CREATE DATABASE special_needs_services;`

### Prisma Client Error
- Run `npx prisma generate` after any schema changes
- Clear .next folder: `rm -rf .next` (or `Remove-Item -Recurse -Force .next` on Windows)

### NextAuth Error
- Verify NEXTAUTH_SECRET is set
- Ensure NEXTAUTH_URL matches your dev URL

## Project Structure Overview

```
/app                    # Next.js pages and API routes
  /api                 # API endpoints
  /search              # Search page
  /business            # Business profiles
  /messages            # Chat pages
  /admin               # Admin dashboard
/components            # React components
  /ui                 # Base UI components
  /search             # Search-specific
  /business           # Business-specific
  /chat               # Chat interface
  /admin              # Admin components
/services             # Business logic (service layer)
/lib                  # Utilities and configs
/prisma               # Database schema and migrations
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open database GUI
- `npx prisma migrate dev` - Create and apply migration
- `npx prisma generate` - Generate Prisma Client

## Development Workflow

1. Make schema changes in `prisma/schema.prisma`
2. Run migration: `npx prisma migrate dev --name description`
3. Prisma Client auto-regenerates
4. Update service layer if needed
5. Update API routes if needed
6. Update components if needed
7. Test changes

## Deployment Checklist

- [ ] Set strong NEXTAUTH_SECRET
- [ ] Update NEXTAUTH_URL to production URL
- [ ] Configure production DATABASE_URL
- [ ] Run database migrations on production DB
- [ ] Set up environment variables on hosting platform
- [ ] Build and test: `npm run build && npm start`
- [ ] Set up PostgreSQL backup strategy

## Support

For issues, check:
1. Console logs in browser (F12)
2. Terminal output
3. Prisma Studio for database state
4. README.md for detailed documentation
