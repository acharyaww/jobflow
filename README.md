# JobFlow

Save your profile and experience once. Drop a job posting URL or paste the description. Claude returns an ATS-optimized resume tailored to that role and a personalized cover letter to match.

Built with React + Vite. The Anthropic API key is held server-side via a Vercel serverless function — never exposed to the browser.

## Features

- **Profile** — save up to 3 profiles (name, contact, LinkedIn, GitHub, etc.) persisted to localStorage
- **Experience** — paste your background or write from memory using guided template chips. Save up to 3 versions.
- **Tailor** — paste a job URL (server-side fetch + parse) or paste the description text. Claude extracts structure, then tailors a resume + writes a cover letter
- **Applications** — every tailored resume/cover letter is auto-saved by company. Status tracking (Applied → Replied → Interview → Offer/Rejected), notes, and one-click "Send via Gmail" with the cover letter pre-filled
- **One-page PDF download** — fits your resume to a single page automatically with print-optimized typography
- **ATS keyword coverage** — see which job-description keywords landed in your resume and which are missing

## Tech stack

- React 19 + Vite
- Anthropic Claude API (`claude-haiku-4-5`)
- Vercel serverless functions (`/api/claude`, `/api/fetch`)
- localStorage for all user data — no database, no accounts

## Local development

You need Node 20+ and an Anthropic API key.

```bash
# 1. Install deps
npm install

# 2. Copy env template and add your key
cp .env.example .env
# Then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Install Vercel CLI (one-time)
npm install -g vercel

# 4. Run the dev server (Vite + serverless functions together)
vercel dev
```

Open the URL it prints (usually http://localhost:3000).

> Note: `npm run dev` will run only Vite. The app's API calls will fail because `/api/claude` won't exist. Use `vercel dev` for full functionality.

## Deployment

```bash
# From the project root
vercel
```

Follow the prompts. Then in the Vercel dashboard, go to **Project Settings → Environment Variables** and add:

- `ANTHROPIC_API_KEY` — your Anthropic API key

Redeploy. Done.

## Project structure

```
jobflow/
├── api/
│   ├── claude.js       # Serverless function — proxies Anthropic, holds API key
│   └── fetch.js        # Serverless function — fetches job-posting URLs server-side (bypasses CORS)
├── src/
│   ├── components/
│   │   ├── LandingView.jsx
│   │   └── InputView.jsx    # All 4 tabs + Tailor flow + resume renderer
│   ├── services/
│   │   └── claudeService.js # API client (calls /api/claude, /api/fetch)
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── package.json
└── README.md
```

## Privacy

- All your data (profile, experience, saved applications) lives in your browser's localStorage
- No server-side database, no analytics, no tracking
- The serverless functions only proxy API calls — they don't log or store request content
