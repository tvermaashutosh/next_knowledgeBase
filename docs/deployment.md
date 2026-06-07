# Deployment Guide

## Stack

| Service | Provider | Tier |
|---------|----------|------|
| App Hosting | Vercel | Free (Hobby) |
| Database | Supabase PostgreSQL + pgvector | Free tier (500MB) |
| Auth | Supabase Auth (Google OAuth) | Free tier (50K MAUs) |
| LLM | OpenAI / Gemini / Claude | Pay-per-use |

## Vercel Deployment

### 1. Connect Repository

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Deploy
vercel --prod
```

Or connect via Vercel Dashboard → Import Git Repository.

### 2. Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase pooler URL (port 6543) |
| `DIRECT_URL` | Supabase direct URL (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[project].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

### 3. Build Settings

- Framework: Next.js (auto-detected)
- Build Command: `next build`
- Output: `.next`
- Install Command: `npm install`

### 4. Post-Deploy

```bash
# Push schema (if not already done)
npx prisma db push

# Generate client
npx prisma generate

# Run seed (optional)
npx tsx prisma/seed.ts
```

## Supabase Setup Checklist

- [x] Create project (free tier)
- [x] Enable pgvector extension
- [x] Add vector column + HNSW index
- [x] Enable Google OAuth provider
- [x] Set Google OAuth redirect URI
- [ ] Enable Row Level Security (optional, for multi-tenant isolation)

## Domain Setup (Optional)

1. Vercel Dashboard → Settings → Domains → Add domain
2. Update DNS: CNAME record → `cname.vercel-dns.com`
3. Update Supabase OAuth redirect URI to match new domain

## Monitoring

- **Vercel**: Built-in analytics, logs, and error tracking
- **Supabase**: DB metrics, auth logs, API usage
- **Audit Log**: Built-in at `/api/audit` (admin-only)
