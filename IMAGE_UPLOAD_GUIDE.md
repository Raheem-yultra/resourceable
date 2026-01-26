# Image & Logo Upload Guide for ResourceAble

## 📁 File Structure for Images

All static images should be placed in the `public` folder. Next.js automatically serves files from this directory.

```
proj/
├── public/
│   ├── logo.png or logo.svg          # Main site logo
│   ├── logo-white.png                # White version for dark backgrounds
│   ├── favicon.ico                   # Browser tab icon
│   ├── images/
│   │   ├── hero-background.jpg       # Landing page hero image
│   │   ├── placeholder-avatar.png    # Default user avatars
│   │   └── ...other images
```

---

## 🎨 1. Site Logo (Header/Navbar)

### Current Location:
The logo appears in the header component at: `components/ui/header-2.tsx`

### How to Add Your Logo:

1. **Prepare your logo:**
   - Recommended formats: PNG (with transparent background) or SVG
   - Recommended size: 150-200px width, 40-60px height
   - Create two versions if needed:
     - `logo.png` - Color version for light backgrounds
     - `logo-white.png` - White version for dark backgrounds

2. **Place the file:**
   ```
   Save to: public/logo.png
   ```

3. **Update the header component:**
   - File: `components/ui/header-2.tsx`
   - Find the logo section (around line 60-80)
   - Replace the text with an image

**Current code (text-based):**
```tsx
<Link href={homeLink} className="text-xl font-bold">
  ResourceAble
</Link>
```

**Updated code (with logo):**
```tsx
<Link href={homeLink} className="flex items-center gap-2">
  <img 
    src="/logo.png" 
    alt="ResourceAble" 
    className="h-10 w-auto"
  />
</Link>
```

**Or use Next.js Image component (recommended):**
```tsx
import Image from 'next/image';

<Link href={homeLink} className="flex items-center gap-2">
  <Image 
    src="/logo.png" 
    alt="ResourceAble" 
    width={150}
    height={40}
    className="h-10 w-auto"
    priority
  />
</Link>
```

---

## 🏠 2. Landing Page Images

### Hero Section Background
**File:** `app/page.tsx`

Add a hero background image:

1. **Add your image:**
   ```
   Save to: public/images/hero-background.jpg
   ```

2. **Update the hero section:**
   Find the hero section (look for the gradient background) and add:
   ```tsx
   <div 
     className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white py-24"
     style={{
       backgroundImage: 'url(/images/hero-background.jpg)',
       backgroundSize: 'cover',
       backgroundPosition: 'center'
     }}
   >
     <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 via-purple-600/90 to-pink-600/90"></div>
     <div className="relative container mx-auto px-4 text-center">
       {/* Your hero content */}
     </div>
   </div>
   ```

### Feature Icons/Images
Add icons or images for the features section:

1. **Add images:**
   ```
   Save to: public/images/feature-1.png
   Save to: public/images/feature-2.png
   Save to: public/images/feature-3.png
   ```

2. **Use in features section:**
   ```tsx
   <Image 
     src="/images/feature-1.png" 
     alt="Feature description"
     width={64}
     height={64}
   />
   ```

---

## 👤 3. User Profile Images

### Default Avatar
Users without profile pictures should see a default avatar.

1. **Add default avatar:**
   ```
   Save to: public/images/default-avatar.png
   ```

2. **Usage in components:**
   ```tsx
   <img 
     src={user.image || '/images/default-avatar.png'} 
     alt={user.name}
     className="h-10 w-10 rounded-full"
   />
   ```

---

## 🏢 4. Business Logos

