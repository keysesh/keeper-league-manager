# Keeper League Manager

A comprehensive fantasy football keeper league management platform built with Next.js. Integrates with Sleeper API to provide advanced keeper cost calculations, trade analysis, and draft planning tools.

## Features

- **Sleeper Integration**: Automatically sync leagues, rosters, and transactions from Sleeper
- **Keeper Cost Calculator**: Calculate keeper costs with support for trade deadlines, franchise tags, and cascading costs
- **Trade Analyzer**: Evaluate trade fairness with player valuations and draft pick values
- **Trade Proposals**: Create, share, and vote on trade proposals within your league
- **Draft Board**: Visualize draft capital and keeper selections across teams
- **Draft Simulation**: Plan keeper selections and see projected draft results

## Tech Stack

- **Framework**: Next.js 16.1 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Sleeper username auth
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack React Query
- **External APIs**: Sleeper API, NFLverse (stats/rankings)
- **Rate Limiting**: Upstash Redis
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 10.x or later
- PostgreSQL 16+ (or use Docker)

### Environment Variables

Create a `.env.local` file:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/keeper_league"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-32-char-secret-here"

# Optional - Rate limiting (required for production)
UPSTASH_REDIS_REST_URL="https://your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Optional - Admin API access for sync scripts
ADMIN_API_KEY="your-admin-key"
```

### Local Development

```bash
# 1. Start PostgreSQL (via Docker)
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Run database migrations
npx prisma migrate dev

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

### Running Tests

```bash
npm run test        # Watch mode
npm run test:run    # Single run
npm run test:coverage  # With coverage report
```

### Building for Production

```bash
npm run build
npm run start
```

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   ├── (admin)/           # Admin pages
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/               # Reusable UI components
│   │   └── ...               # Feature-specific components
│   └── lib/                   # Core business logic
│       ├── keeper/           # Keeper calculations
│       ├── trade/            # Trade value calculations
│       ├── sleeper/          # Sleeper API client
│       ├── nflverse/         # NFLverse data sync
│       └── sync/             # Data sync handlers
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── scripts/                   # Admin/maintenance scripts
└── public/                    # Static assets
```

## Keeper Rules

The app implements configurable keeper rules:

### Cost Calculation
- **Drafted players**: Cost = draft round
- **Undrafted (Waiver/FA)**: Cost = Round 8 (configurable)
- **Cost reduction**: -1 round per year kept
- **Minimum cost**: Round 1

### Trade Deadline Rules
- **Pre-deadline trade**: Cost reduction continues from previous owner
- **Post-deadline trade**: Cost reduction resets to 0 for new owner
- **Trade deadline**: Configurable, default Week 11

### Keeper Types
- **Regular Keeper**: Max 2 years (configurable), cost reduces each year
- **Franchise Tag**: No year limit, costs Round 1

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sleeper/sync` | POST | Sync league data from Sleeper |
| `/api/nflverse/sync` | POST | Sync player stats from NFLverse |
| `/api/leagues/[id]/keepers` | GET/POST | Manage keeper selections |
| `/api/leagues/[id]/trade/calculate` | POST | Calculate trade values |
| `/api/leagues/[id]/trade-proposals` | GET/POST | Manage trade proposals |

## Scripts

Admin scripts for maintenance (run with `npx tsx scripts/<name>.ts`):

| Script | Description |
|--------|-------------|
| `sync-nflverse-stats.ts` | Sync player stats from NFLverse |
| `recalculate-all-keepers.ts` | Recalculate all keeper costs |
| `full-resync.ts` | Full data resync from Sleeper |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test:run`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is private and not licensed for public use.
