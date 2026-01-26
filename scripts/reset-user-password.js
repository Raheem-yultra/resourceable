import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('\n❌ Usage: node scripts/reset-password.js <email> <new-password>');
    console.log('Example: node scripts/reset-password.js user@example.com MyNewPass123\n');
    process.exit(1);
  }

  try {
    console.log('\n🔍 Looking for user...');
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    if (!user) {
      console.log(`\n❌ User with email "${email}" not found\n`);
      process.exit(1);
    }

    console.log(`\n✅ Found user:`);
    console.log(`   Name: ${user.name || 'No name'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);

    // Hash new password
    console.log('\n🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    console.log('💾 Updating password in database...');
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword }
    });

    console.log('\n✅ SUCCESS! Password has been reset.');
    console.log(`\n📋 Login Credentials:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   New Password: ${newPassword}`);
    console.log(`\n🔗 Sign in at: http://localhost:3000/auth/signin\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
