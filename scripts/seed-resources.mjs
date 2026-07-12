// Seeds a handful of starter knowledge-base resources (plan §2.2 topics) so the
// /resources page has content on day one. Idempotent — upserts by slug.
// Run: `npm run seed:resources`. Content is generic guidance, not legal advice.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const envText = readFileSync('.env.local', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  let val = m[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = val;
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });

const RESOURCES = [
  {
    slug: 'understanding-the-iep-process',
    title: 'Understanding the IEP Process',
    resourceType: 'GUIDE',
    topicTags: ['Education Rights (IEP/504)'],
    summary: 'What an Individualized Education Program is, who is involved, and how to prepare for the meeting.',
    body: `An Individualized Education Program (IEP) is a written plan for a child who qualifies for special education services.\n\nKey steps:\n1. Referral and evaluation — the school assesses eligibility.\n2. Eligibility determination — the team decides whether the child qualifies.\n3. IEP meeting — parents and school staff set goals and services.\n4. Annual review — the plan is revisited at least once a year.\n\nTips for parents:\n- Request evaluations in writing and keep copies.\n- Bring notes on your child's strengths and needs.\n- You can invite an advocate or another support person.\n- You have the right to disagree and request mediation.`,
  },
  {
    slug: '504-plan-vs-iep',
    title: '504 Plan vs. IEP: What’s the Difference?',
    resourceType: 'ARTICLE',
    topicTags: ['Education Rights (IEP/504)'],
    summary: 'A quick comparison of two common accommodations frameworks in U.S. schools.',
    body: `A 504 Plan and an IEP both support students with disabilities, but they differ:\n\nIEP (Individualized Education Program)\n- Governed by IDEA.\n- Provides specialized instruction and related services.\n- Requires measurable goals and regular progress reporting.\n\n504 Plan\n- Governed by Section 504 of the Rehabilitation Act.\n- Provides accommodations (e.g., extended time, seating) in the general classroom.\n- Broader eligibility, less paperwork.\n\nWhich one fits depends on whether a child needs specialized instruction (IEP) or accommodations to access the general curriculum (504).`,
  },
  {
    slug: 'applying-for-ssi-benefits',
    title: 'Applying for SSI Disability Benefits',
    resourceType: 'GUIDE',
    topicTags: ['Benefits & Legal Rights', 'Financial Assistance'],
    summary: 'An overview of Supplemental Security Income (SSI) eligibility and the application process.',
    body: `Supplemental Security Income (SSI) provides monthly payments to people with disabilities who have limited income and resources.\n\nBefore you apply:\n- Gather medical records, income and resource information, and Social Security numbers.\n- Note dates and providers for all relevant care.\n\nHow to apply:\n- Online, by phone, or at a local Social Security office.\n- For children, a parent/guardian applies on their behalf.\n\nIf denied, you have the right to appeal. Many claims succeed on appeal, so don't be discouraged by an initial denial.`,
  },
  {
    slug: 'navigating-insurance-for-therapy',
    title: 'Navigating Insurance for Therapy Services',
    resourceType: 'ARTICLE',
    topicTags: ['Insurance Navigation', 'Financial Assistance'],
    summary: 'How to check coverage for speech, occupational, ABA, and other therapies.',
    body: `Insurance coverage for therapies varies widely. Steps to reduce surprises:\n\n1. Call the number on your insurance card and ask specifically about the therapy type (e.g., ABA, speech, OT).\n2. Ask whether a referral or prior authorization is required.\n3. Confirm whether the provider is in-network.\n4. Ask about visit limits and copays.\n5. Request answers in writing when possible.\n\nIf a service is denied, ask about the appeals process — a letter of medical necessity from your provider often helps.`,
  },
  {
    slug: 'daily-living-routines-that-help',
    title: 'Building Daily Living Routines That Help',
    resourceType: 'GUIDE',
    topicTags: ['Daily Living Guides'],
    summary: 'Practical strategies for predictable routines, visual supports, and transitions.',
    body: `Predictable routines reduce stress and build independence.\n\nStrategies:\n- Use visual schedules (pictures or icons) for daily steps.\n- Give transition warnings ("5 more minutes").\n- Break tasks into small, concrete steps.\n- Celebrate small wins to build confidence.\n- Keep a consistent sleep and meal schedule where possible.\n\nEvery person is different — adapt these ideas to what works for your family.`,
  },
  {
    slug: 'crisis-and-support-hotlines',
    title: 'Crisis & Support Hotlines',
    resourceType: 'HOTLINE',
    topicTags: ['Crisis / Hotline Directory'],
    summary: 'Key U.S. hotlines for mental health and disability support.',
    body: `If you or someone you know is in immediate danger, call 911.\n\n988 Suicide & Crisis Lifeline\n- Call or text 988 (24/7).\n\nDisability Rights hotlines\n- Your state's Protection & Advocacy (P&A) agency can help with rights issues.\n\nParent-to-parent support\n- Many states have Family-to-Family Health Information Centers offering free guidance.\n\nThis directory is informational and not a substitute for professional or emergency care.`,
  },
];

let created = 0, updated = 0, order = 0;
try {
  for (const r of RESOURCES) {
    const existing = await prisma.resource.findUnique({ where: { slug: r.slug } });
    const data = { ...r, isPublished: true, displayOrder: order++ };
    if (existing) {
      await prisma.resource.update({ where: { slug: r.slug }, data });
      updated++;
    } else {
      await prisma.resource.create({ data });
      created++;
      console.log(`+ ${r.title}`);
    }
  }
  console.log(`\nDONE — ${created} created, ${updated} updated.`);
} finally {
  await prisma.$disconnect();
}
