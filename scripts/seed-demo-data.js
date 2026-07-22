// Stakeholder demo seed: realistic-looking (but fictional) providers covering
// EVERY listing type and subcategory, with multi-listing businesses, varied
// verification tiers, active subscriptions, and real review rows that drive the
// rating aggregates. Idempotent — upserts by email / (businessId, slug) and
// rebuilds mappings + reviews on each run.
//
// All login accounts use @example.test so the production cleanup documented in
// DEPLOYMENT.md (`DELETE FROM "User" WHERE email LIKE '%@example.test';`)
// removes everything this script creates. Display emails/websites on business
// cards use *.example.com so cards look real in the UI while staying fictional.
//
// Run: `npm run seed:demo`
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
  console.error('Missing DIRECT_URL / DATABASE_URL — set one in .env.local and rerun.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const DEFAULT_PASSWORD = 'FakeDemo123!';

// ---------------------------------------------------------------------------
// Deterministic PRNG so reruns produce stable data (ratings, dates, counts).
// ---------------------------------------------------------------------------
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngFor = (key) => mulberry32(hashString(key));
const pickInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const CITIES = {
  la: { city: 'Los Angeles', state: 'CA', zipCode: '90012', lat: 34.054, lng: -118.243 },
  sd: { city: 'San Diego', state: 'CA', zipCode: '92101', lat: 32.716, lng: -117.161 },
  sj: { city: 'San Jose', state: 'CA', zipCode: '95112', lat: 37.348, lng: -121.885 },
  austin: { city: 'Austin', state: 'TX', zipCode: '78701', lat: 30.267, lng: -97.743 },
  dallas: { city: 'Dallas', state: 'TX', zipCode: '75201', lat: 32.781, lng: -96.797 },
  houston: { city: 'Houston', state: 'TX', zipCode: '77002', lat: 29.76, lng: -95.363 },
  miami: { city: 'Miami', state: 'FL', zipCode: '33130', lat: 25.766, lng: -80.2 },
  orlando: { city: 'Orlando', state: 'FL', zipCode: '32801', lat: 28.538, lng: -81.379 },
  nyc: { city: 'New York', state: 'NY', zipCode: '10001', lat: 40.75, lng: -73.997 },
  brooklyn: { city: 'Brooklyn', state: 'NY', zipCode: '11201', lat: 40.694, lng: -73.99 },
  chicago: { city: 'Chicago', state: 'IL', zipCode: '60601', lat: 41.885, lng: -87.622 },
  seattle: { city: 'Seattle', state: 'WA', zipCode: '98101', lat: 47.61, lng: -122.334 },
  denver: { city: 'Denver', state: 'CO', zipCode: '80202', lat: 39.749, lng: -104.995 },
  phoenix: { city: 'Phoenix', state: 'AZ', zipCode: '85004', lat: 33.451, lng: -112.07 },
  atlanta: { city: 'Atlanta', state: 'GA', zipCode: '30303', lat: 33.753, lng: -84.39 },
};

const DISABILITIES = [
  { slug: 'autism', name: 'Autism Spectrum Disorder', category: 'Developmental' },
  { slug: 'adhd', name: 'ADHD', category: 'Developmental' },
  { slug: 'down-syndrome', name: 'Down Syndrome', category: 'Developmental' },
  { slug: 'cerebral-palsy', name: 'Cerebral Palsy', category: 'Physical' },
  { slug: 'learning-disability', name: 'Learning Disability', category: 'Cognitive' },
  { slug: 'speech-language-disorder', name: 'Speech & Language Disorder', category: 'Communication' },
  { slug: 'sensory-processing-disorder', name: 'Sensory Processing Disorder', category: 'Sensory' },
  { slug: 'intellectual-disability', name: 'Intellectual Disability', category: 'Cognitive' },
  { slug: 'hearing-impairment', name: 'Hearing Impairment', category: 'Sensory' },
  { slug: 'visual-impairment', name: 'Visual Impairment', category: 'Sensory' },
];

// Mirrors lib/listing-taxonomy.ts / scripts/seed-categories.mjs — used to
// resolve (and backfill if missing) the subcategory ServiceType rows.
const TAXONOMY = [
  { type: 'SERVICE', label: 'Services', subs: ['Barber', 'Dentist', 'General Practitioner', 'Optometrist', 'Salon / Grooming', 'Pediatrician', 'Nutritionist', 'Home Health Aide'] },
  { type: 'THERAPY', label: 'Therapies', subs: ['Speech Therapy', 'Occupational Therapy', 'ABA Therapy', 'Physical Therapy', 'Behavioral / Counseling', 'Music Therapy', 'Art Therapy', 'Feeding Therapy'] },
  { type: 'SHOP', label: 'Shop', subs: ['Mobility Aids', 'Sensory Tools', 'Communication Devices (AAC)', 'Adaptive Clothing', 'Adaptive Furniture', 'Safety Equipment', 'Toys & Learning Aids'] },
  { type: 'SCHOOL', label: 'School', subs: ['Special Education Schools', 'Inclusive / Mainstream Programs', 'Tutoring & Learning Support', 'Transition / Life Skills Programs', 'Vocational Training', 'Early Intervention Programs'] },
  { type: 'EVENT', label: 'Events', subs: ['Support Groups', 'Workshops / Training', 'Camps', 'Fundraisers', 'Social / Recreational Meetups', 'IEP / Advocacy Clinics'] },
];

const FAMILIES = [
  { email: 'demo.family.01@example.test', name: 'Maria Gonzalez' },
  { email: 'demo.family.02@example.test', name: 'James Carter' },
  { email: 'demo.family.03@example.test', name: 'Aisha Thompson' },
  { email: 'demo.family.04@example.test', name: 'David Kim' },
  { email: 'demo.family.05@example.test', name: 'Rachel Nguyen' },
  { email: 'demo.family.06@example.test', name: 'Sam Patel' },
  { email: 'demo.family.07@example.test', name: 'Emily Rossi' },
  { email: 'demo.family.08@example.test', name: 'Chris O’Brien' },
  { email: 'demo.family.09@example.test', name: 'Dana Levine' },
  { email: 'demo.family.10@example.test', name: 'Tunde Adeyemi' },
];

const REVIEW_POOL = [
  { rating: 5, title: 'Life-changing for our family', content: 'The staff truly understand our son’s needs. They were patient every step of the way and adapted the session whenever he needed a break. We finally feel understood.' },
  { rating: 5, title: 'Highly recommend', content: 'From the first visit they made my daughter feel comfortable. We’ve seen real, measurable progress in just a few months, and they keep us involved in every decision.' },
  { rating: 5, title: 'Worth every penny', content: 'Warm, professional, and genuinely skilled with kids with disabilities. They send clear progress notes after every session and always follow up when we have questions.' },
  { rating: 5, title: 'Finally found the right fit', content: 'After trying several providers, this is the first one where my child actually looks forward to going. The environment is calm and truly sensory-friendly.' },
  { rating: 5, title: 'Exceptional care and communication', content: 'Every question we’ve asked has been answered thoughtfully. They coordinate with our school team and pediatrician, which has made a huge difference.' },
  { rating: 4, title: 'Great experience overall', content: 'Very accommodating and knowledgeable staff. It can be hard to get a weekend slot, but the quality of care has been worth the wait.' },
  { rating: 4, title: 'Kind and professional', content: 'They took the time to learn my daughter’s communication style before the first appointment. Scheduling was smooth and reminders were helpful.' },
  { rating: 4, title: 'Very happy so far', content: 'Six months in and we’re seeing steady progress. The team is responsive and flexible when plans change last-minute, which happens a lot for us.' },
  { rating: 4, title: 'A welcoming place', content: 'My son is usually anxious in new settings, but the staff made the transition easy with a gradual intro visit. Communication between visits could be a touch faster.' },
  { rating: 3, title: 'Good, with some growing pains', content: 'The people are caring and clearly experienced, but communication about scheduling changes could be better. Once you’re in a routine, it works well.' },
  { rating: 5, title: 'They treat us like family', content: 'It’s rare to find a place where siblings are welcomed too. Everyone knows my kids by name, and accommodations are offered before we even ask.' },
  { rating: 4, title: 'Solid and reliable', content: 'Consistent quality, clear pricing, and no surprises. The waitlist to get started was a few weeks, but they kept us informed the whole time.' },
];
const PROS_POOL = ['Patient, well-trained staff', 'Easy online scheduling', 'Clear communication', 'Sensory-friendly space', 'Flexible hours', 'Great with nonverbal kids', 'Transparent pricing'];
const CONS_POOL = ['Limited weekend availability', 'Waitlist for new clients', 'Parking can be tricky', 'Popular time slots fill fast'];

// ---------------------------------------------------------------------------
// Providers — 26 approved businesses covering all 35 subcategories.
// listing.price: [enum] for FREE/CONTACT, or [enum, min, max].
// ---------------------------------------------------------------------------
const PROVIDERS = [
  {
    email: 'demo.provider.01@example.test',
    owner: 'Marcus Webb',
    businessName: 'Gentle Cuts Barbershop',
    businessType: 'Sensory-Friendly Barbershop',
    display: 'gentlecuts',
    description: 'A barbershop designed from the ground up for kids and adults who find haircuts overwhelming. Dimmed lights, no clipper surprises, visual schedules, and stylists trained in sensory-friendly techniques. First visits can be no-cut “meet the chair” sessions.',
    city: 'austin', address: '410 Congress Ave, Suite 120', year: 2019,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'sensory-processing-disorder', 'adhd'],
    hours: { 'Monday–Friday': '10:00 AM – 6:00 PM', Saturday: '9:00 AM – 3:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Sensory-Friendly Kids Haircut', sub: ['Barber'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['LOW', 25, 40], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '30–45 minutes', frequency: 'As needed', languages: ['English', 'Spanish'], desc: 'A haircut at your child’s pace. We use quiet clippers, visual step cards, and take breaks whenever needed. Parents stay chair-side, and a free “practice visit” is available before the first real cut.', short: 'Quiet clippers, visual schedules, and zero-pressure haircuts for kids.' },
      { name: 'Quiet Hour Adult Appointment', sub: ['Barber'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['LOW', 30, 45], ages: ['ADULT'], duration: '45 minutes', frequency: 'As needed', desc: 'Reserved low-stimulation appointments for adults: no walk-ins, no music, one client in the shop at a time. Book the same barber every visit for a consistent routine.', short: 'One-client-at-a-time quiet appointments for adults.' },
      { name: 'In-Home Haircut Visit', sub: ['Barber'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 60, 85], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '1 hour', frequency: 'As needed', desc: 'We bring the chair to you. Ideal for clients who do best in their own space. Serving the greater Austin area within 20 miles, evenings and weekends included.', short: 'Haircuts at home for clients who do best in familiar spaces.' },
    ],
  },
  {
    email: 'demo.provider.02@example.test',
    owner: 'Dr. Alicia Grant',
    businessName: 'Bright Smiles Special Care Dentistry',
    businessType: 'Dental Practice',
    display: 'brightsmilesdental',
    description: 'A dental practice dedicated to patients with developmental and physical disabilities. Board-certified pediatric and special-care dentists, wheelchair-accessible operatories, and desensitization visits that let patients get comfortable before any treatment begins.',
    city: 'chicago', address: '233 N Michigan Ave, Suite 900', year: 2012,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'down-syndrome', 'cerebral-palsy', 'intellectual-disability'],
    hours: { 'Monday–Thursday': '8:00 AM – 5:00 PM', Friday: '8:00 AM – 1:00 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'Special Care Dental Exam & Cleaning', sub: ['Dentist'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 95, 180], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '45–60 minutes', frequency: 'Every 6 months', insurance: ['Delta Dental', 'Cigna', 'Aetna'], desc: 'Comprehensive exams and cleanings adapted to each patient: extended appointment times, papoose-free approaches, and hygienists trained in special care dentistry. Medicaid plans accepted.', short: 'Extended, adapted dental exams by special-care trained clinicians.' },
      { name: 'Sedation Dentistry Consultation', sub: ['Dentist'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['CONTACT'], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '30 minutes', desc: 'For patients who cannot tolerate treatment while awake, we offer nitrous oxide, oral sedation, and hospital-based general anesthesia. This consultation reviews medical history and builds a safe treatment plan.', short: 'Safe sedation planning for patients who need it.' },
      { name: 'Desensitization Pre-Visit Program', sub: ['Dentist'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['FREE'], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '20 minutes', frequency: 'Up to 4 visits', desc: 'Free practice visits before the first real appointment: sit in the chair, meet the team, touch the mirror, hear the sounds. Social story PDFs are sent home so families can rehearse together.', short: 'Free practice visits so the first appointment feels familiar.' },
    ],
  },
  {
    email: 'demo.provider.03@example.test',
    owner: 'Dr. Priya Raman',
    businessName: 'Harborview Family Medicine',
    businessType: 'Primary Care Clinic',
    display: 'harborviewfamilymed',
    description: 'Primary care built around neurodivergent patients and their families. Our physicians hold extra training in developmental-behavioral care, appointments are double-length by default, and our waiting room has a dedicated quiet space.',
    city: 'seattle', address: '1200 5th Ave, Suite 310', year: 2015,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['autism', 'adhd', 'down-syndrome', 'intellectual-disability'],
    hours: { 'Monday–Friday': '8:00 AM – 6:00 PM', Saturday: '9:00 AM – 1:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Developmental-Behavioral Pediatric Consult', sub: ['Pediatrician'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['HIGH', 220, 320], ages: ['INFANT', 'TODDLER', 'CHILD', 'TEEN'], duration: '90 minutes', insurance: ['Premera', 'Regence', 'United Healthcare'], desc: 'In-depth developmental evaluations with a board-certified developmental-behavioral pediatrician. Includes screening, parent interview, written findings, and referrals coordinated with your existing care team.', short: 'In-depth developmental evaluations with written findings and referrals.' },
      { name: 'Extended Primary Care Visit', sub: ['General Practitioner', 'Pediatrician'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 120, 180], ages: ['ALL_AGES'], duration: '50 minutes', insurance: ['Premera', 'Regence'], desc: 'Routine primary care without the rush. Every appointment is booked at double length so patients can move at their own pace, with sensory accommodations noted in the chart and honored at every visit.', short: 'Double-length primary care appointments with sensory accommodations.' },
      { name: 'Telehealth Follow-Up', sub: ['General Practitioner'], type: 'SERVICE', delivery: 'VIRTUAL', price: ['LOW', 45, 75], ages: ['ALL_AGES'], duration: '20 minutes', desc: 'Video follow-ups for medication checks, results reviews, and care questions — no waiting room required. Ideal for patients who find clinic visits taxing.', short: 'Video follow-ups from home for meds checks and results.' },
    ],
  },
  {
    email: 'demo.provider.04@example.test',
    owner: 'Dr. Owen Fitzgerald',
    businessName: 'ClearView Adaptive Optometry',
    businessType: 'Optometry Clinic',
    display: 'clearviewoptometry',
    description: 'Eye care for patients who can’t do a standard eye exam. We use objective testing methods that don’t rely on verbal responses, and our exam rooms are set up for wheelchair users and sensory-sensitive patients alike.',
    city: 'denver', address: '1660 Lincoln St, Suite 250', year: 2017,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['autism', 'cerebral-palsy', 'visual-impairment', 'intellectual-disability'],
    hours: { 'Monday–Friday': '9:00 AM – 5:00 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'Sensory-Adapted Eye Exam', sub: ['Optometrist'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 110, 160], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '60 minutes', insurance: ['VSP', 'EyeMed'], desc: 'A complete vision exam using objective instruments — no “better one, or better two” required. Dim lighting, breaks on demand, and frames fitting done at the patient’s pace.', short: 'Full eye exams that don’t rely on verbal responses.' },
      { name: 'Home Vision Visit', sub: ['Optometrist'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['HIGH', 195, 260], ages: ['ALL_AGES'], duration: '75 minutes', desc: 'Mobile exams for patients who cannot travel to a clinic. We bring portable diagnostic equipment to homes, day programs, and residential facilities across the Denver metro.', short: 'Complete mobile eye exams at home or day programs.' },
    ],
  },
  {
    email: 'demo.provider.05@example.test',
    owner: 'Lena Fuentes, RDN',
    businessName: 'NourishWell Pediatric Nutrition',
    businessType: 'Nutrition Practice',
    display: 'nourishwell',
    description: 'Registered dietitians specializing in feeding challenges that come with autism, ADHD, and sensory processing differences. We build plans families can actually follow — no shame, no forced foods, just steady progress.',
    city: 'miami', address: '78 SW 7th St, Suite 500', year: 2020,
    level: 'BASIC_VERIFIED', subscription: 'trialing', featured: false,
    disabilities: ['autism', 'adhd', 'sensory-processing-disorder'],
    hours: { 'Monday–Friday': '9:00 AM – 6:00 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'Picky Eater Nutrition Program', sub: ['Nutritionist'], type: 'SERVICE', delivery: 'BOTH', price: ['MEDIUM', 90, 140], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '45 minutes', frequency: 'Weekly or biweekly', desc: 'A structured 12-week program for extremely selective eaters. Weekly sessions (in person or video), food-chaining plans built around your child’s accepted foods, and a parent playbook for mealtimes.', short: '12-week structured program for extremely selective eaters.' },
      { name: 'Nutrition Assessment & Plan', sub: ['Nutritionist'], type: 'SERVICE', delivery: 'VIRTUAL', price: ['MEDIUM', 150, 150], ages: ['ALL_AGES'], duration: '75 minutes', desc: 'A one-time deep dive: growth review, current diet analysis, supplement check, and a written plan you can hand to your pediatrician and therapy team.', short: 'One-time deep-dive assessment with a written, shareable plan.' },
    ],
  },
  {
    email: 'demo.provider.06@example.test',
    owner: 'Gloria Mensah',
    businessName: 'Helping Hands Home Care',
    businessType: 'Home Care Agency',
    display: 'helpinghandshc',
    description: 'Licensed home care agency providing trained aides for children and adults with developmental and physical disabilities. Every caregiver completes 40+ hours of disability-specific training and is matched to your family — not just assigned.',
    city: 'phoenix', address: '2020 N Central Ave, Suite 800', year: 2011,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['cerebral-palsy', 'intellectual-disability', 'down-syndrome', 'autism'],
    hours: { 'Every day': '24 hours (office: Mon–Fri 8 AM – 5 PM)' },
    listings: [
      { name: 'Certified Home Health Aide (Hourly)', sub: ['Home Health Aide'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['LOW', 28, 38], ages: ['ALL_AGES'], duration: 'Minimum 4-hour shifts', frequency: 'Ongoing', insurance: ['AHCCCS / Medicaid'], desc: 'Certified aides for personal care, mobility support, meal prep, and companionship. Consistent caregiver matching, background-checked staff, and RN supervision on every care plan.', short: 'Trained, background-checked aides with consistent matching.' },
      { name: 'Overnight Respite Care', sub: ['Home Health Aide'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 180, 260], ages: ['ALL_AGES'], duration: '10-hour overnight shift', frequency: 'As needed', desc: 'Overnight care so parents and caregivers can actually sleep. Aides handle nighttime routines, repositioning, and morning prep, with a written handoff note every shift.', short: 'Overnight shifts so family caregivers can rest.' },
      { name: 'Weekend Companion Care', sub: ['Home Health Aide'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['LOW', 30, 40], ages: ['TEEN', 'ADULT'], duration: '4–8 hour shifts', frequency: 'Weekends', desc: 'Weekend companionship focused on community outings, hobbies, and daily living practice for teens and adults. Great as a step toward more independence.', short: 'Weekend outings and life-skills companionship for teens and adults.' },
    ],
  },
  {
    email: 'demo.provider.07@example.test',
    owner: 'Renee Caldwell',
    businessName: 'Serenity Adaptive Salon',
    businessType: 'Salon & Grooming Studio',
    display: 'serenitysalon',
    description: 'A full-service salon with private rooms, adjustable lighting, and stylists who specialize in clients with sensory sensitivities and mobility needs. Wheelchair-height stations and hoist-accessible wash basins throughout.',
    city: 'brooklyn', address: '145 Court St', year: 2021,
    level: 'UNVERIFIED', subscription: 'active', featured: false,
    disabilities: ['sensory-processing-disorder', 'autism', 'cerebral-palsy'],
    hours: { 'Tuesday–Saturday': '10:00 AM – 7:00 PM', 'Sunday–Monday': 'Closed' },
    listings: [
      { name: 'Adaptive Nail & Grooming Session', sub: ['Salon / Grooming'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['LOW', 35, 55], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '45 minutes', desc: 'Manicures, nail trims, and grooming in a private room with a familiar stylist every visit. Desensitization visits available for clients new to nail care.', short: 'Private-room nail and grooming care at the client’s pace.' },
      { name: 'Sensory-Friendly Salon Hour', sub: ['Salon / Grooming'], type: 'SERVICE', delivery: 'IN_PERSON', price: ['MEDIUM', 60, 95], ages: ['ALL_AGES'], duration: '60 minutes', desc: 'Book the entire salon: no other clients, no dryers running, your playlist or silence. Full cut/color/style services available in a controlled environment.', short: 'The whole salon to yourself — no noise, no crowd.' },
    ],
  },
  {
    email: 'demo.provider.08@example.test',
    owner: 'Dr. Hannah Liu',
    businessName: 'Bright Steps Therapy Group',
    businessType: 'Multidisciplinary Therapy Clinic',
    display: 'brightsteps',
    description: 'Speech, occupational, and feeding therapy under one roof, so families stop driving across town between appointments. Our clinicians co-treat and share one plan per child, and our sensory gym is open for practice between sessions.',
    city: 'la', address: '600 Wilshire Blvd, Suite 1500', year: 2014,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'speech-language-disorder', 'sensory-processing-disorder', 'down-syndrome'],
    hours: { 'Monday–Friday': '8:00 AM – 7:00 PM', Saturday: '8:00 AM – 2:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Pediatric Speech Therapy', sub: ['Speech Therapy'], type: 'THERAPY', delivery: 'BOTH', price: ['MEDIUM', 95, 150], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '45 minutes', frequency: 'Weekly', insurance: ['Blue Shield', 'Anthem', 'Kaiser (OON)'], desc: 'Licensed SLPs treating articulation, receptive/expressive language, and AAC users. Every plan includes home practice materials and a quarterly parent conference.', short: 'Licensed SLPs for language, articulation, and AAC users.', reviews: 7 },
      { name: 'Occupational Therapy (Sensory Integration)', sub: ['Occupational Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['MEDIUM', 100, 155], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '50 minutes', frequency: 'Weekly', insurance: ['Blue Shield', 'Anthem'], desc: 'OT in a fully equipped sensory gym: swings, climbing wall, and fine-motor stations. Focus areas include sensory regulation, handwriting, and daily living skills.', short: 'Sensory-gym OT for regulation, motor skills, and independence.', reviews: 6 },
      { name: 'Feeding Therapy Program', sub: ['Feeding Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['HIGH', 130, 175], ages: ['INFANT', 'TODDLER', 'CHILD'], duration: '45 minutes', frequency: 'Weekly', desc: 'SOS-trained feeding therapists for kids with extreme food selectivity, oral-motor delays, or tube-to-oral transitions. Co-treatment with our SLPs and a dietitian partner.', short: 'SOS-based feeding therapy, including tube-to-oral transitions.' },
    ],
  },
  {
    email: 'demo.provider.09@example.test',
    owner: 'Dr. Marcus Bell, BCBA-D',
    businessName: 'Spectrum ABA Center',
    businessType: 'ABA Therapy Provider',
    display: 'spectrumaba',
    description: 'Center-based and in-home ABA with a compassionate, assent-based approach. Low caseloads, BCBAs on the floor daily, and parent coaching built into every treatment plan — because progress has to work at home, not just at the center.',
    city: 'dallas', address: '1717 Main St, Suite 4200', year: 2013,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'adhd'],
    hours: { 'Monday–Friday': '7:30 AM – 6:00 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'Center-Based ABA Program (Full Day)', sub: ['ABA Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['CONTACT'], ages: ['TODDLER', 'CHILD'], duration: 'Up to 6 hours/day', frequency: 'Monday–Friday', insurance: ['BCBS Texas', 'Aetna', 'United Healthcare', 'TRICARE'], desc: 'Full-day early intervention ABA in a clinic built for play. 1:1 therapist ratios, natural-environment teaching, and a structured kindergarten-readiness track. Most major insurance accepted.', short: 'Full-day, assent-based center ABA with 1:1 ratios.', reviews: 8 },
      { name: 'In-Home ABA Therapy', sub: ['ABA Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['CONTACT'], ages: ['TODDLER', 'CHILD', 'TEEN'], duration: '2–4 hours/session', frequency: '2–5 days/week', insurance: ['BCBS Texas', 'Aetna'], desc: 'ABA where the behaviors actually happen — at home and in the community. Ideal for family routines, safety skills, and generalizing what’s learned at the center.', short: 'ABA at home, focused on real routines and safety skills.' },
      { name: 'Social Skills Group (Ages 6–12)', sub: ['ABA Therapy', 'Behavioral / Counseling'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['LOW', 40, 60], ages: ['CHILD'], duration: '90 minutes', frequency: 'Weekly', desc: 'Small peer groups (max 6) practicing turn-taking, conversation, and friendship skills through structured games. Led by a BCBA with a written goal per child.', short: 'Small-group friendship-skills practice led by a BCBA.' },
      { name: 'Caregiver Training Intensive', sub: ['ABA Therapy'], type: 'THERAPY', delivery: 'BOTH', price: ['MEDIUM', 85, 125], ages: ['ALL_AGES'], duration: '60 minutes', frequency: 'Weekly for 8 weeks', desc: 'An 8-week 1:1 coaching series for parents and caregivers: understanding behavior, building routines, and de-escalation strategies — with practice between sessions.', short: '8-week behavior coaching series for parents and caregivers.' },
    ],
  },
  {
    email: 'demo.provider.10@example.test',
    owner: 'Dr. Simone Carter, DPT',
    businessName: 'MoveForward Physical Therapy',
    businessType: 'Physical Therapy Clinic',
    display: 'moveforwardpt',
    description: 'Pediatric and adolescent physical therapy for kids with cerebral palsy, Down syndrome, hypotonia, and coordination disorders. Gait lab on site, aquatic therapy pool, and therapists who make hard work feel like play.',
    city: 'atlanta', address: '260 Peachtree St NW, Suite 1100', year: 2016,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['cerebral-palsy', 'down-syndrome'],
    hours: { 'Monday–Friday': '8:00 AM – 6:30 PM', Saturday: '9:00 AM – 1:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Pediatric Physical Therapy', sub: ['Physical Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['MEDIUM', 110, 160], ages: ['INFANT', 'TODDLER', 'CHILD', 'TEEN'], duration: '45 minutes', frequency: 'Weekly', insurance: ['Anthem', 'Cigna', 'Peach State'], desc: 'Individualized PT for gross motor delays, tone management, and post-surgical rehab. Home programs are filmed on your phone during the session so practice is easy.', short: 'Individualized pediatric PT with filmed home programs.' },
      { name: 'Gait & Mobility Program', sub: ['Physical Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['HIGH', 140, 190], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '60 minutes', frequency: '2x/week for 12 weeks', desc: 'A 12-week intensive using our instrumented gait lab, partial body-weight-support treadmill, and orthotics collaboration to improve walking efficiency and endurance.', short: '12-week gait intensive with instrumented lab analysis.' },
      { name: 'Aquatic Therapy Sessions', sub: ['Physical Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['MEDIUM', 95, 135], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '40 minutes', frequency: 'Weekly', desc: 'One-on-one therapy in our 92°F pool. Buoyancy makes movement achievable for kids who struggle on land — and most of them think it’s just swim time.', short: 'Warm-water 1:1 therapy that feels like swim time.' },
    ],
  },
  {
    email: 'demo.provider.11@example.test',
    owner: 'Dr. Naomi Weiss, LCSW',
    businessName: 'Mindful Growth Counseling',
    businessType: 'Counseling Practice',
    display: 'mindfulgrowth',
    description: 'Therapists who understand neurodivergence from the inside — several of our clinicians are neurodivergent themselves. Individual, family, and sibling counseling for the whole support system, in person or by video.',
    city: 'nyc', address: '295 Madison Ave, 12th Floor', year: 2018,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'adhd', 'learning-disability'],
    hours: { 'Monday–Thursday': '9:00 AM – 8:00 PM', Friday: '9:00 AM – 5:00 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'Child & Teen Counseling', sub: ['Behavioral / Counseling'], type: 'THERAPY', delivery: 'BOTH', price: ['MEDIUM', 125, 175], ages: ['CHILD', 'TEEN'], duration: '45 minutes', frequency: 'Weekly', insurance: ['Aetna', 'Oxford', 'Oscar'], desc: 'Neurodiversity-affirming therapy for anxiety, school stress, and emotional regulation. Play-based for younger kids; interest-led and direct for teens.', short: 'Neurodiversity-affirming therapy for anxiety and regulation.' },
      { name: 'Parent Support Counseling', sub: ['Behavioral / Counseling'], type: 'THERAPY', delivery: 'VIRTUAL', price: ['MEDIUM', 110, 150], ages: ['ADULT'], duration: '50 minutes', frequency: 'Weekly or biweekly', desc: 'A space that’s just for you. Process the diagnosis journey, caregiver burnout, and family dynamics with a therapist who works with families in the disability community every day.', short: 'Dedicated support for the parents doing the heavy lifting.' },
      { name: 'Sibling Support Sessions', sub: ['Behavioral / Counseling'], type: 'THERAPY', delivery: 'BOTH', price: ['LOW', 60, 90], ages: ['CHILD', 'TEEN'], duration: '45 minutes', frequency: 'Biweekly', desc: 'Brothers and sisters carry a lot quietly. Individual and small-group sessions help siblings name feelings, answer hard questions, and feel seen in their own right.', short: 'A place for siblings to be heard in their own right.' },
    ],
  },
  {
    email: 'demo.provider.12@example.test',
    owner: 'Isabella Moreno, MT-BC',
    businessName: 'Harmony Hearts Music & Art Therapy',
    businessType: 'Creative Arts Therapy Studio',
    display: 'harmonyhearts',
    description: 'Board-certified music therapists and registered art therapists using creativity as the doorway to communication, regulation, and joy. Individual sessions, group studios, and adaptive lessons for kids and adults of all abilities.',
    city: 'sd', address: '350 Tenth Ave, Suite 600', year: 2019,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'down-syndrome', 'intellectual-disability', 'sensory-processing-disorder'],
    hours: { 'Monday–Friday': '10:00 AM – 7:00 PM', Saturday: '9:00 AM – 3:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Individual Music Therapy', sub: ['Music Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['MEDIUM', 80, 120], ages: ['ALL_AGES'], duration: '45 minutes', frequency: 'Weekly', desc: 'Goal-driven sessions with a board-certified music therapist: communication through song, motor skills through rhythm, and regulation through shared music-making. No musical experience needed.', short: 'Goal-driven sessions with a board-certified music therapist.' },
      { name: 'Group Art Therapy Studio', sub: ['Art Therapy'], type: 'THERAPY', delivery: 'IN_PERSON', price: ['LOW', 40, 55], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '60 minutes', frequency: 'Weekly', desc: 'Small studio groups (max 5) led by a registered art therapist. Process-focused art making that builds expression, fine motor skills, and social connection — mess encouraged.', short: 'Small-group expressive art with a registered art therapist.' },
      { name: 'Adaptive Music Lessons', sub: ['Music Therapy'], type: 'THERAPY', delivery: 'BOTH', price: ['LOW', 45, 65], ages: ['CHILD', 'TEEN', 'ADULT'], duration: '30 minutes', frequency: 'Weekly', desc: 'Piano, guitar, drums, and voice lessons adapted to each learner: color-coded notation, chunked practice, and teachers trained in disability-informed pedagogy.', short: 'Real instrument lessons, adapted to how each student learns.' },
    ],
  },
  {
    email: 'demo.provider.13@example.test',
    owner: 'Frank Delgado',
    businessName: 'AbleGear Mobility & Equipment',
    businessType: 'Medical Equipment Supplier',
    display: 'ablegear',
    description: 'A family-run supplier of pediatric and adult mobility equipment with an on-staff ATP (Assistive Technology Professional). Try everything in our showroom, rent before you buy, and get real fitting help — not just a box in the mail.',
    city: 'houston', address: '3900 Essex Ln, Suite 150', year: 2008,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['cerebral-palsy', 'down-syndrome', 'intellectual-disability'],
    hours: { 'Monday–Friday': '9:00 AM – 6:00 PM', Saturday: '10:00 AM – 4:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Lightweight Pediatric Wheelchair', sub: ['Mobility Aids'], type: 'SHOP', price: ['PREMIUM', 1250, 2400], shop: { condition: 'NEW', brand: 'AbleGear Pro' }, desc: 'Ultra-light rigid-frame pediatric wheelchairs with growable seat systems. Price includes professional fitting with our ATP, two follow-up adjustments, and insurance paperwork support.', short: 'Growable, ultra-light chairs with professional fitting included.' },
      { name: 'Gait Trainer (Monthly Rental)', sub: ['Mobility Aids'], type: 'SHOP', price: ['MEDIUM', 95, 145], shop: { condition: 'USED_LIKE_NEW', brand: 'StrideRight', rent: true }, desc: 'Rent a properly sized gait trainer month-to-month — ideal while waiting on insurance approval or testing what works. Sanitized, inspected, and swapped free as your child grows.', short: 'Month-to-month gait trainer rentals, swap sizes free.' },
      { name: 'Bed Safety Rail Set', sub: ['Safety Equipment'], type: 'SHOP', price: ['LOW', 55, 85], shop: { condition: 'NEW', brand: 'SafeNight' }, desc: 'Padded, tool-free bed rails rated for restless sleepers. Fits twin through queen frames; installation video and phone support included with every purchase.', short: 'Padded, tool-free bed rails for restless sleepers.' },
      { name: 'GPS Locator Watch', sub: ['Safety Equipment'], type: 'SHOP', price: ['MEDIUM', 129, 179], shop: { condition: 'NEW', brand: 'TrackSafe' }, desc: 'A wander-safety wristband with live GPS, geofence alerts, and a caregiver app. Lockable clasp designed for kids who remove standard watches. No-contract monitoring plans.', short: 'Wander-safety GPS watch with lockable clasp and geofencing.' },
    ],
  },
  {
    email: 'demo.provider.14@example.test',
    owner: 'Kayla Brooks',
    businessName: 'Sensory Haven Shop',
    businessType: 'Sensory Products Retailer',
    display: 'sensoryhaven',
    description: 'Curated sensory tools tested by our own neurodivergent staff and family testers before they ever hit the shelf. Everything ships in quiet, easy-open packaging, and our “try it” guides help you use each tool well.',
    city: 'orlando', address: '55 W Church St, Suite 210', year: 2022,
    level: 'UNVERIFIED', subscription: 'trialing', featured: false,
    disabilities: ['autism', 'sensory-processing-disorder', 'adhd'],
    hours: { 'Monday–Saturday': '10:00 AM – 8:00 PM', Sunday: '11:00 AM – 5:00 PM' },
    listings: [
      { name: 'Weighted Blanket (Ages 5+)', sub: ['Sensory Tools'], type: 'SHOP', price: ['LOW', 49, 79], shop: { condition: 'NEW', brand: 'CalmCloud' }, desc: 'Glass-bead weighted blankets in 5, 7, and 10 lb options with a machine-washable minky cover. Sized and weighted per current pediatric OT guidance — sizing chart included.', short: 'OT-guided weighted blankets with washable covers.' },
      { name: 'Sensory Swing Kit (Indoor)', sub: ['Sensory Tools', 'Toys & Learning Aids'], type: 'SHOP', price: ['MEDIUM', 89, 129], shop: { condition: 'NEW', brand: 'NestSwing' }, desc: 'A four-season indoor therapy swing with ceiling hardware rated to 200 lbs, installation guide, and three mounting options. The single most-recommended tool by our OT partners.', short: 'Indoor therapy swing kit with rated ceiling hardware.' },
      { name: 'Calm-Down Corner Bundle', sub: ['Sensory Tools', 'Toys & Learning Aids'], type: 'SHOP', price: ['MEDIUM', 119, 149], shop: { condition: 'NEW', brand: 'Sensory Haven' }, desc: 'Everything for a regulation station: canopy tent, liquid motion timers, noise-reducing earmuffs, fidget set, and a feelings chart — with a setup guide written by a school psychologist.', short: 'Complete regulation-station bundle with setup guide.' },
      { name: 'Visual Timer & Schedule Set', sub: ['Toys & Learning Aids'], type: 'SHOP', price: ['LOW', 34, 49], shop: { condition: 'NEW', brand: 'TimeTeller' }, desc: 'A 60-minute visual countdown timer plus a magnetic daily schedule board with 48 routine icons. The transition-tamer families tell us they wish they’d bought first.', short: 'Visual timer plus magnetic routine board, 48 icons included.' },
    ],
  },
  {
    email: 'demo.provider.15@example.test',
    owner: 'Dr. Elena Vasquez, CCC-SLP',
    businessName: 'Voices AAC Solutions',
    businessType: 'Assistive Technology Provider',
    display: 'voicesaac',
    description: 'AAC evaluation, devices, and — most importantly — the coaching that makes them stick. Run by speech-language pathologists who specialize in augmentative communication, from first words on a board to full literacy on an eye-gaze system.',
    city: 'sj', address: '2 N Market St, Suite 400', year: 2015,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'cerebral-palsy', 'speech-language-disorder', 'intellectual-disability'],
    hours: { 'Monday–Friday': '9:00 AM – 5:30 PM', 'Saturday–Sunday': 'Closed' },
    listings: [
      { name: 'AAC Tablet Bundle (Device + Setup)', sub: ['Communication Devices (AAC)'], type: 'SHOP', price: ['PREMIUM', 850, 1400], shop: { condition: 'NEW', brand: 'TalkPath' }, desc: 'A rugged tablet preloaded with a leading AAC app, custom vocabulary built for your child by an SLP, a protective case, and two 1:1 training sessions for the family and school team.', short: 'AAC tablet with SLP-built vocabulary and family training.' },
      { name: 'Eye-Gaze Device (Demo & Rental)', sub: ['Communication Devices (AAC)'], type: 'SHOP', price: ['CONTACT'], shop: { condition: 'USED_LIKE_NEW', brand: 'GazeSpeak', rent: true }, desc: 'Try eye-gaze communication before committing: in-office demos plus 30-day home rentals with remote coaching. We handle the insurance funding paperwork when you’re ready to purchase.', short: 'Try-before-you-buy eye-gaze rentals with coaching.' },
      { name: 'Communication Board Starter Pack', sub: ['Communication Devices (AAC)'], type: 'SHOP', price: ['LOW', 25, 45], shop: { condition: 'NEW', brand: 'Voices' }, desc: 'Laminated core-word boards, fringe vocabulary strips, and a quick-start guide for parents. A low-tech starting point recommended by SLPs while device funding is in progress.', short: 'Low-tech core-word boards to start communicating today.' },
    ],
  },
  {
    email: 'demo.provider.16@example.test',
    owner: 'Danielle Okafor',
    businessName: 'ComfortFit Adaptive Apparel',
    businessType: 'Adaptive Clothing Brand',
    display: 'comfortfit',
    description: 'Clothing engineered for real bodies and real sensory needs: flat seams, tag-free everything, magnetic closures, and abdominal-access designs. Designed with input from a parent advisory board of 200+ families in the disability community.',
    city: 'chicago', address: '444 N Wabash Ave, Suite 300', year: 2020,
    level: 'UNVERIFIED', subscription: 'active', featured: false,
    disabilities: ['sensory-processing-disorder', 'autism', 'cerebral-palsy'],
    hours: { 'Monday–Friday': '9:00 AM – 5:00 PM (online orders 24/7)' },
    listings: [
      { name: 'Seamless Sensory Basics 5-Pack', sub: ['Adaptive Clothing'], type: 'SHOP', price: ['LOW', 45, 65], shop: { condition: 'NEW', brand: 'ComfortFit' }, desc: 'Five tag-free, flat-seam tees in soft bamboo blend — the everyday uniform for kids who can’t tolerate standard seams. Sizes 2T through adult XL, in school-friendly colors.', short: 'Tag-free, flat-seam basics from 2T to adult XL.' },
      { name: 'Adaptive School Uniform Line', sub: ['Adaptive Clothing'], type: 'SHOP', price: ['LOW', 25, 55], shop: { condition: 'NEW', brand: 'ComfortFit' }, desc: 'Polos and pants that look exactly like the standard uniform but fasten with magnets and hidden elastic. Independence at the school bathroom without standing out at school.', short: 'Standard-looking uniforms with magnetic fastening.' },
      { name: 'Easy-Dress Winter Jacket', sub: ['Adaptive Clothing'], type: 'SHOP', price: ['MEDIUM', 79, 99], shop: { condition: 'NEW', brand: 'ComfortFit' }, desc: 'A warm winter coat with a full-open magnetic front, wheelchair-friendly back panel, and mitten clips that never get lost. Machine washable, obviously.', short: 'Magnetic-front winter coat with wheelchair-friendly cut.' },
    ],
  },
  {
    email: 'demo.provider.17@example.test',
    owner: 'Tom Ellery',
    businessName: 'SteadyNest Adaptive Furniture',
    businessType: 'Adaptive Furniture Maker',
    display: 'steadynest',
    description: 'Handbuilt adaptive furniture from a Colorado workshop: safety beds, supportive seating, and height-adjustable tables that grow with your child. Every piece is customized to measurements you send us — and built to survive real family life.',
    city: 'denver', address: '2955 Inca St, Unit B', year: 2016,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'cerebral-palsy', 'intellectual-disability'],
    hours: { 'Monday–Friday': '8:00 AM – 4:30 PM', 'Saturday–Sunday': 'By appointment' },
    listings: [
      { name: 'Adaptive Seating Chair (Custom)', sub: ['Adaptive Furniture'], type: 'SHOP', price: ['PREMIUM', 450, 900], shop: { condition: 'NEW', brand: 'SteadyNest' }, desc: 'Supportive hardwood seating with adjustable laterals, footrest, and harness options — built to your child’s measurements for mealtime and table-top activities.', short: 'Custom-measured supportive seating for meals and play.' },
      { name: 'Safety Sleeper Bed (Toddler–Teen)', sub: ['Adaptive Furniture', 'Safety Equipment'], type: 'SHOP', price: ['PREMIUM', 1800, 3200], shop: { condition: 'NEW', brand: 'SteadyNest' }, desc: 'A fully enclosed safety bed for elopers and restless sleepers: padded panels, ventilated mesh, and quiet-close access doors. Ships flat with white-glove assembly available.', short: 'Enclosed safety beds for elopers and restless sleepers.' },
      { name: 'Height-Adjustable Activity Table', sub: ['Adaptive Furniture'], type: 'SHOP', price: ['HIGH', 320, 480], shop: { condition: 'NEW', brand: 'SteadyNest' }, desc: 'A crank-adjustable table that fits wheelchairs, standers, and floor sitters alike. Rounded edges, easy-clean surface, and a lip option to keep materials on the table.', short: 'One table that fits wheelchairs, standers, and floor sitters.' },
    ],
  },
  {
    email: 'demo.provider.18@example.test',
    owner: 'Dr. Angela Torres',
    businessName: 'Pathways Academy',
    businessType: 'Special Education School',
    display: 'pathwaysacademy',
    description: 'A state-certified nonpublic school for students with autism and related developmental disabilities. 3:1 student-staff ratios, on-site speech and OT, and an evidence-based curriculum that meets each student exactly where they are.',
    city: 'la', address: '4100 W Olympic Blvd', year: 2009,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'intellectual-disability', 'speech-language-disorder'],
    hours: { 'Monday–Friday': '8:00 AM – 3:00 PM (aftercare to 5:30 PM)' },
    listings: [
      { name: 'K–8 Special Education Program', sub: ['Special Education Schools'], type: 'SCHOOL', price: ['CONTACT'], ages: ['CHILD'], school: { enrollment: 'Open', grades: ['K', '1', '2', '3', '4', '5', '6', '7', '8'], program: 'Full-day special education, 3:1 ratio' }, desc: 'Full-day academic program with integrated speech, OT, and behavior support. Individualized instruction aligned to each student’s IEP, with district funding accepted for qualifying placements.', short: 'Full-day K–8 program with integrated therapies, 3:1 ratio.', reviews: 6 },
      { name: 'High School Program (9–12)', sub: ['Special Education Schools', 'Transition / Life Skills Programs'], type: 'SCHOOL', price: ['CONTACT'], ages: ['TEEN'], school: { enrollment: 'Waitlist', grades: ['9', '10', '11', '12'], program: 'Academics + transition planning' }, desc: 'Academics with a transition backbone: community-based instruction, travel training, and workplace readiness woven into every student’s week from freshman year on.', short: 'High school academics with transition skills from day one.' },
      { name: 'Summer Bridge Program', sub: ['Special Education Schools'], type: 'SCHOOL', price: ['HIGH', 1800, 2400], ages: ['CHILD', 'TEEN'], school: { enrollment: 'Open', grades: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9'], program: '6-week summer session' }, desc: 'A 6-week summer session that prevents regression and eases the fall transition: mornings of academics, afternoons of social skills, swim, and community outings.', short: 'Six summer weeks that prevent regression and build momentum.' },
    ],
  },
  {
    email: 'demo.provider.19@example.test',
    owner: 'Beth Sandoval, M.Ed.',
    businessName: 'Unity Learning Collaborative',
    businessType: 'Inclusive School',
    display: 'unitylearning',
    description: 'An intentionally inclusive private school where neurodivergent and neurotypical students learn side by side with co-teachers in every classroom. Universal Design for Learning isn’t a buzzword here — it’s the whole model.',
    city: 'austin', address: '2201 E Cesar Chavez St', year: 2014,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'adhd', 'learning-disability', 'down-syndrome'],
    hours: { 'Monday–Friday': '7:45 AM – 3:15 PM' },
    listings: [
      { name: 'Inclusive Elementary Program (K–5)', sub: ['Inclusive / Mainstream Programs'], type: 'SCHOOL', price: ['CONTACT'], ages: ['CHILD'], school: { enrollment: 'Open', grades: ['K', '1', '2', '3', '4', '5'], program: 'Co-taught inclusive classrooms' }, desc: 'Every classroom has a general educator and a special educator, all day. Small classes of 16 with a 30/70 ratio of students with and without IEPs — designed so everyone belongs.', short: 'Co-taught inclusive classrooms where every kid belongs.' },
      { name: 'Co-Taught Middle School (6–8)', sub: ['Inclusive / Mainstream Programs'], type: 'SCHOOL', price: ['CONTACT'], ages: ['CHILD', 'TEEN'], school: { enrollment: 'Waitlist', grades: ['6', '7', '8'], program: 'Inclusive middle school with advisory' }, desc: 'Middle school with the same co-teaching model plus a daily advisory period focused on executive function, self-advocacy, and the social curveballs of adolescence.', short: 'Inclusive middle school with daily executive-function advisory.' },
    ],
  },
  {
    email: 'demo.provider.20@example.test',
    owner: 'Jordan Blake, M.S.',
    businessName: 'Rise Tutoring & Learning Support',
    businessType: 'Tutoring Service',
    display: 'risetutoring',
    description: 'Specialist tutors for students with dyslexia, ADHD, and learning differences — not generalists moonlighting. Orton-Gillingham certified reading instruction, multisensory math, and executive function coaching, in person or online.',
    city: 'nyc', address: '31 W 34th St, Suite 800', year: 2017,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['learning-disability', 'adhd', 'autism'],
    hours: { 'Monday–Friday': '2:00 PM – 8:00 PM', Saturday: '9:00 AM – 3:00 PM', Sunday: 'Closed' },
    listings: [
      { name: '1:1 Orton-Gillingham Reading Tutoring', sub: ['Tutoring & Learning Support'], type: 'SCHOOL', price: ['MEDIUM', 85, 120], ages: ['CHILD', 'TEEN'], school: { enrollment: 'Open', grades: ['1', '2', '3', '4', '5', '6', '7', '8'], program: 'Structured literacy, 2–3x/week' }, desc: 'Certified Orton-Gillingham instruction for dyslexic readers, 2–3 sessions weekly. Progress is benchmarked every 10 weeks and shared in reports your school will actually read.', short: 'Certified OG structured-literacy tutoring for dyslexic readers.' },
      { name: 'Multisensory Math Tutoring', sub: ['Tutoring & Learning Support'], type: 'SCHOOL', price: ['MEDIUM', 80, 110], ages: ['CHILD', 'TEEN'], school: { enrollment: 'Open', grades: ['2', '3', '4', '5', '6', '7', '8', '9'], program: 'Concrete-representational-abstract math' }, desc: 'Math built from manipulatives up — the concrete-representational-abstract sequence that works for dyscalculic and ADHD learners. Homework support included between sessions.', short: 'Hands-on math for students numbers haven’t clicked for.' },
      { name: 'Executive Function Coaching', sub: ['Tutoring & Learning Support'], type: 'SCHOOL', price: ['MEDIUM', 90, 125], ages: ['TEEN', 'ADULT'], school: { enrollment: 'Open', grades: ['6', '7', '8', '9', '10', '11', '12', 'College'], program: 'Weekly 1:1 coaching' }, desc: 'Weekly coaching on planning, task initiation, and follow-through for middle schoolers through college students. Systems are built WITH the student, on the tools they already use.', short: 'Planning and follow-through coaching students actually keep using.' },
    ],
  },
  {
    email: 'demo.provider.21@example.test',
    owner: 'Denise Park',
    businessName: 'NextStep Transition Services',
    businessType: 'Transition Program',
    display: 'nextsteptransition',
    description: 'The bridge between school and adult life. Our 18–22 and adult programs teach independent living, work skills, and community navigation through doing — in real apartments, real workplaces, and real transit, with coaching every step.',
    city: 'seattle', address: '999 Third Ave, Suite 2000', year: 2012,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['intellectual-disability', 'autism', 'down-syndrome'],
    hours: { 'Monday–Friday': '8:30 AM – 4:30 PM' },
    listings: [
      { name: 'Life Skills Immersion Program (18–22)', sub: ['Transition / Life Skills Programs'], type: 'SCHOOL', price: ['CONTACT'], ages: ['ADULT'], school: { enrollment: 'Open', grades: ['Ages 18–22'], program: 'Full-day transition program' }, desc: 'A full-day program in our teaching apartment and the surrounding neighborhood: cooking, budgeting, transit, phones, and the thousand small skills independence is made of.', short: 'Real-apartment life-skills training for ages 18–22.' },
      { name: 'Job Readiness & Placement Program', sub: ['Vocational Training'], type: 'SCHOOL', price: ['CONTACT'], ages: ['TEEN', 'ADULT'], school: { enrollment: 'Open', grades: ['Ages 16+'], program: 'Vocational training + placement' }, desc: 'Assessment, training, and placement with our network of 40+ inclusive employers. Job coaches support the first 90 days on site, then fade as independence grows.', short: 'Vocational training with real placement and 90-day coaching.', reviews: 5 },
      { name: 'Supported Internship Track', sub: ['Vocational Training', 'Transition / Life Skills Programs'], type: 'SCHOOL', price: ['CONTACT'], ages: ['ADULT'], school: { enrollment: 'Waitlist', grades: ['Ages 18–26'], program: 'Rotational internships, 2 semesters' }, desc: 'Two semesters of rotational internships in hospitals, offices, and retail — modeled on Project SEARCH. Interns graduate with references, a resume, and often a job offer.', short: 'Rotational internships that end with references and offers.' },
    ],
  },
  {
    email: 'demo.provider.22@example.test',
    owner: 'Dr. Camille Baptiste',
    businessName: 'Tiny Steps Early Intervention',
    businessType: 'Early Intervention Center',
    display: 'tinysteps',
    description: 'Birth-to-three services delivered where little ones learn best — at home and in play. Our transdisciplinary team (SLP, OT, PT, and developmental specialists) coaches caregivers so intervention happens all week, not just at appointments.',
    city: 'miami', address: '2103 Coral Way, Suite 400', year: 2015,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['down-syndrome', 'autism', 'cerebral-palsy', 'speech-language-disorder'],
    hours: { 'Monday–Friday': '8:00 AM – 6:00 PM', Saturday: '9:00 AM – 12:00 PM', Sunday: 'Closed' },
    listings: [
      { name: 'Early Intervention Program (0–3)', sub: ['Early Intervention Programs'], type: 'SCHOOL', price: ['FREE'], ages: ['INFANT', 'TODDLER'], school: { enrollment: 'Open', grades: ['Birth–3'], program: 'Home-based early intervention' }, desc: 'Home-based developmental services at no cost to qualifying families through Florida Early Steps. Evaluations within two weeks of referral, and coaching that fits your actual routines.', short: 'No-cost home-based birth-to-three services (Early Steps).', reviews: 7 },
      { name: 'Toddler Developmental Playgroup', sub: ['Early Intervention Programs'], type: 'SCHOOL', price: ['LOW', 20, 35], ages: ['TODDLER'], school: { enrollment: 'Open', grades: ['18–36 months'], program: 'Weekly caregiver-and-me group' }, desc: 'A weekly caregiver-and-me group run by a developmental specialist and an SLP: songs, sensory play, and peer time, with strategies modeled live for the grown-ups.', short: 'Specialist-led caregiver-and-me playgroup with live coaching.' },
    ],
  },
  {
    email: 'demo.provider.23@example.test',
    owner: 'Monica Reyes',
    businessName: 'Together Families Network',
    businessType: 'Family Support Organization',
    display: 'togetherfamilies',
    description: 'A parent-founded nonprofit running support groups, workshops, and community programs for families in the disability community across the Valley. Most programs are free, childcare is provided at in-person events, and everyone is welcome exactly as they are.',
    city: 'phoenix', address: '1130 E Missouri Ave', year: 2010,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'down-syndrome', 'adhd', 'intellectual-disability'],
    hours: { 'Monday–Friday': '9:00 AM – 5:00 PM (events evenings/weekends)' },
    listings: [
      { name: 'Monthly Parent Support Circle', sub: ['Support Groups'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['ADULT'], event: { startDays: 12, capacity: 30, rsvp: 22 }, frequency: 'First Tuesday monthly', desc: 'A facilitated monthly circle for parents and caregivers — part venting, part problem-solving, all judgment-free. Free childcare and a sensory room on site during the meeting.', short: 'Free facilitated monthly circle, childcare provided.', reviews: 5 },
      { name: 'Autism 101: Newly Diagnosed Workshop', sub: ['Workshops / Training', 'Support Groups'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['ADULT'], event: { startDays: 26, capacity: 50, rsvp: 34 }, desc: 'A 3-hour orientation for families within a year of diagnosis: what the diagnosis means, how services and funding work in Arizona, and the shortcuts veteran parents wish they’d known.', short: 'The orientation every newly diagnosed family deserves.' },
      { name: 'Virtual Dads’ Support Group', sub: ['Support Groups'], type: 'EVENT', delivery: 'VIRTUAL', price: ['FREE'], ages: ['ADULT'], event: { startDays: 8, capacity: 25, rsvp: 11, virtual: true }, frequency: 'Second Thursday monthly', desc: 'An evening video call just for dads and male caregivers, facilitated by a dad who’s been there. Cameras optional, honesty encouraged.', short: 'A monthly video call just for dads. Cameras optional.' },
    ],
  },
  {
    email: 'demo.provider.24@example.test',
    owner: 'Coach Danny Whitfield',
    businessName: 'Camp Evergreen Abilities',
    businessType: 'Adaptive Camp',
    display: 'campevergreen',
    description: 'An accredited adaptive camp in the foothills outside Denver: 1:2 counselor ratios, a nurse on site 24/7, and every activity — climbing, canoeing, campfires — adapted so every camper participates for real, not from the sidelines.',
    city: 'denver', address: '18300 W Colfax Ave (camp office)', year: 2007,
    level: 'LICENSED', subscription: 'active', featured: true,
    disabilities: ['autism', 'down-syndrome', 'cerebral-palsy', 'intellectual-disability'],
    hours: { 'Office: Monday–Friday': '9:00 AM – 5:00 PM' },
    listings: [
      { name: 'Summer Camp Session A (Ages 8–14)', sub: ['Camps'], type: 'EVENT', delivery: 'IN_PERSON', price: ['PREMIUM', 1450, 1450], ages: ['CHILD', 'TEEN'], event: { startDays: 17, lengthDays: 6, capacity: 60, rsvp: 47 }, desc: 'Six days of overnight camp with 1:2 ratios, adaptive equipment for every activity, med management by our nursing team, and nightly photo updates for parents. Scholarships available.', short: 'Overnight adaptive camp, 1:2 ratios, nurse on site 24/7.', reviews: 8 },
      { name: 'Teen & Young Adult Session (15–21)', sub: ['Camps'], type: 'EVENT', delivery: 'IN_PERSON', price: ['PREMIUM', 1450, 1450], ages: ['TEEN', 'ADULT'], event: { startDays: 31, lengthDays: 6, capacity: 48, rsvp: 29 }, desc: 'The same Evergreen magic, aimed older: more independence, camper-led activity choices, and an overnight backpacking option for those who want the challenge.', short: 'Older-camper session with more independence and choice.' },
      { name: 'Family Camp Weekend', sub: ['Camps', 'Social / Recreational Meetups'], type: 'EVENT', delivery: 'IN_PERSON', price: ['HIGH', 395, 495], ages: ['ALL_AGES'], event: { startDays: 52, lengthDays: 2, capacity: 30, rsvp: 18 }, desc: 'The whole family comes to camp: cabins, meals, and activities together, plus parent workshops while kids adventure with counselors. Siblings fully included.', short: 'A camp weekend for the entire family, siblings included.' },
    ],
  },
  {
    email: 'demo.provider.25@example.test',
    owner: 'Yvonne Charles',
    businessName: 'Hope & Access Foundation',
    businessType: 'Community Nonprofit',
    display: 'hopeaccess',
    description: 'A community foundation making Atlanta more accessible one event at a time — sensory-friendly outings, adaptive sports, and an annual walk that funds grants for local families. Every event is free or pay-what-you-can.',
    city: 'atlanta', address: '100 Edgewood Ave NE, Suite 1500', year: 2013,
    level: 'BASIC_VERIFIED', subscription: 'active', featured: false,
    disabilities: ['autism', 'down-syndrome', 'cerebral-palsy', 'sensory-processing-disorder'],
    hours: { 'Monday–Friday': '9:00 AM – 5:00 PM (events weekends)' },
    listings: [
      { name: 'Annual Walk for Inclusion 5K', sub: ['Fundraisers'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['ALL_AGES'], event: { startDays: 44, capacity: 500, rsvp: 312 }, desc: 'Our flagship fundraiser: a fully accessible 5K route through Piedmont Park with a sensory-calm zone, adaptive cycling wave, and festival village. Registration free; fundraising optional.', short: 'Accessible 5K + festival funding grants for local families.', reviews: 6 },
      { name: 'Sensory-Friendly Movie Night', sub: ['Social / Recreational Meetups'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['ALL_AGES'], event: { startDays: 9, capacity: 120, rsvp: 86 }, frequency: 'Monthly', desc: 'Lights up, sound down, move-around-as-you-need movie screenings in a reserved theater. Free popcorn, no shushing, and a quiet room right outside the door.', short: 'Lights-up, sound-down screenings. No shushing, ever.' },
      { name: 'Adaptive Sports Saturday', sub: ['Social / Recreational Meetups'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['CHILD', 'TEEN', 'ADULT'], event: { startDays: 15, capacity: 80, rsvp: 41 }, frequency: 'Every other Saturday', desc: 'Drop-in adaptive basketball, soccer, and cycling with trained volunteer coaches and all equipment provided. Come try a sport — or three.', short: 'Drop-in adaptive sports, equipment and coaches provided.' },
    ],
  },
  {
    email: 'demo.provider.26@example.test',
    owner: 'Patricia Nwosu, Esq.',
    businessName: 'Advocacy Alliance',
    businessType: 'Advocacy Organization',
    display: 'advocacyalliance',
    description: 'Special education attorneys and certified advocates helping families get the services their children are legally entitled to. Free clinics monthly, sliding-scale representation, and workshops that turn parents into confident advocates.',
    city: 'chicago', address: '77 W Washington St, Suite 1800', year: 2011,
    level: 'LICENSED', subscription: 'active', featured: false,
    disabilities: ['autism', 'learning-disability', 'adhd', 'intellectual-disability'],
    hours: { 'Monday–Friday': '9:00 AM – 5:00 PM' },
    listings: [
      { name: 'Free IEP Review Clinic', sub: ['IEP / Advocacy Clinics'], type: 'EVENT', delivery: 'IN_PERSON', price: ['FREE'], ages: ['ADULT'], event: { startDays: 11, capacity: 40, rsvp: 33 }, frequency: 'Monthly', desc: 'Bring your child’s IEP and sit down 1:1 with an advocate for 30 minutes. Walk out knowing what’s strong, what’s missing, and exactly what to ask for at the next meeting.', short: 'Free 1:1 IEP reviews with certified advocates.', reviews: 6 },
      { name: 'Special Education Rights Workshop', sub: ['IEP / Advocacy Clinics', 'Workshops / Training'], type: 'EVENT', delivery: 'VIRTUAL', price: ['FREE'], ages: ['ADULT'], event: { startDays: 21, capacity: 200, rsvp: 145, virtual: true }, desc: 'A two-hour evening webinar on IDEA rights, evaluations, and what schools must (and must not) do — taught in plain English by a special education attorney, with live Q&A.', short: 'IDEA rights in plain English, live Q&A with an attorney.' },
      { name: '504 Plan Q&A Session', sub: ['IEP / Advocacy Clinics'], type: 'EVENT', delivery: 'VIRTUAL', price: ['FREE'], ages: ['ADULT'], event: { startDays: 35, capacity: 100, rsvp: 52, virtual: true }, desc: 'When is a 504 enough, and when should you push for an IEP? An hour of straight answers on accommodations, documentation, and enforcement.', short: 'Straight answers on 504s vs IEPs, accommodations, enforcement.' },
    ],
  },
];

// Two PENDING applications so the admin approval queue has content to demo.
const PENDING_PROVIDERS = [
  {
    email: 'demo.pending.01@example.test',
    owner: 'Grace Holloway',
    businessName: 'Little Wonders Therapy Studio',
    businessType: 'Pediatric Therapy Clinic',
    display: 'littlewonders',
    description: 'New pediatric OT and speech studio opening in Orlando, founded by two clinicians with 15 combined years in school-based practice. Currently completing our verification paperwork.',
    city: 'orlando', address: '801 N Magnolia Ave, Suite 105', year: 2026,
    disabilities: ['autism', 'sensory-processing-disorder'],
  },
  {
    email: 'demo.pending.02@example.test',
    owner: 'Ray Simmons',
    businessName: 'Metro Adaptive Transport',
    businessType: 'Accessible Transportation',
    display: 'metroadaptive',
    description: 'Door-to-door wheelchair-accessible transportation for appointments, programs, and outings across the Dallas metro. WAV fleet with trained drivers; awaiting platform verification.',
    city: 'dallas', address: '2500 Victory Ave, Suite 300', year: 2024,
    disabilities: ['cerebral-palsy', 'intellectual-disability'],
  },
];

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------
async function ensureDisabilities() {
  const map = new Map();
  for (const item of DISABILITIES) {
    let row = await prisma.disability.findFirst({
      where: { OR: [{ slug: item.slug }, { name: item.name }] },
      select: { id: true },
    });
    if (!row) {
      row = await prisma.disability.create({
        data: { slug: item.slug, name: item.name, category: item.category, description: `Providers supporting individuals with ${item.name.toLowerCase()}.` },
        select: { id: true },
      });
    }
    map.set(item.slug, row.id);
  }
  return map;
}

async function ensureServiceTypes() {
  // Same adoption logic as scripts/seed-categories.mjs: name is unique, so match
  // by name and tag with listingType; create with a type-prefixed slug if new.
  const map = new Map();
  for (const cat of TAXONOMY) {
    let order = 0;
    for (const sub of cat.subs) {
      const displayOrder = order++;
      const existing = await prisma.serviceType.findUnique({ where: { name: sub }, select: { id: true } });
      if (existing) {
        await prisma.serviceType.update({
          where: { name: sub },
          data: { category: cat.label, listingType: cat.type, isActive: true },
        });
        map.set(sub, existing.id);
        continue;
      }
      let slug = slugify(`${cat.type}-${sub}`);
      if (await prisma.serviceType.findUnique({ where: { slug } })) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      }
      const created = await prisma.serviceType.create({
        data: { name: sub, slug, category: cat.label, listingType: cat.type, displayOrder, isActive: true },
        select: { id: true },
      });
      map.set(sub, created.id);
    }
  }
  return map;
}

async function removeOldFakeAccounts() {
  // The earlier seed created businesses literally named "FAKE Demo Business NN" —
  // fine for plumbing tests, terrible next to stakeholder-ready data.
  const removed = await prisma.user.deleteMany({
    where: { email: { startsWith: 'fake.biz.', endsWith: '@example.test' } },
  });
  if (removed.count > 0) console.log(`Removed ${removed.count} old "FAKE Demo Business" accounts.`);
}

async function upsertFamilies(passwordHash) {
  const ids = [];
  for (const fam of FAMILIES) {
    const user = await prisma.user.upsert({
      where: { email: fam.email },
      update: { name: fam.name, password: passwordHash, role: 'USER', isActive: true, emailVerified: new Date() },
      create: { email: fam.email, name: fam.name, password: passwordHash, role: 'USER', isActive: true, emailVerified: new Date() },
      select: { id: true },
    });
    ids.push(user.id);
  }
  return ids;
}

function businessData(p, index, approved) {
  const loc = CITIES[p.city];
  const rng = rngFor(p.businessName);
  const jitter = () => (rng() - 0.5) * 0.06;
  const phone = `(555) ${String(210 + index).padStart(3, '0')}-${String(1000 + ((index * 37) % 9000)).padStart(4, '0')}`;
  const base = {
    businessName: p.businessName,
    businessType: p.businessType,
    description: p.description,
    phone,
    email: `contact@${p.display}.example.com`,
    website: `https://www.${p.display}.example.com`,
    address: p.address,
    city: loc.city,
    state: loc.state,
    zipCode: loc.zipCode,
    latitude: +(loc.lat + jitter()).toFixed(5),
    longitude: +(loc.lng + jitter()).toFixed(5),
    yearEstablished: p.year,
    hoursOfOperation: p.hours || null,
    isActive: true,
    viewCount: pickInt(rng, 180, 2600),
    contactCount: pickInt(rng, 6, 95),
  };
  if (!approved) {
    return { ...base, verificationStatus: 'PENDING', verificationLevel: 'UNVERIFIED', isFeatured: false, subscriptionStatus: null };
  }
  const billing = p.subscription === 'trialing'
    ? { subscriptionStatus: 'trialing', trialEndsAt: daysFromNow(12), trialUsedAt: new Date(), currentPeriodEnd: daysFromNow(12) }
    : { subscriptionStatus: 'active', trialUsedAt: daysFromNow(-200), trialEndsAt: daysFromNow(-170), currentPeriodEnd: daysFromNow(21) };
  return {
    ...base,
    verificationStatus: 'APPROVED',
    verifiedAt: daysFromNow(-pickInt(rng, 60, 500)),
    verificationLevel: p.level,
    isFeatured: !!p.featured,
    ...billing,
  };
}

function listingData(l, business, provider) {
  const [priceRange, priceMin, priceMax] = l.price;
  const data = {
    name: l.name,
    description: l.desc,
    shortDescription: (l.short || '').slice(0, 200),
    priceRange,
    priceMin: priceMin ?? null,
    priceMax: priceMax ?? null,
    ageGroups: l.ages || [],
    duration: l.duration || null,
    frequency: l.frequency || null,
    insuranceAccepted: !!(l.insurance && l.insurance.length),
    insuranceProviders: l.insurance || [],
    languages: l.languages || ['English'],
    isActive: true,
    isAvailable: true,
    listingType: l.type,
    verificationLevel: provider.level || 'UNVERIFIED',
    deliveryMode: l.delivery || null,
    // shop
    condition: l.shop ? l.shop.condition : null,
    isForRent: !!(l.shop && l.shop.rent),
    brand: l.shop ? l.shop.brand : null,
    // school
    enrollmentStatus: l.school ? l.school.enrollment : null,
    gradeLevels: l.school ? l.school.grades : [],
    programType: l.school ? l.school.program : null,
    // event
    isVirtual: !!(l.event && l.event.virtual),
    rsvpCount: l.event ? (l.event.rsvp || 0) : 0,
    capacity: l.event ? (l.event.capacity || null) : (l.capacity || null),
    startDate: l.event ? daysFromNow(l.event.startDays) : null,
    endDate: l.event && l.event.lengthDays ? daysFromNow(l.event.startDays + l.event.lengthDays) : null,
  };
  return data;
}

async function seedReviews(serviceRows, familyIds) {
  // Rebuild all demo reviews from scratch (idempotent), then recompute aggregates.
  await prisma.review.deleteMany({ where: { user: { email: { endsWith: '@example.test' } } } });

  const rows = [];
  for (const svc of serviceRows) {
    const rng = rngFor(`reviews:${svc.businessId}:${svc.slug}`);
    const count = svc.reviewTarget !== undefined
      ? svc.reviewTarget
      : svc.listingType === 'EVENT' ? pickInt(rng, 1, 4) : pickInt(rng, 2, 6);
    // Sample distinct reviewers for this listing.
    const shuffled = [...familyIds].sort(() => rng() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const snippet = REVIEW_POOL[pickInt(rng, 0, REVIEW_POOL.length - 1)];
      const withPros = rng() < 0.55;
      const withCons = snippet.rating <= 4 && rng() < 0.5;
      rows.push({
        userId: shuffled[i],
        businessId: svc.businessId,
        serviceId: svc.id,
        rating: snippet.rating,
        title: snippet.title,
        content: snippet.content,
        pros: withPros ? [PROS_POOL[pickInt(rng, 0, PROS_POOL.length - 1)]] : [],
        cons: withCons ? [CONS_POOL[pickInt(rng, 0, CONS_POOL.length - 1)]] : [],
        isVerified: rng() < 0.4,
        isPublished: true,
        helpfulCount: pickInt(rng, 0, 14),
        createdAt: daysFromNow(-pickInt(rng, 14, 540)),
      });
    }
  }
  if (rows.length) await prisma.review.createMany({ data: rows, skipDuplicates: true });

  // Recompute per-listing aggregates.
  const byService = await prisma.review.groupBy({
    by: ['serviceId'],
    where: { serviceId: { in: serviceRows.map((s) => s.id) }, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const svcAgg = new Map(byService.map((g) => [g.serviceId, g]));
  for (const svc of serviceRows) {
    const agg = svcAgg.get(svc.id);
    await prisma.service.update({
      where: { id: svc.id },
      data: {
        averageRating: agg ? +agg._avg.rating.toFixed(2) : null,
        totalReviews: agg ? agg._count._all : 0,
      },
    });
  }

  // Recompute per-business aggregates.
  const businessIds = [...new Set(serviceRows.map((s) => s.businessId))];
  const byBusiness = await prisma.review.groupBy({
    by: ['businessId'],
    where: { businessId: { in: businessIds }, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const bizAgg = new Map(byBusiness.map((g) => [g.businessId, g]));
  for (const id of businessIds) {
    const agg = bizAgg.get(id);
    await prisma.business.update({
      where: { id },
      data: {
        averageRating: agg ? +agg._avg.rating.toFixed(2) : null,
        totalReviews: agg ? agg._count._all : 0,
      },
    });
  }
  return rows.length;
}

async function main() {
  console.log('Seeding stakeholder demo data (all listing types)...\n');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await removeOldFakeAccounts();
  const disabilityIds = await ensureDisabilities();
  const serviceTypeIds = await ensureServiceTypes();
  const familyIds = await upsertFamilies(passwordHash);
  console.log(`Reference data ready: ${disabilityIds.size} disabilities, ${serviceTypeIds.size} subcategories, ${familyIds.length} family accounts.\n`);

  const serviceRows = []; // { id, slug, businessId, listingType, reviewTarget }
  const allProviders = [
    ...PROVIDERS.map((p) => ({ ...p, approved: true })),
    ...PENDING_PROVIDERS.map((p) => ({ ...p, approved: false, listings: [] })),
  ];

  let bizCount = 0;
  for (let i = 0; i < allProviders.length; i++) {
    const p = allProviders[i];
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.owner, password: passwordHash, role: 'BUSINESS', isActive: true, emailVerified: new Date() },
      create: { email: p.email, name: p.owner, password: passwordHash, role: 'BUSINESS', isActive: true, emailVerified: new Date() },
      select: { id: true },
    });

    const data = businessData(p, i, p.approved);
    const business = await prisma.business.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
      select: { id: true },
    });
    bizCount++;

    await prisma.businessDisability.deleteMany({ where: { businessId: business.id } });
    await prisma.businessDisability.createMany({
      data: p.disabilities.map((slug, pos) => ({
        businessId: business.id,
        disabilityId: disabilityIds.get(slug),
        isPrimary: pos === 0,
        experience: pickInt(rngFor(`${p.email}:${slug}`), 3, 18),
      })),
      skipDuplicates: true,
    });

    for (const l of p.listings) {
      const slug = slugify(l.name);
      const ldata = listingData(l, business, p);
      const service = await prisma.service.upsert({
        where: { businessId_slug: { businessId: business.id, slug } },
        update: ldata,
        create: { businessId: business.id, slug, ...ldata },
        select: { id: true },
      });
      serviceRows.push({ id: service.id, slug, businessId: business.id, listingType: l.type, reviewTarget: l.reviews });

      await prisma.serviceTypeMap.deleteMany({ where: { serviceId: service.id } });
      await prisma.serviceTypeMap.createMany({
        data: l.sub.map((name, pos) => ({ serviceId: service.id, serviceTypeId: serviceTypeIds.get(name), isPrimary: pos === 0 })),
        skipDuplicates: true,
      });

      const listingDisabilities = (l.disabilities || p.disabilities).filter((s) => disabilityIds.has(s));
      await prisma.serviceDisability.deleteMany({ where: { serviceId: service.id } });
      await prisma.serviceDisability.createMany({
        data: listingDisabilities.map((s, pos) => ({ serviceId: service.id, disabilityId: disabilityIds.get(s), isPrimary: pos === 0 })),
        skipDuplicates: true,
      });
    }
    console.log(`${p.approved ? 'OK ' : 'PEN'} ${p.businessName} — ${p.listings.length} listing(s)`);
  }

  console.log('\nWriting reviews and recomputing rating aggregates...');
  const reviewCount = await seedReviews(serviceRows, familyIds);

  const byType = {};
  for (const s of serviceRows) byType[s.listingType] = (byType[s.listingType] || 0) + 1;

  console.log('\nDemo seed complete.');
  console.log(`  Businesses: ${bizCount} (${PROVIDERS.length} approved, ${PENDING_PROVIDERS.length} pending)`);
  console.log(`  Listings:   ${serviceRows.length}  ${JSON.stringify(byType)}`);
  console.log(`  Reviews:    ${reviewCount} from ${FAMILIES.length} family accounts`);
  console.log('\nLogins (all use password ' + DEFAULT_PASSWORD + '):');
  console.log('  Providers: demo.provider.01@example.test ... demo.provider.26@example.test');
  console.log('  Families:  demo.family.01@example.test ... demo.family.10@example.test');
  console.log('  Pending:   demo.pending.01@example.test, demo.pending.02@example.test');
  console.log('\nCleanup (removes everything above): DELETE FROM "User" WHERE email LIKE \'%@example.test\';');
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
