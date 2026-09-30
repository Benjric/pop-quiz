# Pop Quiz

A live, Kahoot-style class quiz. The teacher uploads a test or worksheet, the questions are pulled out automatically, and students join from their phones with a 6-digit PIN or by scanning a QR code. No student accounts, no app.

- **Teacher:** sign in → upload a file (PDF, Word, Excel, CSV, text) → review the questions → choose how many to play → put the lobby on the projector.
- **Students:** open the site, enter the PIN and a name, answer on the phone.
- **After the game:** per-student and per-question results, most-missed questions, CSV export.

Everything runs on free tiers: Vercel Hobby, Neon Postgres and Ably.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, NextAuth v5 (credentials), Prisma 7 + PostgreSQL, Ably for live updates (optional; screens fall back to polling without it).

## Run locally

```bash
npm install
cp .env.example .env          # then fill it in
npx prisma migrate deploy     # create the tables
npm run seed                  # create your teacher login from ADMIN_*
npm run dev
```

Open http://localhost:3000. To try it as a student from a phone on the same Wi-Fi, open `http://<your-computer's-IP>:3000`.

`npm test` runs the unit tests (question parsing, question picking, scoring).

## Deploy to Vercel

1. Import this GitHub repo in Vercel (or run `vercel` in this folder).
2. **Database:** in the Vercel project, go to Storage → Create Database → Neon (free). It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. **Environment variables** (Settings → Environment Variables):
   - `AUTH_SECRET`: any long random string (`npx auth secret` prints one)
   - `ABLY_API_KEY`: optional; the root key of a free Ably app, for instant updates
4. Deploy. The build runs `prisma migrate deploy`, so the tables are created automatically.
5. Create your teacher login once, against the production database:
   ```bash
   vercel env pull .env.production.local
   npx dotenv-cli -e .env.production.local -- npm run seed   # with ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME set
   ```
   Running the seed again later resets that account's password.

## How live games work

The server is the only source of truth. Every move (start, next, answer, kick) goes through an API route that updates the database with a conditional write, so double clicks or two screens pressing Next can't skip a question. Ably messages only say "something changed"; each screen then re-reads its own view, so a phone never receives the correct answer early. Answers are timed on the server, with one second of grace for network lag.
