// Seeds the category-expansion taxonomy: one ServiceType row per subcategory
// (plan §2.2), tagged with its listingType. Idempotent — upserts by slug, so
// re-running only fills gaps / updates labels. Run: `npm run seed:categories`.
//
// Loads .env.local manually (the app's env; Prisma CLI otherwise reads .env).
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const envText = readFileSync('.env.local', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  let val = m[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!(m[1] in process.env)) process.env[m[1]] = val;
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Kept in sync with lib/listing-taxonomy.ts (this is a .mjs seed, so duplicated
// rather than imported to avoid a TS build step).
const CATEGORIES = [
  { type: 'SERVICE', label: 'Services', subs: ['Barber', 'Dentist', 'General Practitioner', 'Optometrist', 'Salon / Grooming', 'Pediatrician', 'Nutritionist', 'Home Health Aide'] },
  { type: 'THERAPY', label: 'Therapies', subs: ['Speech Therapy', 'Occupational Therapy', 'ABA Therapy', 'Physical Therapy', 'Behavioral / Counseling', 'Music Therapy', 'Art Therapy', 'Feeding Therapy'] },
  { type: 'SHOP', label: 'Shop', subs: ['Mobility Aids', 'Sensory Tools', 'Communication Devices (AAC)', 'Adaptive Clothing', 'Adaptive Furniture', 'Safety Equipment', 'Toys & Learning Aids'] },
  { type: 'SCHOOL', label: 'School', subs: ['Special Education Schools', 'Inclusive / Mainstream Programs', 'Tutoring & Learning Support', 'Transition / Life Skills Programs', 'Vocational Training', 'Early Intervention Programs'] },
  { type: 'EVENT', label: 'Events', subs: ['Support Groups', 'Workshops / Training', 'Camps', 'Fundraisers', 'Social / Recreational Meetups', 'IEP / Advocacy Clinics'] },
];

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

let created = 0;
let updated = 0;
try {
  for (const cat of CATEGORIES) {
    let order = 0;
    for (const sub of cat.subs) {
      const displayOrder = order++;
      // Match by name first (name is @unique) so we adopt any pre-existing generic
      // service type into a category rather than colliding on the unique name.
      const existing = await prisma.serviceType.findUnique({ where: { name: sub } });
      if (existing) {
        await prisma.serviceType.update({
          where: { name: sub },
          data: { category: cat.label, listingType: cat.type, isActive: true },
        });
        updated++;
        continue;
      }
      // New row: ensure the slug is free, else disambiguate.
      let slug = slugify(`${cat.type}-${sub}`);
      if (await prisma.serviceType.findUnique({ where: { slug } })) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      }
      await prisma.serviceType.create({
        data: { name: sub, slug, category: cat.label, listingType: cat.type, displayOrder, isActive: true },
      });
      created++;
      console.log(`+ ${cat.label} › ${sub}`);
    }
  }
  console.log(`\nDONE — ${created} created, ${updated} updated.`);
} finally {
  await prisma.$disconnect();
}
