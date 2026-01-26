# How to Sign In as Admin

There are 3 ways to create an admin account:

## Option 1: Using the make-admin script (Recommended)

1. Open `scripts/make-admin.ts`
2. Change the `EMAIL` constant to your email address
3. Run the command:
   ```bash
   npx ts-node scripts/make-admin.ts
   ```

## Option 2: Using Prisma Studio (Visual Interface)

1. Make sure your dev server is stopped
2. Run: `npx prisma studio`
3. This will open a browser at http://localhost:5555
4. Click on "User" table
5. Find your user and click to edit
6. Change the `role` field from `USER` or `BUSINESS` to `ADMIN`
7. Click "Save 1 change"
8. Sign in normally - you'll now have admin access

## Option 3: Direct Database SQL (Supabase Dashboard)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on your project
3. Go to "SQL Editor" in the left sidebar
4. Run this SQL query (replace YOUR_EMAIL with your actual email):

```sql
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'your-email@example.com';
```

5. Click "Run"
6. You can verify it worked by running:

```sql
SELECT id, name, email, role 
FROM "User" 
WHERE email = 'your-email@example.com';
```

## After Setting Admin Role

1. Sign out if you're currently signed in
2. Sign in again with your email/password
3. You'll now see the "Admin" link in the navbar
4. Access the admin dashboard at: http://localhost:3000/admin

The admin dashboard allows you to:
- View pending business verifications
- Approve or reject business applications
- Add admin notes and rejection reasons
- Filter businesses by verification status
