# Tutor Platform V1

Tutor-only SaaS foundation for independent language tutors.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
4. Run:

```bash
npm install
npm run dev
```

V1 intentionally excludes student accounts, live collaboration, video calls, scheduling, payments, marketplace, uploads, whiteboard canvas, PDF annotation, PDF export, and AI features.
