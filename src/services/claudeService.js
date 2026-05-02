// Calls go through our serverless function so the API key stays on the server.
// In production (Vercel) this is /api/claude. In local dev, run `vercel dev` to serve both Vite + the API.
const API_URL = '/api/claude';
const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(prompt, maxTokens = 512, temperature = 0) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature, // 0 = deterministic; same input → same output
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.find((b) => b.type === 'text')?.text ?? '';
}

function parseJSON(text, fallback) {
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]); } catch { return fallback; }
}

function buildProfileBlock(profile) {
  return [
    profile.name && `Name: ${profile.name}`,
    profile.email && `Email: ${profile.email}`,
    profile.phone && `Phone: ${profile.phone}`,
    profile.address && `Location: ${profile.address}`,
    profile.linkedin && `LinkedIn: ${profile.linkedin}`,
    profile.github && `GitHub: ${profile.github}`,
    profile.website && `Website: ${profile.website}`,
    profile.languages && `Languages: ${profile.languages}`,
  ].filter(Boolean).join('\n');
}

function buildJobBlock(job) {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location && `Location: ${job.location}`,
    job.requirements?.length && `Tags: ${job.requirements.join(', ')}`,
    job.description && `\nFull Job Description:\n${job.description.slice(0, 5000)}`,
  ].filter(Boolean).join('\n');
}

