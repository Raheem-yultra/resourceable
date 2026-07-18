const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch (error) {
  // Continue even if env loader is unavailable
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Missing database connection string.');
  console.error('Set DIRECT_URL or DATABASE_URL in your .env file, then rerun this script.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

const TOTAL_ACCOUNTS = 20;
const DEFAULT_PASSWORD = 'FakeDemo123!';

const fakeCities = [
  { city: 'Pretendville', state: 'CA', zipCode: '90011' },
  { city: 'Mocktown', state: 'TX', zipCode: '75001' },
  { city: 'Placeholder City', state: 'FL', zipCode: '33101' },
  { city: 'Demo Heights', state: 'WA', zipCode: '98101' },
  { city: 'Testburg', state: 'NY', zipCode: '10001' },
];

const fakeBusinessTypes = [
  'Demo Therapy Center',
  'Sample Support Agency',
  'Placeholder Counseling Hub',
  'Mock Adaptive Program',
  'Testing Wellness Office',
];

const fakeServiceNames = [
  'FAKE Service Package Alpha',
  'FAKE Service Package Beta',
  'FAKE Service Package Gamma',
  'FAKE Service Package Delta',
  'FAKE Service Package Omega',
];

function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureReferenceData() {
  const defaultDisabilities = [
    { slug: 'autism', name: 'Autism Spectrum Disorder', category: 'Developmental' },
    { slug: 'adhd', name: 'ADHD', category: 'Developmental' },
    { slug: 'learning-disability', name: 'Learning Disability', category: 'Cognitive' },
  ];

  const defaultServiceTypes = [
    { slug: 'therapy', name: 'Therapy Services', category: 'Clinical' },
    { slug: 'education', name: 'Educational Programs', category: 'Educational' },
    { slug: 'counseling', name: 'Counseling', category: 'Clinical' },
  ];

  for (const item of defaultDisabilities) {
    const existing = await prisma.disability.findFirst({
      where: {
        OR: [{ slug: item.slug }, { name: item.name }],
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.disability.create({
        data: {
          slug: item.slug,
          name: item.name,
          category: item.category,
          description: `Reference entry for ${item.name}`,
        },
      });
    }
  }

  for (const item of defaultServiceTypes) {
    const existing = await prisma.serviceType.findFirst({
      where: {
        OR: [{ slug: item.slug }, { name: item.name }],
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.serviceType.create({
        data: {
          slug: item.slug,
          name: item.name,
          category: item.category,
          description: `Reference entry for ${item.name}`,
        },
      });
    }
  }

  const disabilities = await prisma.disability.findMany({
    where: { slug: { in: defaultDisabilities.map((d) => d.slug) } },
    select: { id: true, slug: true },
  });

  const serviceTypes = await prisma.serviceType.findMany({
    where: { slug: { in: defaultServiceTypes.map((s) => s.slug) } },
    select: { id: true, slug: true },
  });

  return { disabilities, serviceTypes };
}

async function main() {
  console.log('🌱 Seeding 20 FAKE demo accounts with fake services...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const { disabilities, serviceTypes } = await ensureReferenceData();

  for (let index = 1; index <= TOTAL_ACCOUNTS; index++) {
    const location = fakeCities[(index - 1) % fakeCities.length];
    const businessType = fakeBusinessTypes[(index - 1) % fakeBusinessTypes.length];
    const serviceName = fakeServiceNames[(index - 1) % fakeServiceNames.length];

    const label = String(index).padStart(2, '0');
    const email = `fake.biz.${label}@example.test`;
    const businessName = `FAKE Demo Business ${label}`;
    const serviceSlug = slugify(`fake-demo-service-${label}`);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: `${businessName} Owner`,
        password: passwordHash,
        role: 'BUSINESS',
        isActive: true,
        // Sign-in requires a verified email — without this, demo accounts can't log in.
        emailVerified: new Date(),
      },
      create: {
        email,
        name: `${businessName} Owner`,
        password: passwordHash,
        role: 'BUSINESS',
        phone: `555-000-${label}`,
        isActive: true,
        emailVerified: new Date(),
      },
    });

    const business = await prisma.business.upsert({
      where: { userId: user.id },
      update: {
        businessName,
        businessType,
        description: `FAKE DEMO DATA ONLY. This business profile is intentionally fictional for test purposes.`,
        phone: `555-100-${label}`,
        email,
        website: `https://fake-demo-${label}.example.test`,
        address: `${100 + index} Placeholder Avenue`,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        verificationStatus: 'APPROVED',
        isActive: true,
      },
      create: {
        userId: user.id,
        businessName,
        businessType,
        description: `FAKE DEMO DATA ONLY. This business profile is intentionally fictional for test purposes.`,
        phone: `555-100-${label}`,
        email,
        website: `https://fake-demo-${label}.example.test`,
        address: `${100 + index} Placeholder Avenue`,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        isActive: true,
      },
    });

    await prisma.businessDisability.deleteMany({ where: { businessId: business.id } });
    await prisma.businessDisability.createMany({
      data: disabilities.map((d, position) => ({
        businessId: business.id,
        disabilityId: d.id,
        isPrimary: position === 0,
      })),
      skipDuplicates: true,
    });

    const service = await prisma.service.upsert({
      where: {
        businessId_slug: {
          businessId: business.id,
          slug: serviceSlug,
        },
      },
      update: {
        name: `${serviceName} ${label}`,
        description: `FAKE SERVICE ENTRY ${label}. Not a real provider or real offering. Used only for UI/demo testing.`,
        shortDescription: `FAKE SERVICE ${label} for demo/testing only.`,
        priceRange: 'LOW',
        priceMin: 10,
        priceMax: 25,
        ageGroups: ['CHILD', 'TEEN'],
        insuranceAccepted: false,
        insuranceProviders: [],
        languages: ['English'],
        isActive: true,
        isAvailable: true,
      },
      create: {
        businessId: business.id,
        slug: serviceSlug,
        name: `${serviceName} ${label}`,
        description: `FAKE SERVICE ENTRY ${label}. Not a real provider or real offering. Used only for UI/demo testing.`,
        shortDescription: `FAKE SERVICE ${label} for demo/testing only.`,
        priceRange: 'LOW',
        priceMin: 10,
        priceMax: 25,
        ageGroups: ['CHILD', 'TEEN'],
        insuranceAccepted: false,
        insuranceProviders: [],
        languages: ['English'],
        isActive: true,
        isAvailable: true,
      },
    });

    await prisma.serviceDisability.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceDisability.createMany({
      data: disabilities.map((d, position) => ({
        serviceId: service.id,
        disabilityId: d.id,
        isPrimary: position === 0,
      })),
      skipDuplicates: true,
    });

    await prisma.serviceTypeMap.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceTypeMap.createMany({
      data: serviceTypes.map((s, position) => ({
        serviceId: service.id,
        serviceTypeId: s.id,
        isPrimary: position === 0,
      })),
      skipDuplicates: true,
    });

    console.log(`✅ Seeded fake account ${label}: ${email}`);
  }

  const createdUsers = await prisma.user.count({
    where: { email: { endsWith: '@example.test' } },
  });

  const createdBusinesses = await prisma.business.count({
    where: { businessName: { startsWith: 'FAKE Demo Business' } },
  });

  const createdServices = await prisma.service.count({
    where: { name: { contains: 'FAKE Service Package' } },
  });

  console.log('\n🎉 Fake seed complete.');
  console.log(`Users with @example.test: ${createdUsers}`);
  console.log(`FAKE businesses: ${createdBusinesses}`);
  console.log(`FAKE services: ${createdServices}`);
  console.log(`Default password for these fake accounts: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed fake accounts:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