Businesses can upload their logos through the business profile form. These are stored in the database as URLs (you'll need cloud storage for this).

### Current Implementation:
- File: `components/business/BusinessProfileForm.tsx`
- Logo field exists but stores as text URL

### To Enable File Uploads:

You'll need a cloud storage service. Here are the options:

#### Option A: Cloudinary (Recommended - Free tier available)

1. **Sign up:** https://cloudinary.com/
2. **Install package:**
   ```bash
   npm install cloudinary next-cloudinary
   ```

3. **Add environment variables to `.env`:**
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Create upload component:**
   ```tsx
   // components/upload/ImageUpload.tsx
   'use client';
   
   import { CldUploadWidget } from 'next-cloudinary';
   import { useState } from 'react';
   import Image from 'next/image';
   
   interface ImageUploadProps {
     value?: string;
     onChange: (value: string) => void;
     label?: string;
   }
   
   export function ImageUpload({ value, onChange, label }: ImageUploadProps) {
     const [uploading, setUploading] = useState(false);
   
     return (
       <div className="space-y-2">
         {label && <label className="text-sm font-medium">{label}</label>}
         
         <CldUploadWidget
           uploadPreset="your_upload_preset"
           onSuccess={(result: any) => {
             onChange(result.info.secure_url);
             setUploading(false);
           }}
           onUploadAdded={() => setUploading(true)}
         >
           {({ open }) => (
             <div>
               {value && (
                 <div className="mb-4">
                   <Image 
                     src={value} 
                     alt="Upload preview" 
                     width={200} 
                     height={200}
                     className="rounded-lg border"
                   />
                 </div>
               )}
               <button
                 type="button"
                 onClick={() => open()}
                 disabled={uploading}
                 className="px-4 py-2 bg-primary text-white rounded-lg"
               >
                 {uploading ? 'Uploading...' : value ? 'Change Image' : 'Upload Image'}
               </button>
             </div>
           )}
         </CldUploadWidget>
       </div>
     );
   }
   ```

#### Option B: AWS S3

1. **Set up S3 bucket**
2. **Install AWS SDK:**
   ```bash
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

3. **Create upload API route:**
   ```typescript
   // app/api/upload/route.ts
   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
   import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
   
   const s3Client = new S3Client({
     region: process.env.AWS_REGION!,
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     },
   });
   
   export async function POST(request: Request) {
     // Handle file upload
   }
   ```

#### Option C: Vercel Blob (Easiest for Vercel deployment)

1. **Install:**
   ```bash
   npm install @vercel/blob
   ```

2. **Create upload route:**
   ```typescript
   // app/api/upload/route.ts
   import { put } from '@vercel/blob';
   import { NextResponse } from 'next/server';
   
   export async function POST(request: Request) {
     const { searchParams } = new URL(request.url);
     const filename = searchParams.get('filename');
     
     const blob = await put(filename!, request.body!, {
       access: 'public',
     });
     
     return NextResponse.json(blob);
   }
   ```

3. **Use in your form:**
   ```tsx
   const handleFileUpload = async (file: File) => {
     const response = await fetch(
       `/api/upload?filename=${file.name}`,
       {
         method: 'POST',
         body: file,
       }
     );
     
     const { url } = await response.json();
     setLogoUrl(url);
   };
   ```

---

## 🌐 5. Favicon (Browser Tab Icon)

1. **Create your favicon:**
   - Use a tool like https://favicon.io/ or https://realfavicongenerator.net/
   - Generate multiple sizes for different devices

2. **Replace existing favicons:**
   ```
   public/
   ├── favicon.ico           # 16x16, 32x32, 48x48
   ├── apple-touch-icon.png  # 180x180 for iOS
   ├── favicon-16x16.png
   ├── favicon-32x32.png
   └── android-chrome-192x192.png
   ```

3. **Update `app/layout.tsx` if needed:**
   ```tsx
   export const metadata: Metadata = {
     title: 'ResourceAble',
     description: 'Connect with disability service providers',
     icons: {
       icon: '/favicon.ico',
       apple: '/apple-touch-icon.png',
     },
   };
   ```

---

## 📊 6. Service/Business Images

For service listings and business profiles, you'll want to allow image uploads. Follow the same pattern as business logos (Option A, B, or C above).

### Implementation Steps:

1. **Update the service form** (`components/business/ServiceForm.tsx` if it exists)
2. **Add image field to the Service model** (already exists as `imageUrl` in schema)
3. **Use the ImageUpload component** to let businesses add service images

---

## 🎯 Quick Start Checklist

### Immediate Steps (No coding required):

- [ ] Create a logo (PNG or SVG, transparent background)
- [ ] Save it as `public/logo.png`
- [ ] Create a favicon using https://favicon.io/
- [ ] Save favicon files to `public/` folder
- [ ] Update header component to use logo image

### Next Steps (Requires setup):

- [ ] Choose a cloud storage provider (Cloudinary, AWS S3, or Vercel Blob)
- [ ] Set up account and get API keys
- [ ] Add environment variables to `.env`
- [ ] Implement image upload component
- [ ] Add upload functionality to business profile form

---

## 🔧 File Upload Best Practices

1. **Image Optimization:**
   - Use Next.js `Image` component for automatic optimization
   - Compress images before uploading (use https://tinypng.com/)
   - Recommended formats: WebP, PNG, JPEG

2. **Size Limits:**
   - Logos: Max 2MB
   - Hero images: Max 5MB
   - Profile pictures: Max 2MB
   - Compress large images

3. **Accessibility:**
   - Always include `alt` text
   - Use descriptive filenames
   - Ensure sufficient color contrast

4. **Security:**
   - Validate file types on upload
   - Scan for malicious content
   - Use signed URLs for private images

---

## 📝 Example: Complete Logo Update

Here's exactly what to do to add your logo to the header:

1. **Save your logo:**
   - Place `logo.png` in the `public` folder

2. **Edit `components/ui/header-2.tsx`:**

Find this section (around line 60-80):
```tsx
<Link href={homeLink} className="text-xl font-bold">
  ResourceAble
</Link>
```

Replace with:
```tsx
<Link href={homeLink} className="flex items-center">
  <img 
    src="/logo.png" 
    alt="ResourceAble" 
    className="h-10 w-auto"
  />
</Link>
```

3. **Refresh your browser** - Your logo should now appear!

---

## 🆘 Need Help?

If you encounter any issues:

1. **Check the browser console** for errors (F12 → Console tab)
2. **Verify file paths** - Files in `public/` are accessed with `/filename.ext`
3. **Check file permissions** - Make sure files are readable
4. **Clear cache** - Hard refresh with Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## 🚀 Ready to Deploy?

Once you've added all your images:

1. **Commit to Git:**
   ```bash
   git add public/
   git commit -m "Add logo and images"
   git push
   ```

2. **Deploy to Vercel** - Images will be automatically deployed with your site!

For user-uploaded content (business logos, profile pictures), set up cloud storage before going to production.
