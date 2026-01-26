import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        business: {
          select: {
            id: true,
            businessName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('\n📋 All Users in Database:\n');
    console.log('='.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name || 'No Name'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
      if (user.business) {
        console.log(`   Business: ${user.business.businessName} (ID: ${user.business.id})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\nTotal Users: ${users.length}\n`);

  } catch (error) {
    console.error('❌ Error fetching users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
