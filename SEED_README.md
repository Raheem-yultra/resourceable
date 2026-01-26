# Seed Database Script

⚠️ **Database Connection Issue Detected**

The current Supabase credentials appear to be invalid. You'll need to:

1. **Check Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to Project Settings → Database
   - Verify the connection string is correct

2. **Update .env file** with correct credentials:
   ```
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."
   ```

3. **Run the seed script**:
   ```bash
   node scripts/seed-listings.js
   ```

## Alternative: Manual Test Data

If you want to test the search/filters immediately, you can:

1. **Sign up as 12 different businesses** using the UI at `/auth/signup`
2. **Fill out the business profile** for each at `/business/profile`
3. **As admin**, approve each business at `/admin`

Or, use this quick SQL (run in Supabase SQL Editor):

```sql
-- This will be populated once connection is working
```

## What the Seed Script Will Create:

✅ **12 Test Businesses** including:
- Bright Futures Therapy Center (ABA Therapy, Los Angeles)
- Hope Haven Learning Center (Special Education, San Diego)
- Caring Hearts Respite Services (Respite Care, San Francisco)
- Sunrise Day Program (Adult Day Program, Sacramento)
- SpeechWorks Therapy (Speech Therapy, San Jose)
- Active Life Recreation Center (Adaptive Sports, Fresno)
- Family Support Counseling (Family Therapy, Oakland)
- Early Start Intervention (Early Intervention, Long Beach)
- Skill Builders Academy (Vocational Training, Riverside)
- Sensory World Therapy (Occupational Therapy, Santa Ana)
- Harmony Music Therapy (Music Therapy, Anaheim)
- Inclusion Academy (Inclusive Education, Bakersfield)

✅ **5 Disabilities**:
- Autism Spectrum Disorder
- ADHD
- Down Syndrome
- Cerebral Palsy
- Learning Disability

✅ **5 Service Types**:
- Therapy Services
- Educational Programs
- Day Programs
- Respite Care
- Counseling

✅ **Features**:
- All businesses pre-approved
- Prices range from FREE to $2500
- Multiple age groups (Infant to Adult)
- Various locations across California
- Realistic ratings (4.0-5.0 stars)

## Test Credentials

After seeding, you can log in as any business:
- Email: `brightfutures@test.com`
- Email: `hopehaven@test.com`
- Email: `caringhearts@test.com`
- Password: `Password123!`

(All test accounts use the same password)