// Fetch a job posting URL via our serverless proxy and return the cleaned text.
// Server-side fetch avoids browser CORS and avoids depending on a third-party proxy.
export async function fetchJobUrl(url) {
  const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Could not fetch URL (${res.status}). Try pasting the job text directly.`);
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// Have Claude extract structured job data from raw text (URL-fetched HTML or pasted text)
export async function extractJobFromText(rawText, sourceUrl = '') {
  if (!rawText.trim()) throw new Error('No job text provided.');

  const text = await callClaude(
    `Extract structured info from this job posting. The text may contain noise (nav, ads, footer) — focus on the actual listing.

If a field is missing, leave it as an empty string. Description should be the full role description (responsibilities + requirements + qualifications), cleaned and readable.

TEXT:
${rawText.slice(0, 8000)}

Return ONLY valid JSON:
{
  "title": "",
  "company": "",
  "location": "",
  "description": "",
  "requirements": []
}`,
    2000
  );

  const job = parseJSON(text, { title: '', company: '', location: '', description: '', requirements: [] });
  return { ...job, url: sourceUrl, source: sourceUrl ? new URL(sourceUrl).hostname : 'pasted' };
}

// Tailor resume against a parsed job listing — returns structured JSON for proper rendering
export async function tailorResume(profile, experience, job) {
  const contactParts = [profile.address, profile.email, profile.phone].filter(Boolean);
  const linkParts = [profile.linkedin, profile.github, profile.website].filter(Boolean);

  const text = await callClaude(
    `Build an ATS-OPTIMIZED resume tailored for this specific job. The goal: when an HR screener or AI tool scans this resume against the job description, it should rank in the top tier of matches. Use ONLY the candidate's actual experience — do not invent skills they don't have.

==== HEADER (FIXED — copy these EXACT values into the JSON header field) ====
name: "${profile.name || ''}"
contact: ${JSON.stringify(contactParts)}
links: ${JSON.stringify(linkParts)}
languages: "${profile.languages || ''}"

==== STEP 1 — INTERNAL ANALYSIS (do this silently before writing) ====
Before writing the resume, internally identify from the JOB LISTING:
- HARD requirements: must-have skills, tools, technologies, certifications, years of experience
- SOFT requirements: preferred / nice-to-have skills
- KEY TOOLS & TECH (exact names + casing): e.g. "PostgreSQL" not "Postgres", "JavaScript" not "JS", "React.js" if they wrote it that way
- ACTION VERB STYLE: does the JD use "Built / Designed / Architected" or "Develop / Maintain / Support"? Mirror it.
- DOMAIN KEYWORDS: industry-specific terms (e.g. "ETL pipelines", "A/B testing", "stakeholder communication", "agile sprints")

Then cross-reference against the EXPERIENCE BANK to find legitimate matches.

==== STEP 2 — KEYWORD INJECTION RULES (ATS optimization) ====
- Use the JD's EXACT terminology and casing where the candidate genuinely has the skill (PostgreSQL ≠ Postgres ≠ postgres for ATS)
- Aim for the top 10-15 JD keywords to each appear AT LEAST ONCE in the resume (in skills, bullets, or summary) — but only if the candidate actually has that skill
- Front-load the highest-priority keywords: the FIRST bullet of each entry, the summary, and the skills section get the heaviest keyword density
- Mirror the JD's action verb style — if the JD says "Develop and maintain", use those verbs in your bullets where applicable
- If the JD lists qualifications as a numbered/bulleted list, ensure each item the candidate has is reflected somewhere visible
- DO NOT keyword-stuff or claim skills the candidate doesn't actually have — ATS catches incoherent stuffing, and recruiters definitely do

==== STEP 3 — RELEVANCE ORDERING + AGGRESSIVE CUTTING ====
- Within EXPERIENCE: order entries by RELEVANCE to this specific job, not chronologically. Most relevant role first, even if older.
- Within PROJECTS: same — most relevant project first.
- Within each entry, the FIRST bullet must be the strongest direct match to the JD's must-have requirements.
- If projects are more relevant than work experience (common for students), still keep both sections in standard order so ATS parses correctly.

CUT ENTRIES THAT DO NOT HELP THIS APPLICATION:
- For each experience/project, ask: "Does this bullet or entry give the recruiter a reason to interview this person FOR THIS SPECIFIC JOB?" If no — cut it.
- Drop work experience that has zero transferable angle to this job (e.g. an unrelated retail job applying for a research role)
- Drop projects that don't demonstrate any skill the JD asks for
- Drop coursework that isn't relevant to the role
- KEEP unrelated experience ONLY if you can credibly reframe it via transferable skills (communication, leadership, technical rigor under deadline). If you can't reframe it without sounding forced, cut it.
- Floor: keep at least 1 experience entry and 1 project so the resume isn't empty. Otherwise be ruthless.

REFRAME — DON'T REUSE:
- The same experience entry should look noticeably different across two different job tailorings
- Each bullet should be rewritten to mirror the LANGUAGE of THIS specific JD, not just kept verbatim from the experience bank
- If the same project appears in two tailorings, the bullets, framing, and tech-stack emphasis should be visibly different

==== STEP 4 — STRUCTURE (ATS-PARSER-FRIENDLY) ====
- Use EXACT standard section names — ATS systems look for these: SUMMARY, EDUCATION, TECHNICAL SKILLS, EXPERIENCE, PROJECTS
- Skills must be categorized (e.g. "Languages & Querying", "Data Science & ML", "Tools & Platforms", "Cloud & Infrastructure") — categorization helps ATS classify
- Categories should reflect what the JOB emphasizes (if JD focuses on cloud, have a "Cloud & Infrastructure" category populated)
- Summary: 2 dense lines mirroring the JD's required qualifications using the candidate's real background — pack 3-4 high-priority keywords here
- Use plain text only — no symbols, fancy characters, or anything an ATS parser might choke on
- Use real dates exactly as in the experience bank — never fabricate

==== STEP 5 — BULLETS THAT WIN ====
- Format: [Action verb from JD style] + [WHAT you did using JD-keyword tech] + [HOW measured / quantified result]
- Example given JD wants "Python, SQL, ETL pipelines" and candidate has worked on data ingestion:
  Weak: "Built data tools using Python"
  Strong: "Designed and shipped Python ETL pipelines processing 13F filings from SEC EDGAR API into PostgreSQL, with automated dedup and validation reducing manual review by 80%"
- Quantify everything possible (numbers, percentages, scale, time saved, accuracy)
- Skip filler ("Responsible for X") — start with a verb that matches the JD's voice

==== ONE-PAGE CONSTRAINT (CRITICAL) ====
The final resume MUST fit on a single page. Be ruthless about brevity:
- Summary: 2 lines maximum, no fluff (~30 words total)
- Each bullet: 1 line ideal, never more than 2 lines (~22 words max)
- Most relevant experience entry: up to 3 bullets
- All other experience entries: 2 bullets
- Most relevant project: up to 3 bullets
- All other projects: 2 bullets
- HARD CAP: total experience entries = 3 max (drop the least relevant if more)
- HARD CAP: total projects = 3 max (drop the least relevant if more)
- Skills: max 3 categorized rows, each row ≤ 10 items
- Education: school, degree, dateRange. Coursework only if directly tied to the role (≤ 8 courses)

==== CONTENT RULES ====
- Include all substantive jobs, projects, and education from the experience bank — but trim per the caps above
- Each bullet should answer: WHAT did you do, HOW (tech/method), and SO-WHAT (impact/scale) — densely
- Skip filler like "Responsible for X" — start with the verb
- DO NOT add parenthetical descriptors, focus areas, concentrations, or specializations to degrees, titles, or roles (e.g. NEVER write "B.S. Data Science (Analytics Focus)" — write "B.S. Data Science")
- Use degree, title, and company names EXACTLY as written in the experience bank — no embellishment

==== HANDLING INFORMAL / ROUGH INPUT ====
The candidate may have written their experience from memory in plain prose, not formatted resume bullets. That is expected and fine.
- Translate prose into strong resume bullets without inventing facts
- Example input: "I worked at Acme Corp from 2020 to now as an operations associate. I handle inventory, work with vendors, and trained 3 new hires."
  → Output bullets: "Managed inventory operations across 50+ SKUs weekly", "Coordinated vendor relationships for procurement and fulfillment", "Trained 3 new hires on operational workflows and internal tooling"
- If dates are missing, omit the dateRange field — never fabricate dates
- If a numerical detail is missing, write the bullet without a number rather than inventing one
- If a section (e.g. projects) is empty in the experience bank, return an empty array for it

JOB LISTING:
${buildJobBlock(job)}

FULL EXPERIENCE BANK:
${experience.slice(0, 5500)}

Return ONLY valid JSON in this EXACT shape (no markdown, no extra fields):
{
  "header": {
    "name": "",
    "contact": [],
    "links": [],
    "languages": ""
  },
  "summary": "",
  "education": [
    { "school": "", "degree": "", "dateRange": "", "coursework": "" }
  ],
  "skills": [
    { "category": "", "items": "" }
  ],
  "experience": [
    { "title": "", "company": "", "location": "", "dateRange": "", "bullets": [""] }
  ],
  "projects": [
    { "name": "", "techStack": "", "bullets": [""] }
  ],
  "match_score": 0,
  "key_changes": [""],
  "strengths": [""],
  "gaps": [""],
  "ats_keywords_hit": [""],
  "ats_keywords_missing": [""]
}

For ats_keywords_hit: list the top 8-12 important JD keywords that you successfully incorporated into the resume (because the candidate genuinely has those skills).
For ats_keywords_missing: list the top 3-5 important JD keywords that the candidate does NOT appear to have, so they know what gaps to address.`,
    5000
  );

  const result = parseJSON(text, {
    header: { name: profile.name, contact: contactParts, links: linkParts, languages: profile.languages },
    summary: '', education: [], skills: [], experience: [], projects: [],
    match_score: 0, key_changes: [], strengths: [], gaps: [],
    ats_keywords_hit: [], ats_keywords_missing: [],
  });

  // Force header to use real profile values regardless of what Claude returned
  result.header = {
    name: profile.name || result.header?.name || '',
    contact: contactParts.length > 0 ? contactParts : (result.header?.contact ?? []),
    links: linkParts.length > 0 ? linkParts : (result.header?.links ?? []),
    languages: profile.languages || result.header?.languages || '',
  };

  return result;
}

// Generate a personalized cover letter for a parsed job listing
export async function generateCoverLetter(profile, experience, job) {
  const text = await callClaude(
    `Write a personalized cover letter for this job. Use ONLY the candidate's actual experience — do not invent anything.

Rules:
- 3-4 concise paragraphs, professional but warm tone
- Open with a specific hook tied to the company or role (not generic)
- Body: 2-3 specific examples from the candidate's experience that map to the job's requirements
- Close with a brief, confident call to action
- Address to "Hiring Team at ${job.company || 'the team'}" unless a hiring manager is mentioned in the description
- No clichés like "I am writing to express my interest"
- If a skill is missing, focus on transferable strengths

PROFILE:
${buildProfileBlock(profile)}

JOB LISTING:
${buildJobBlock(job)}

FULL EXPERIENCE BANK:
${experience.slice(0, 5000)}

Return ONLY valid JSON, no markdown:
{"cover_letter":"","highlights":[""]}`,
    2500,
    0.3 // slight variation for natural prose
  );

  return parseJSON(text, { cover_letter: '', highlights: [] });
}
