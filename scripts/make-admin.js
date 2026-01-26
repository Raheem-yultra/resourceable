/**
 * Script to promote a user to ADMIN role
 * 
 * Usage: 
 * 1. Update the EMAIL constant below with the email of the user you want to make admin
 * 2. Run: node scripts/make-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAIL = 'raheemrehman2005@gmail.com'; // Your email address

async function makeAdmin() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: EMAIL },
    });

    if (!user) {
      console.error(`❌ User not found with email: ${EMAIL}`);
      console.log('Please make sure the email is correct and the user has signed up.');
      return;
    }

    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Current role: ${user.role}`);

    if (user.role === 'ADMIN') {
      console.log('✅ User is already an ADMIN');
      return;
    }

    // Update user role to ADMIN
    const updatedUser = await prisma.user.update({
      where: { email: EMAIL },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ Successfully promoted ${updatedUser.name} to ADMIN!`);
    console.log(`You can now sign in with this account and access /admin`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
