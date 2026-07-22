const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Use direct connection for seeding (not pooler)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🌱 Starting database seed...');

  // First, ensure we have disabilities and service types
  console.log('📝 Creating disabilities...');
  const disabilities = await Promise.all([
    prisma.disability.upsert({
      where: { slug: 'autism' },
      update: {},
      create: {
        name: 'Autism Spectrum Disorder',
        slug: 'autism',
        description: 'Autism spectrum disorder (ASD) is a developmental disability caused by differences in the brain.',
        category: 'Developmental',
      },
    }),
    prisma.disability.upsert({
      where: { slug: 'adhd' },
      update: {},
      create: {
        name: 'ADHD',
        slug: 'adhd',
        description: 'Attention-deficit/hyperactivity disorder',
        category: 'Developmental',
      },
    }),
    prisma.disability.upsert({
      where: { slug: 'down-syndrome' },
      update: {},
      create: {
        name: 'Down Syndrome',
        slug: 'down-syndrome',
        description: 'A genetic chromosome disorder',
        category: 'Developmental',
      },
    }),
    prisma.disability.upsert({
      where: { slug: 'cerebral-palsy' },
      update: {},
      create: {
        name: 'Cerebral Palsy',
        slug: 'cerebral-palsy',
        description: 'A group of disorders affecting movement and posture',
        category: 'Physical',
      },
    }),
    prisma.disability.upsert({
      where: { slug: 'learning-disability' },
      update: {},
      create: {
        name: 'Learning Disability',
        slug: 'learning-disability',
        description: 'Difficulty in learning and using certain skills',
        category: 'Cognitive',
      },
    }),
  ]);

  console.log('📝 Creating service types...');
  const serviceTypes = await Promise.all([
    prisma.serviceType.upsert({
      where: { slug: 'therapy' },
      update: {},
      create: {
        name: 'Therapy Services',
        slug: 'therapy',
        description: 'Various therapeutic interventions',
        category: 'Clinical',
      },
    }),
    prisma.serviceType.upsert({
      where: { slug: 'education' },
      update: {},
      create: {
        name: 'Educational Programs',
        slug: 'education',
        description: 'Educational and tutoring services',
        category: 'Educational',
      },
    }),
    prisma.serviceType.upsert({
      where: { slug: 'day-program' },
      update: {},
      create: {
        name: 'Day Programs',
        slug: 'day-program',
        description: 'Day programs and activities',
        category: 'Support',
      },
    }),
    prisma.serviceType.upsert({
      where: { slug: 'respite-care' },
      update: {},
      create: {
        name: 'Respite Care',
        slug: 'respite-care',
        description: 'Temporary care services',
        category: 'Support',
      },
    }),
    prisma.serviceType.upsert({
      where: { slug: 'counseling' },
      update: {},
      create: {
        name: 'Counseling',
        slug: 'counseling',
        description: 'Mental health counseling services',
        category: 'Clinical',
      },
    }),
  ]);

  console.log('👥 Creating test business users and listings...');

  const listings = [
    {
      email: 'brightfutures@test.com',
      businessName: 'Bright Futures Therapy Center',
      businessType: 'Therapy Center',
      description: 'Comprehensive therapy services for children with developmental disabilities. Our experienced team provides individualized care in a welcoming environment. We specialize in ABA therapy, speech therapy, and occupational therapy.',
      phone: '(555) 123-4567',
      website: 'https://brightfutures.example.com',
      address: '123 Main Street',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      yearEstablished: 2015,
      serviceName: 'Applied Behavior Analysis (ABA) Therapy',
      serviceDescription: 'Evidence-based ABA therapy for children with autism. One-on-one sessions with certified therapists using positive reinforcement techniques.',
      priceMin: 75,
      priceMax: 125,
      disabilities: ['autism', 'adhd'],
      serviceTypes: ['therapy'],
      ageGroups: ['TODDLER', 'CHILD', 'TEEN'],
    },
    {
      email: 'hopehaven@test.com',
      businessName: 'Hope Haven Learning Center',
      businessType: 'Educational Facility',
      description: 'Specialized education programs designed for children with learning differences. Small class sizes, adaptive curriculum, and supportive environment. State-certified teachers with special education credentials.',
      phone: '(555) 234-5678',
      website: 'https://hopehaven.example.com',
      address: '456 Oak Avenue',
      city: 'San Diego',
      state: 'CA',
      zipCode: '92101',
      yearEstablished: 2010,
      serviceName: 'Special Education Program',
      serviceDescription: 'Individualized education programs (IEP) tailored to each child\'s needs. Focus on academic skills, social development, and life skills training.',
      priceMin: 1200,
      priceMax: 2000,
      disabilities: ['learning-disability', 'autism', 'adhd'],
      serviceTypes: ['education'],
      ageGroups: ['CHILD', 'TEEN'],
    },
    {
      email: 'caringhearts@test.com',
      businessName: 'Caring Hearts Respite Services',
      businessType: 'Respite Care Provider',
      description: 'Professional respite care for families of children with disabilities. Give yourself a break while your child enjoys supervised activities in a safe, fun environment. Licensed caregivers available 24/7.',
      phone: '(555) 345-6789',
      website: 'https://caringhearts.example.com',
      address: '789 Elm Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      yearEstablished: 2018,
      serviceName: 'In-Home Respite Care',
      serviceDescription: 'Flexible respite care in your home or our facility. Trained staff experienced in working with various disabilities. Available evenings and weekends.',
      priceMin: 30,
      priceMax: 60,
      disabilities: ['autism', 'down-syndrome', 'cerebral-palsy'],
      serviceTypes: ['respite-care'],
      ageGroups: ['TODDLER', 'CHILD', 'TEEN', 'ADULT'],
    },
    {
      email: 'sunrise@test.com',
      businessName: 'Sunrise Day Program',
      businessType: 'Day Program Center',
      description: 'Engaging day programs for adults with developmental disabilities. Activities include arts & crafts, music therapy, community outings, and vocational training. Transportation provided.',
      phone: '(555) 456-7890',
      website: 'https://sunrise.example.com',
      address: '321 Pine Road',
      city: 'Sacramento',
      state: 'CA',
      zipCode: '95814',
      yearEstablished: 2012,
      serviceName: 'Adult Day Program',
      serviceDescription: 'Structured daily activities promoting independence, social skills, and community integration. Meals included. Open Monday-Friday 8am-5pm.',
      priceMin: 85,
      priceMax: 120,
      disabilities: ['autism', 'down-syndrome', 'learning-disability'],
      serviceTypes: ['day-program'],
      ageGroups: ['ADULT'],
    },
    {
      email: 'speechworks@test.com',
      businessName: 'SpeechWorks Therapy',
      businessType: 'Speech Therapy Clinic',
      description: 'Specialized speech and language therapy for children and adults. Our certified speech-language pathologists use evidence-based techniques to improve communication skills.',
      phone: '(555) 567-8901',
      website: 'https://speechworks.example.com',
      address: '654 Cedar Lane',
      city: 'San Jose',
      state: 'CA',
      zipCode: '95110',
      yearEstablished: 2016,
      serviceName: 'Speech & Language Therapy',
      serviceDescription: 'Individual and group therapy sessions addressing articulation, language development, fluency, and social communication. Play-based therapy for young children.',
      priceMin: 95,
      priceMax: 150,
      disabilities: ['autism', 'cerebral-palsy', 'down-syndrome'],
      serviceTypes: ['therapy'],
      ageGroups: ['TODDLER', 'CHILD', 'TEEN'],
    },
    {
      email: 'activelife@test.com',
      businessName: 'Active Life Recreation Center',
      businessType: 'Recreation Center',
      description: 'Adaptive sports and recreational activities for individuals with physical disabilities. We believe everyone deserves to stay active and have fun! Programs include swimming, basketball, yoga, and more.',
      phone: '(555) 678-9012',
      website: 'https://activelife.example.com',
      address: '987 Maple Drive',
      city: 'Fresno',
      state: 'CA',
      zipCode: '93650',
      yearEstablished: 2014,
      serviceName: 'Adaptive Sports Program',
      serviceDescription: 'Weekly sports and fitness classes adapted for various abilities. Trained adaptive PE instructors. Equipment provided. All skill levels welcome!',
      priceMin: 25,
      priceMax: 45,
      disabilities: ['cerebral-palsy', 'autism'],
      serviceTypes: ['day-program'],
      ageGroups: ['CHILD', 'TEEN', 'ADULT'],
    },
    {
      email: 'familysupport@test.com',
      businessName: 'Family Support Counseling',
      businessType: 'Counseling Center',
      description: 'Family therapy and individual counseling for families affected by developmental disabilities. Our compassionate therapists help families navigate challenges and build resilience.',
      phone: '(555) 789-0123',
      website: 'https://familysupport.example.com',
      address: '147 Birch Avenue',
      city: 'Oakland',
      state: 'CA',
      zipCode: '94601',
      yearEstablished: 2019,
      serviceName: 'Family Therapy Sessions',
      serviceDescription: 'Support for parents, siblings, and the whole family unit. Address stress, communication, and adjustment issues. Insurance accepted.',
      priceMin: 100,
      priceMax: 180,
      disabilities: ['autism', 'adhd', 'learning-disability'],
      serviceTypes: ['counseling'],
      ageGroups: ['ALL_AGES'],
    },
    {
      email: 'earlystart@test.com',
      businessName: 'Early Start Intervention',
      businessType: 'Early Intervention Center',
      description: 'Early intervention services for infants and toddlers with developmental delays. The earlier we start, the better the outcomes! Our team includes physical therapists, occupational therapists, and developmental specialists.',
      phone: '(555) 890-1234',
      website: 'https://earlystart.example.com',
      address: '258 Willow Court',
      city: 'Long Beach',
      state: 'CA',
      zipCode: '90802',
      yearEstablished: 2017,
      serviceName: 'Early Intervention Program',
      serviceDescription: 'Comprehensive developmental assessments and therapy for children 0-3 years. Home-based and center-based options available. Accepts all major insurance.',
      priceMin: 0,
      priceMax: 50,
      disabilities: ['autism', 'down-syndrome', 'cerebral-palsy'],
      serviceTypes: ['therapy', 'education'],
      ageGroups: ['INFANT', 'TODDLER'],
    },
    {
      email: 'skillbuilders@test.com',
      businessName: 'Skill Builders Academy',
      businessType: 'Life Skills Training',
      description: 'Life skills training and vocational preparation for teens and adults with developmental disabilities. We focus on independence, employment readiness, and community living skills.',
      phone: '(555) 901-2345',
      website: 'https://skillbuilders.example.com',
      address: '369 Spruce Street',
      city: 'Riverside',
      state: 'CA',
      zipCode: '92501',
      yearEstablished: 2013,
      serviceName: 'Vocational Training Program',
      serviceDescription: 'Job coaching, resume building, interview skills, and workplace etiquette. Partner with local employers for job placement. Daily living skills instruction included.',
      priceMin: 150,
      priceMax: 250,
      disabilities: ['autism', 'learning-disability', 'down-syndrome'],
      serviceTypes: ['education', 'day-program'],
      ageGroups: ['TEEN', 'ADULT'],
    },
    {
      email: 'sensoryworld@test.com',
      businessName: 'Sensory World Therapy',
      businessType: 'Occupational Therapy Clinic',
      description: 'Sensory integration therapy and occupational therapy for children with sensory processing difficulties. Our specially designed sensory gym provides a safe space for exploration and growth.',
      phone: '(555) 012-3456',
      website: 'https://sensoryworld.example.com',
      address: '741 Redwood Boulevard',
      city: 'Santa Ana',
      state: 'CA',
      zipCode: '92701',
      yearEstablished: 2020,
      serviceName: 'Occupational Therapy',
      serviceDescription: 'Individual OT sessions focusing on fine motor skills, self-care, sensory regulation, and daily living activities. Fun, play-based approach in our state-of-the-art facility.',
      priceMin: 90,
      priceMax: 140,
      disabilities: ['autism', 'adhd', 'cerebral-palsy'],
      serviceTypes: ['therapy'],
      ageGroups: ['TODDLER', 'CHILD', 'TEEN'],
    },
    {
      email: 'musictherapy@test.com',
      businessName: 'Harmony Music Therapy',
      businessType: 'Music Therapy Center',
      description: 'Board-certified music therapists providing individualized sessions to improve communication, motor skills, and emotional expression. Music is a powerful tool for development and healing.',
      phone: '(555) 123-9876',
      website: 'https://harmonymusic.example.com',
      address: '852 Harmony Lane',
      city: 'Anaheim',
      state: 'CA',
      zipCode: '92805',
      yearEstablished: 2021,
      serviceName: 'Music Therapy Sessions',
      serviceDescription: 'Group and individual music therapy for all ages. No musical experience required! Activities include singing, playing instruments, movement to music, and songwriting.',
      priceMin: 60,
      priceMax: 100,
      disabilities: ['autism', 'down-syndrome', 'cerebral-palsy'],
      serviceTypes: ['therapy'],
      ageGroups: ['TODDLER', 'CHILD', 'TEEN', 'ADULT'],
    },
    {
      email: 'inclusion@test.com',
      businessName: 'Inclusion Academy',
      businessType: 'Inclusive School',
      description: 'Fully inclusive educational environment where children of all abilities learn together. Our innovative approach combines special education expertise with general education curriculum.',
      phone: '(555) 234-8765',
      website: 'https://inclusionacademy.example.com',
      address: '963 Unity Drive',
      city: 'Bakersfield',
      state: 'CA',
      zipCode: '93301',
      yearEstablished: 2011,
      serviceName: 'Inclusive Education Program',
      serviceDescription: 'K-8 education with built-in supports. Small class sizes, co-teaching model, and evidence-based interventions. Fosters friendships and social understanding.',
      priceMin: 1500,
      priceMax: 2500,
      disabilities: ['autism', 'adhd', 'learning-disability', 'down-syndrome'],
      serviceTypes: ['education'],
      ageGroups: ['CHILD', 'TEEN'],
    },
  ];

  for (const listing of listings) {
    console.log(`\n📦 Creating listing: ${listing.businessName}`);
    
    // Create user
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user = await prisma.user.create({
      data: {
        email: listing.email,
        password: hashedPassword,
        name: listing.businessName + ' Admin',
        role: 'BUSINESS',
      },
    });
    console.log(`  ✓ User created: ${user.email}`);

    // Create business
    const business = await prisma.business.create({
      data: {
        userId: user.id,
        businessName: listing.businessName,
        businessType: listing.businessType,
        description: listing.description,
        phone: listing.phone,
        email: listing.email,
        website: listing.website,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        yearEstablished: listing.yearEstablished,
        verificationStatus: 'APPROVED', // Auto-approve for testing
        verifiedAt: new Date(),
        isActive: true,
        averageRating: 4.0 + Math.random() * 1, // Random rating 4.0-5.0
        totalReviews: Math.floor(Math.random() * 50) + 5, // Random 5-55 reviews
      },
    });
    console.log(`  ✓ Business created: ${business.businessName}`);

    // Add business disabilities
    for (const disabilitySlug of listing.disabilities) {
      const disability = disabilities.find(d => d.slug === disabilitySlug);
      if (disability) {
        await prisma.businessDisability.create({
          data: {
            businessId: business.id,
            disabilityId: disability.id,
            isPrimary: listing.disabilities[0] === disabilitySlug,
          },
        });
      }
    }
    console.log(`  ✓ Added ${listing.disabilities.length} disabilities`);

    // Create service
    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        name: listing.serviceName,
        slug: listing.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: listing.serviceDescription,
        shortDescription: listing.serviceDescription.substring(0, 150) + '...',
        priceRange: listing.priceMin === 0 ? 'FREE' : listing.priceMax < 50 ? 'LOW' : listing.priceMax < 150 ? 'MEDIUM' : listing.priceMax < 300 ? 'HIGH' : 'PREMIUM',
        priceMin: listing.priceMin,
        priceMax: listing.priceMax,
        ageGroups: listing.ageGroups,
        insuranceAccepted: Math.random() > 0.5,
        insuranceProviders: Math.random() > 0.5 ? ['Blue Cross', 'Aetna', 'United Healthcare'] : [],
        languages: ['English', 'Spanish'],
        isActive: true,
        isAvailable: true,
      },
    });
    console.log(`  ✓ Service created: ${service.name}`);

    // Add service types
    for (const serviceTypeSlug of listing.serviceTypes) {
      const serviceType = serviceTypes.find(st => st.slug === serviceTypeSlug);
      if (serviceType) {
        await prisma.serviceTypeMap.create({
          data: {
            serviceId: service.id,
            serviceTypeId: serviceType.id,
            isPrimary: listing.serviceTypes[0] === serviceTypeSlug,
          },
        });
      }
    }
    console.log(`  ✓ Added ${listing.serviceTypes.length} service types`);

    // Add service disabilities
    for (const disabilitySlug of listing.disabilities) {
      const disability = disabilities.find(d => d.slug === disabilitySlug);
      if (disability) {
        await prisma.serviceDisability.create({
          data: {
            serviceId: service.id,
            disabilityId: disability.id,
            isPrimary: listing.disabilities[0] === disabilitySlug,
          },
        });
      }
    }
    console.log(`  ✓ Service-disability mappings created`);
  }

  console.log('\n✅ Seed completed successfully!');
  console.log(`📊 Summary:`);
  console.log(`   - ${listings.length} businesses created`);
  console.log(`   - ${listings.length} services created`);
  console.log(`   - ${disabilities.length} disabilities`);
  console.log(`   - ${serviceTypes.length} service types`);
  console.log(`\n🔑 Test Login Credentials (any of these):`);
  console.log(`   Email: brightfutures@test.com`);
  console.log(`   Email: hopehaven@test.com`);
  console.log(`   Email: caringhearts@test.com`);
  console.log(`   Password: Password123!`);
  console.log(`\n   (All test accounts use the same password)`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
