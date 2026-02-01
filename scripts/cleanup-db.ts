import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDatabase() {
  const keepEmail = 'raheemrehman2005@gmail.com';
  
  console.log(`Cleaning database, keeping only account: ${keepEmail}`);
  
  try {
    // Find the user to keep
    const keepUser = await prisma.user.findUnique({
      where: { email: keepEmail },
      include: { business: true }
    });
    
    if (!keepUser) {
      console.log(`Warning: User with email ${keepEmail} not found!`);
    } else {
      console.log(`Found user to keep: ${keepUser.name} (${keepUser.email})`);
    }
    
    // Get IDs to exclude
    const keepUserId = keepUser?.id;
    const keepBusinessId = keepUser?.business?.id;
    
    // Delete in order to respect foreign key constraints
    
    // 1. Delete search history
    const deletedSearchHistory = await prisma.searchHistory.deleteMany({
      where: keepUserId ? { userId: { not: keepUserId } } : {}
    });
    console.log(`Deleted ${deletedSearchHistory.count} search history records`);
    
    // 2. Delete favorites
    const deletedFavorites = await prisma.favorite.deleteMany({
      where: keepUserId ? { userId: { not: keepUserId } } : {}
    });
    console.log(`Deleted ${deletedFavorites.count} favorites`);
    
    // 3. Delete reviews
    const deletedReviews = await prisma.review.deleteMany({
      where: keepUserId ? { userId: { not: keepUserId } } : {}
    });
    console.log(`Deleted ${deletedReviews.count} reviews`);
    
    // 4. Delete all messages (except those involving the kept user)
    const deletedMessages = await prisma.message.deleteMany({
      where: keepUserId ? {
        AND: [
          { senderId: { not: keepUserId } },
          { receiverId: { not: keepUserId } }
        ]
      } : {}
    });
    console.log(`Deleted ${deletedMessages.count} messages`);
    
    // 5. Delete service type maps for services not in kept business
    if (keepBusinessId) {
      const servicesToKeep = await prisma.service.findMany({
        where: { businessId: keepBusinessId },
        select: { id: true }
      });
      const keepServiceIds = servicesToKeep.map(s => s.id);
      
      const deletedServiceTypeMaps = await prisma.serviceTypeMap.deleteMany({
        where: { serviceId: { notIn: keepServiceIds } }
      });
      console.log(`Deleted ${deletedServiceTypeMaps.count} service type maps`);
      
      const deletedServiceDisabilities = await prisma.serviceDisability.deleteMany({
        where: { serviceId: { notIn: keepServiceIds } }
      });
      console.log(`Deleted ${deletedServiceDisabilities.count} service disabilities`);
    } else {
      await prisma.serviceTypeMap.deleteMany({});
      await prisma.serviceDisability.deleteMany({});
    }
    
    // 6. Delete business disabilities for other businesses
    if (keepBusinessId) {
      const deletedBusinessDisabilities = await prisma.businessDisability.deleteMany({
        where: { businessId: { not: keepBusinessId } }
      });
      console.log(`Deleted ${deletedBusinessDisabilities.count} business disabilities`);
    } else {
      await prisma.businessDisability.deleteMany({});
    }
    
    // 7. Delete all services (except those for kept business)
    const deletedServices = await prisma.service.deleteMany({
      where: keepBusinessId ? {
        businessId: { not: keepBusinessId }
      } : {}
    });
    console.log(`Deleted ${deletedServices.count} services`);
    
    // 8. Delete all businesses (except kept one)
    const deletedBusinesses = await prisma.business.deleteMany({
      where: keepBusinessId ? {
        id: { not: keepBusinessId }
      } : {}
    });
    console.log(`Deleted ${deletedBusinesses.count} businesses`);
    
    // 9. Delete all users (except kept one)
    const deletedUsers = await prisma.user.deleteMany({
      where: keepUserId ? {
        id: { not: keepUserId }
      } : {}
    });
    console.log(`Deleted ${deletedUsers.count} users`);
    
    // Show remaining data
    const remainingUsers = await prisma.user.count();
    const remainingBusinesses = await prisma.business.count();
    const remainingServices = await prisma.service.count();
    
    console.log('\n--- Remaining Data ---');
    console.log(`Users: ${remainingUsers}`);
    console.log(`Businesses: ${remainingBusinesses}`);
    console.log(`Services: ${remainingServices}`);
    
    console.log('\nDatabase cleanup complete!');
    
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
