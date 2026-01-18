# Ashtech Pay

## Overview

Ashtech Pay is a fintech money transfer platform targeting French-speaking African markets (primarily Cameroon). The application enables users to transfer money, receive funds, create payment links, and manage their digital wallet. The platform supports Mobile Money and cryptocurrency deposits/withdrawals with XAF (Central African CFA franc) as the primary currency.

Key features include:
- User registration and authentication
- Wallet balance management
- Peer-to-peer transfers between users
- Payment link generation with unique slugs
- Transaction history tracking
- Mobile Money and crypto payment methods
- WhatsApp-style chat support system with tickets
- KYC verification with document uploads and address fields

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with dark mode default (Binance-inspired dark theme)
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Session Management**: Express-session with MemoryStore (development) / connect-pg-simple (production ready)
- **Authentication**: Session-based auth with bcrypt password hashing
- **API Pattern**: REST API endpoints prefixed with `/api`

### Data Layer
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command

### Database Schema
Three main tables:
1. **users**: Account info, balance, verification status
2. **transactions**: All financial movements (deposits, withdrawals, transfers)
3. **payment_links**: Shareable payment links with slugs

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── pages/          # Route pages
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations interface
│   └── db.ts         # Database connection
├── shared/           # Shared code (schemas, types)
└── migrations/       # Database migrations
```

### Design System
- Dark mode default with Binance-inspired color palette
- Primary accent: Golden yellow (#F0B90B)
- Background colors: #0B0E11, #1E2329
- Text: Light gray (#EAECEF)
- CSS variables for theming in `client/src/index.css`

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management

### Authentication & Security
- **bcrypt**: Password hashing
- **express-session**: Session management

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form state management
- **zod**: Schema validation (shared client/server)
- **date-fns**: Date formatting with French locale support

### Build & Development
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development