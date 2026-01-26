const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function test() {
  try {
    console.log('Testing database connection...');
    const count = await prisma.user.count();
    console.log(`✅ Connection successful! Found ${count} users in database.`);
    
    const disabilities = await prisma.disability.findMany();
    console.log(`✅ Found ${disabilities.length} disabilities`);
    
    const serviceTypes = await prisma.serviceType.findMany();
    console.log(`✅ Found ${serviceTypes.length} service types`);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
