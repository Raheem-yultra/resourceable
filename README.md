# Disability Services Directory

A Next.js 14 full-stack web application that connects families and individuals with disability service providers.

## Features

- **Service Search**: Filter by location, disability type, service category, and keyword
- **Business Profiles**: Verified providers can create profiles and list services
- **Messaging System**: Direct communication between users and businesses
- **Admin Dashboard**: Business verification and approval workflow
- **Authentication**: Secure NextAuth-based authentication system

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Shadcn UI
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd proj
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL`: Your PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for development)

4. Set up the database:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
proj/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── admin/         # Admin endpoints
│   │   ├── business/      # Business management
│   │   ├── messages/      # Messaging system
│   │   ├── services/      # Service CRUD
│   │   └── search/        # Search functionality
│   ├── admin/             # Admin dashboard pages
│   ├── business/          # Business profile pages
│   ├── messages/          # Chat pages
│   ├── search/            # Search page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   ├── search/           # Search components
│   ├── business/         # Business components
│   ├── chat/             # Chat components
│   └── admin/            # Admin components
├── services/             # Business logic layer
│   ├── user.service.ts
│   ├── business.service.ts
│   ├── service.service.ts
│   └── message.service.ts
├── lib/                  # Utilities
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # NextAuth config
│   ├── utils.ts          # Helper functions
│   └── validations.ts    # Zod schemas
├── prisma/
│   └── schema.prisma     # Database schema
└── types/                # TypeScript types
```

## Database Schema

### Models

- **User**: Authentication and user management
- **Business**: Business profiles with verification status
- **Service**: Services offered by businesses
- **Message**: Direct messaging between users

### Enums

- **UserRole**: USER | BUSINESS | ADMIN
- **DisabilityType**: AUTISM, DOWN_SYNDROME, ADHD, etc.
- **ServiceType**: THERAPY, EDUCATION, RESIDENTIAL, etc.
- **VerificationStatus**: PENDING | APPROVED | REJECTED

## API Routes

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login (via NextAuth)

### Business
- `GET /api/business/profile` - Get current business profile
- `PUT /api/business/profile` - Update business profile
- `GET /api/business/[id]` - Get public business profile

### Services
- `GET /api/services` - List business services
- `POST /api/services` - Create service
- `PUT /api/services/[id]` - Update service
- `DELETE /api/services/[id]` - Delete service

### Search
- `GET /api/search` - Search services with filters

### Messages
- `GET /api/messages` - Get user conversations
- `POST /api/messages` - Send message
- `GET /api/messages/[userId]` - Get conversation with user

### Admin
- `GET /api/admin/businesses/pending` - Get pending businesses
- `PATCH /api/admin/businesses/[id]/verify` - Approve/reject business

## Development

### Adding New Components

Use Shadcn CLI to add new UI components:
```bash
npx shadcn-ui@latest add [component-name]
```

### Database Migrations

After modifying `schema.prisma`:
```bash
npx prisma migrate dev --name description_of_changes
npx prisma generate
```

### Running Prisma Studio

To view/edit database data:
```bash
npx prisma studio
```

## Deployment

### Environment Variables

Ensure all production environment variables are set:
- DATABASE_URL (production database)
- NEXTAUTH_SECRET (strong secret)
- NEXTAUTH_URL (production URL)

### Build

```bash
npm run build
npm start
```

## User Roles

1. **USER**: Can search services, view profiles, and message businesses
2. **BUSINESS**: Can create profile, list services, receive messages
3. **ADMIN**: Can approve/reject business verification

## Security Features

- Password hashing with bcrypt
- JWT-based session management
- Protected API routes with role-based access
- Server-side authentication checks

## Future Enhancements

- Real-time messaging with WebSockets
- File uploads for business logos
- Reviews and ratings system
- Advanced search with geolocation
- Email notifications
- Calendar integration for appointments

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
