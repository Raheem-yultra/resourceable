# Project Structure - Special Needs Services Directory

## Complete File Tree

```
proj/
│
├── app/                                    # Next.js 14 App Router
│   ├── api/                               # API Routes
│   │   ├── auth/
│   │   │   ├── [...nextauth]/
│   │   │   │   └── route.ts              # NextAuth handler
│   │   │   └── signup/
│   │   │       └── route.ts              # User registration
│   │   ├── business/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts              # Get public business profile
│   │   │   └── profile/
│   │   │       └── route.ts              # Get/Update business profile
│   │   ├── services/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts              # Get/Update/Delete service
│   │   │   └── route.ts                  # List/Create services
│   │   ├── search/
│   │   │   └── route.ts                  # Search services with filters
│   │   ├── messages/
│   │   │   ├── [userId]/
│   │   │   │   └── route.ts              # Get conversation with user
│   │   │   └── route.ts                  # List conversations, send message
│   │   └── admin/
│   │       └── businesses/
│   │           ├── pending/
│   │           │   └── route.ts          # Get pending businesses
│   │           └── [id]/
│   │               └── verify/
│   │                   └── route.ts      # Approve/Reject business
│   ├── admin/
│   │   └── page.tsx                      # Admin dashboard
│   ├── business/
│   │   └── [id]/
│   │       └── page.tsx                  # Public business profile page
│   ├── messages/
│   │   └── [userId]/
│   │       └── page.tsx                  # Chat interface page
│   ├── search/
│   │   └── page.tsx                      # Search page
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Home page
│   └── globals.css                       # Global styles (Tailwind)
│
├── components/                            # React Components
│   ├── ui/                               # Shadcn UI Components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── card.tsx
│   │   └── label.tsx
│   ├── search/
│   │   ├── SearchFilters.tsx            # Search filter form
│   │   └── ServiceList.tsx              # Service listing grid
│   ├── business/
│   │   └── BusinessProfile.tsx          # Business profile display
│   ├── chat/
│   │   └── ChatInterface.tsx            # Real-time messaging UI
│   └── admin/
│       └── BusinessVerification.tsx      # Admin verification UI
│
├── services/                              # Business Logic Layer
│   ├── user.service.ts                   # User CRUD operations
│   ├── business.service.ts               # Business CRUD & verification
│   ├── service.service.ts                # Service CRUD & search
│   └── message.service.ts                # Messaging operations
│
├── lib/                                   # Utilities & Configuration
│   ├── prisma.ts                         # Prisma client singleton
│   ├── auth.ts                           # NextAuth configuration
│   ├── utils.ts                          # Helper functions (cn)
│   └── validations.ts                    # Zod validation schemas
│
├── prisma/
│   └── schema.prisma                     # Database schema
│
├── types/
│   └── next-auth.d.ts                    # NextAuth type extensions
│
├── .env                                   # Environment variables (local)
├── .env.example                           # Environment template
├── .gitignore                            # Git ignore rules
├── middleware.ts                         # Next.js middleware (auth)
├── next.config.mjs                       # Next.js configuration
├── package.json                          # Dependencies & scripts
├── postcss.config.mjs                    # PostCSS configuration
├── tailwind.config.ts                    # Tailwind configuration
├── tsconfig.json                         # TypeScript configuration
├── README.md                             # Full documentation
└── QUICKSTART.md                         # Quick start guide
```

## Component Architecture

### UI Layer (components/)
- **ui/**: Base components (Shadcn UI style)
- **search/**: Search-specific components
- **business/**: Business profile components
- **chat/**: Messaging interface components
- **admin/**: Admin dashboard components

### Service Layer (services/)
- Handles all database operations
- Business logic separation
- Reusable across API routes
- Type-safe with Prisma

### API Layer (app/api/)
- RESTful endpoints
- Request validation (Zod)
- Authentication checks
- Response formatting

## Data Flow

```
User Request
    ↓
Next.js Page (app/)
    ↓
Component (components/)
    ↓
API Route (app/api/)
    ↓
Service Layer (services/)
    ↓
Prisma Client (lib/prisma.ts)
    ↓
PostgreSQL Database
```

## Authentication Flow

```
1. User submits credentials
2. API validates with Zod schema
3. Service layer checks database
4. bcrypt verifies password
5. NextAuth creates JWT session
6. Middleware protects routes
7. Session available in pages/API
```

## Search Flow

```
1. User enters filters
2. SearchFilters component
3. API /search endpoint
4. serviceService.searchServices()
5. Prisma query with filters
6. Results returned
7. ServiceList displays cards
```

## Key Features Implementation

### 1. Search & Filter
- **Location**: `components/search/SearchFilters.tsx`
- **API**: `app/api/search/route.ts`
- **Service**: `services/service.service.ts` (searchServices method)

### 2. Business Profiles
- **Component**: `components/business/BusinessProfile.tsx`
- **Page**: `app/business/[id]/page.tsx`
- **API**: `app/api/business/[id]/route.ts`
- **Service**: `services/business.service.ts`

### 3. Messaging
- **Component**: `components/chat/ChatInterface.tsx`
- **Page**: `app/messages/[userId]/page.tsx`
- **API**: `app/api/messages/` (multiple routes)
- **Service**: `services/message.service.ts`

### 4. Admin Verification
- **Component**: `components/admin/BusinessVerification.tsx`
- **Page**: `app/admin/page.tsx`
- **API**: `app/api/admin/businesses/`
- **Service**: `services/business.service.ts` (updateVerificationStatus)

### 5. Authentication
- **Config**: `lib/auth.ts`
- **API**: `app/api/auth/[...nextauth]/route.ts`
- **Middleware**: `middleware.ts`
- **Types**: `types/next-auth.d.ts`

## Database Models

### User
- Authentication credentials
- Role (USER | BUSINESS | ADMIN)
- Relations: Business (1:1), Messages (1:N)

### Business
- Business information
- Verification status
- Relations: User (1:1), Services (1:N)

### Service
- Service details
- Types and categories
- Relations: Business (N:1)

### Message
- Chat messages
- Read status
- Relations: Sender (N:1), Receiver (N:1)

## Type Safety

- **TypeScript**: Full type coverage
- **Prisma**: Auto-generated types
- **Zod**: Runtime validation
- **NextAuth**: Extended with custom types

## State Management

- **Server Components**: Default for data fetching
- **Client Components**: Interactive UI (useState)
- **No Redux/Zustand**: Keep it simple with React state

## Styling

- **Tailwind CSS**: Utility-first styling
- **CSS Variables**: Theme customization
- **Shadcn Pattern**: Copy-paste components
- **Responsive**: Mobile-first design

## Security

- **Password Hashing**: bcrypt
- **JWT Sessions**: NextAuth
- **Route Protection**: Middleware
- **API Validation**: Zod schemas
- **Role-based Access**: User roles

## Performance

- **Server Components**: Reduce client JS
- **Dynamic Routes**: File-based routing
- **Prisma**: Efficient queries with relations
- **Edge Ready**: Can deploy to Vercel Edge

## Next Steps

1. Install dependencies: `npm install`
2. Setup database: `npx prisma migrate dev`
3. Configure environment: Copy `.env.example` to `.env`
4. Run development: `npm run dev`
5. See QUICKSTART.md for detailed setup

## File Size Summary

- **Total Files**: ~50 files
- **TypeScript**: ~40 files
- **API Routes**: 11 routes
- **Pages**: 5 pages
- **Components**: 10+ components
- **Services**: 4 service files
