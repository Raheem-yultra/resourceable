const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const disabilities = [
  { name: 'Autism Spectrum Disorder', slug: 'autism-spectrum-disorder' },
  { name: 'ADHD', slug: 'adhd' },
  { name: 'Down Syndrome', slug: 'down-syndrome' },
  { name: 'Cerebral Palsy', slug: 'cerebral-palsy' },
  { name: 'Dyslexia', slug: 'dyslexia' },
  { name: 'Intellectual Disability', slug: 'intellectual-disability' },
  { name: 'Speech/Language Disorder', slug: 'speech-language-disorder' },
  { name: 'Visual Impairment', slug: 'visual-impairment' },
  { name: 'Hearing Impairment', slug: 'hearing-impairment' },
  { name: 'Anxiety Disorder', slug: 'anxiety-disorder' },
  { name: 'Depression', slug: 'depression' },
  { name: 'Bipolar Disorder', slug: 'bipolar-disorder' },
  { name: 'Traumatic Brain Injury', slug: 'traumatic-brain-injury' },
  { name: 'Epilepsy', slug: 'epilepsy' },
  { name: 'Multiple Sclerosis', slug: 'multiple-sclerosis' },
  { name: 'Spina Bifida', slug: 'spina-bifida' },
  { name: 'Muscular Dystrophy', slug: 'muscular-dystrophy' },
  { name: 'Other', slug: 'other' },
];

const serviceTypes = [
  { name: 'Speech Therapy', slug: 'speech-therapy', category: 'Therapy' },
  { name: 'Occupational Therapy', slug: 'occupational-therapy', category: 'Therapy' },
  { name: 'Physical Therapy', slug: 'physical-therapy', category: 'Therapy' },
  { name: 'Applied Behavior Analysis (ABA)', slug: 'aba-therapy', category: 'Therapy' },
  { name: 'Behavioral Therapy', slug: 'behavioral-therapy', category: 'Therapy' },
  { name: 'Music Therapy', slug: 'music-therapy', category: 'Therapy' },
  { name: 'Art Therapy', slug: 'art-therapy', category: 'Therapy' },
  { name: 'Counseling', slug: 'counseling', category: 'Mental Health' },
  { name: 'Psychological Assessment', slug: 'psychological-assessment', category: 'Mental Health' },
  { name: 'Tutoring', slug: 'tutoring', category: 'Education' },
  { name: 'Special Education', slug: 'special-education', category: 'Education' },
  { name: 'Life Skills Training', slug: 'life-skills-training', category: 'Education' },
  { name: 'Respite Care', slug: 'respite-care', category: 'Support' },
  { name: 'In-Home Care', slug: 'in-home-care', category: 'Support' },
  { name: 'Day Programs', slug: 'day-programs', category: 'Support' },
  { name: 'Transportation', slug: 'transportation', category: 'Support' },
  { name: 'Social Skills Groups', slug: 'social-skills-groups', category: 'Social' },
  { name: 'Recreation Programs', slug: 'recreation-programs', category: 'Social' },
  { name: 'Employment Services', slug: 'employment-services', category: 'Vocational' },
  { name: 'Job Coaching', slug: 'job-coaching', category: 'Vocational' },
];

async function main() {
  console.log('Starting to seed disabilities and service types...');

  // Seed disabilities
  console.log('Seeding disabilities...');
  for (const disability of disabilities) {
    await prisma.disability.upsert({
      where: { slug: disability.slug },
      update: {},
      create: disability,
    });
  }
  console.log(`✅ Created ${disabilities.length} disabilities`);

  // Seed service types
  console.log('Seeding service types...');
  for (const serviceType of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { slug: serviceType.slug },
      update: {},
      create: {
        ...serviceType,
        isActive: true,
        displayOrder: 0,
      },
    });
  }
  console.log(`✅ Created ${serviceTypes.length} service types`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
