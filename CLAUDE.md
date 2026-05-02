# JobFlow — Job Application Automation

## Project Purpose
Help data science / analyst students find recent job postings (≤5 days old),
tailor resumes to job requirements, and track applications.

## Tech Stack
- Frontend: React 18 + Vite
- Styling: Inline CSS (no Tailwind, no external CSS)
- Icons: lucide-react
- AI: Anthropic Claude API (model: `claude-sonnet-4-6`)
- State: React useState/useEffect (no Redux)
- Deployment: Vercel

## Architecture

### Component Structure
- `JobApplicationSystem.jsx` — main component
- All logic in single file for simplicity
- Split only when a file exceeds ~500 lines

### State Management
- `resumes`: array of `{ id, label, content }` — user has multiple resume versions (e.g. "DS-focused", "Analyst-focused", "ML-focused")
- `activeResumeId`: id of resume currently selected as the base for tailoring (per-job override allowed)
- `jobs`: array of search results
- `tailoredResumes`: object keyed by `jobKey` → `{ tailored_resume, match_score, key_changes, strengths, gaps, source_resume_id }`
- `approvedJobs`: Set of approved job keys
- `currentView`: `'input' | 'jobs' | 'review'`

### Multi-Resume Behavior
- User pastes plain text for each resume version, assigns a short label (e.g. "DS-focused").
- 4+ versions expected; UI uses a dropdown (not tabs) for selection.
- For each job, the system auto-selects the best-matching base resume by analyzing the job description vs. resume keywords.
- User can override the auto-selected resume per job from the job card dropdown.
- Tailored output records `source_resume_id` so review/download shows which base was used.
- The auto-pick runs client-side (keyword overlap scoring) — no extra API call needed.

### API Integration
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-6`
- Tools: `web_search_20250305` for job discovery
- All API calls wrapped in try/catch

## Coding Standards

### File Naming
- Components: PascalCase (`JobApplicationSystem.jsx`)
- Utilities: camelCase (`apiHelpers.js`)
- Services: camelCase (`claudeService.js`)

### Code Style
- ES6+ (arrow functions, destructuring, template literals)
- `const` over `let`; never `var`
- `async/await` for promises
- Inline CSS with style objects
- Comments only for non-obvious logic

### React Patterns
- Functional components only
- Hooks for state and effects
- Inline handlers for trivial logic; extract when >3 lines

## API Usage Guidelines

### Job Search Queries
- Target: data science intern, data analyst intern, ML intern
- Filter: posted within last 5 days
- Return JSON with `title, company, location, posted_date, url, requirements, description`

### Resume Tailoring
- Input: selected base resume + job details
- Output: `tailored_resume, match_score, key_changes, strengths, gaps`
- Preserve original structure; emphasize relevant skills naturally; no keyword stuffing

## Error Handling
- Wrap all `fetch` calls in try/catch
- User-friendly error messages, log details to console
- Validate resume not empty before searching
- Validate JSON parsing from API responses; handle missing fields

## Git Workflow

### Branch Naming
- `feature/*` for new features
- `fix/*` for bug fixes
- `refactor/*` for code improvements

### Commits (conventional)
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code improvement
- `docs:` documentation

### Before Committing
- Manually test the feature
- No console errors
- API calls work

## Environment Variables
Required in `.env`:
```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```
`.env` is gitignored, `.env.example` is committed.

## Common Tasks

### Dev server
```bash
npm run dev
```
Runs at http://localhost:5173

### Production build
```bash
npm run build
```
Output in `/dist`.
