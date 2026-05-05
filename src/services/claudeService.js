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
      temperature,
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
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) return fallback;
  try { return JSON.parse(match[0]); } catch { return fallback; }
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

function buildProfileHeader(profile) {
  const contact = [profile.address, profile.email, profile.phone].filter(Boolean);
  const links = [profile.linkedin, profile.github, profile.website].filter(Boolean);
  return {
    name: profile.name || '',
    contact,
    links,
    languages: profile.languages || '',
  };
}

// Fetch a job posting URL via our serverless proxy and return the cleaned text.
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

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-STEP RESUME TAILORING
// 8 sequential Claude calls, each focused on one stage.
// onProgress callback fires before each step so the UI can show what's happening.
// ═══════════════════════════════════════════════════════════════════════════

// ─── STEP 1: Job Analysis ────────────────────────────────────────────────
async function step1_analyzeJob(job) {
  const text = await callClaude(
    `Analyze this job posting and extract requirements as structured JSON.

JOB POSTING:
${buildJobBlock(job)}

Return ONLY valid JSON (no markdown):
{
  "job_title": "",
  "company": "",
  "seniority": "Entry|Mid|Senior",
  "industry": "",
  "required_skills": ["technical skill or tool, exact name + casing from the JD"],
  "preferred_skills": [""],
  "must_have_keywords": ["highest-priority terms ATS will scan for"],
  "nice_to_have_keywords": [""],
  "key_responsibilities": ["the 3-5 most important duties"],
  "action_verb_style": "the verb tone the JD uses (e.g. Built/Designed vs Develop/Maintain)",
  "domain_keywords": ["industry/role-specific terms like 'ETL pipelines', 'A/B testing'"]
}`,
    1500
  );
  return parseJSON(text, {
    job_title: job.title, company: job.company, seniority: 'Mid', industry: '',
    required_skills: [], preferred_skills: [], must_have_keywords: [], nice_to_have_keywords: [],
    key_responsibilities: [], action_verb_style: '', domain_keywords: [],
  });
}

// ─── STEP 2: Resume / Experience Analysis ────────────────────────────────
async function step2_analyzeResume(experience) {
  const text = await callClaude(
    `Extract every job, project, and skill from this candidate's experience bank. Output structured JSON. Do NOT invent anything — if a field is missing, omit it.

The input may be informal prose, not formatted resume text. Convert prose into structured data.

EXPERIENCE BANK:
${experience.slice(0, 6000)}

Return ONLY valid JSON (no markdown):
{
  "work_experience": [
    { "company": "", "title": "", "location": "", "dates": "", "raw_bullets": ["one bullet per accomplishment"] }
  ],
  "projects": [
    { "name": "", "tech_stack": "", "raw_bullets": [""] }
  ],
  "skills": {
    "languages": [],
    "frameworks_libraries": [],
    "tools_platforms": [],
    "domain_methods": [],
    "soft_skills": []
  },
  "education": [
    { "school": "", "degree": "", "dates": "", "coursework": [] }
  ]
}`,
    3000
  );
  return parseJSON(text, {
    work_experience: [], projects: [], skills: {}, education: [],
  });
}

// ─── STEP 3: Match & Score Each Item ─────────────────────────────────────
async function step3_match(jobAnalysis, resumeAnalysis) {
  const text = await callClaude(
    `Score how well each piece of the candidate's experience matches this job. INCLUDE generously — only exclude things that are truly unrelated with no transferable angle.

JOB REQUIREMENTS:
${JSON.stringify(jobAnalysis)}

CANDIDATE EXPERIENCE:
${JSON.stringify(resumeAnalysis)}

Return ONLY valid JSON:
{
  "skill_match_summary": {
    "matched_required_skills": [],
    "missing_required_skills": [],
    "matched_preferred_skills": [],
    "skill_match_percentage": 0
  },
  "work_experience_scores": [
    { "company": "", "relevance_score": 0, "why_relevant": "", "matched_keywords": [], "should_include": true }
  ],
  "project_scores": [
    { "name": "", "relevance_score": 0, "why_relevant": "", "matched_keywords": [], "should_include": true }
  ]
}

SCORING:
- 75-100: strong direct match (job-required skill demonstrated)
- 50-74: good match (related skill or transferable strength clearly applies)
- 30-49: transferable only (soft skills, work ethic, communication apply)
- 10-29: weak (only tangentially related)
- <10: truly unrelated

INCLUSION (be GENEROUS — recruiters expect to see a full candidate picture):
- should_include: true if relevance_score >= 25 OR if it's one of the candidate's only ~3-4 entries
- should_include: false ONLY if score < 25 AND there are >= 4 better entries available
- DO NOT drop work experience just because the role is in a different field — almost any job teaches transferable skills (communication, deadlines, process, attention to detail, teamwork)
- DO NOT drop a project just because the tech stack differs — the methodology often transfers (data analysis, problem-solving, building from scratch)
- A short candidate experience bank should keep ALL entries; only trim when there's abundant content`,
    2500
  );
  return parseJSON(text, {
    skill_match_summary: { matched_required_skills: [], missing_required_skills: [], matched_preferred_skills: [], skill_match_percentage: 0 },
    work_experience_scores: [], project_scores: [],
  });
}

// ─── STEP 4: Restructuring Plan ──────────────────────────────────────────
async function step4_plan(jobAnalysis, matching) {
  const text = await callClaude(
    `Plan a one-page resume that FILLS the available space. A one-page resume can comfortably hold ~600-700 words. Don't under-fill — recruiters want to see substance.

JOB:
${JSON.stringify({ title: jobAnalysis.job_title, seniority: jobAnalysis.seniority, must_have: jobAnalysis.must_have_keywords })}

RELEVANCE SCORES:
${JSON.stringify(matching)}

INCLUSION (lean toward including more, not less):
- Include ALL entries marked should_include = true
- Cap: 5 work experiences max, 4 projects max (allow up to these limits, not strict floors)
- Order each section by relevance_score descending (most relevant first)
- If the candidate has 3 or fewer of a section type, include them all regardless of score

BULLET COUNTS (target ~600 words total, fill the page):
- Top entry (highest score): 4-5 bullets
- 2nd-3rd entries: 3-4 bullets
- 4th-5th entries: 2-3 bullets
- For projects: top 2 get 3-4 bullets, others 2-3

Return ONLY valid JSON:
{
  "section_order": ["SUMMARY", "EDUCATION", "TECHNICAL SKILLS", "EXPERIENCE", "PROJECTS"],
  "work_experience_plan": [
    { "company": "", "include": true, "priority_rank": 1, "max_bullets": 4, "emphasize": ["keywords/themes to highlight"] }
  ],
  "projects_plan": [
    { "name": "", "include": true, "priority_rank": 1, "max_bullets": 3, "emphasize": [""] }
  ],
  "summary_strategy": "2-3 sentence description of how the summary should frame the candidate for this role — pack relevant keywords"
}`,
    2000
  );
  return parseJSON(text, {
    section_order: ['SUMMARY', 'EDUCATION', 'TECHNICAL SKILLS', 'EXPERIENCE', 'PROJECTS'],
    work_experience_plan: [], projects_plan: [], summary_strategy: '',
  });
}

// ─── STEP 5: Rewrite Bullets ─────────────────────────────────────────────
async function step5_rewriteBullets(jobAnalysis, resumeAnalysis, plan) {
  const text = await callClaude(
    `Rewrite the candidate's bullets to maximize relevance to THIS job. Mirror the JD's exact terminology and action verb style. Stay truthful — never fabricate.

JOB SIGNALS:
- Required skills: ${JSON.stringify(jobAnalysis.required_skills)}
- Must-have keywords: ${JSON.stringify(jobAnalysis.must_have_keywords)}
- Action verb style: ${jobAnalysis.action_verb_style}
- Domain keywords: ${JSON.stringify(jobAnalysis.domain_keywords)}

CANDIDATE EXPERIENCE BANK:
${JSON.stringify(resumeAnalysis)}

PLAN (which entries to include + how many bullets each):
${JSON.stringify({ work: plan.work_experience_plan, projects: plan.projects_plan })}

For each entry the plan keeps, write the EXACT number of bullets specified by max_bullets, ordered with the strongest match first.

Rules:
- Use the JD's exact terminology (PostgreSQL not Postgres if JD says PostgreSQL)
- Format: [Action verb in JD style] + [WHAT using JD-keyword tech] + [HOW measured]
- Each bullet 15-28 words — substantive, not minimal. Aim for the longer end if the experience supports it.
- Quantify when the experience bank has numbers; never invent metrics
- Mirror what's in "emphasize" for each entry
- Pack JD keywords organically — each bullet should hit at least 1-2 keywords from the JD when honest

Return ONLY valid JSON:
{
  "experience_bullets": [
    {
      "company": "exact match from plan",
      "title": "from experience bank",
      "location": "from experience bank or empty",
      "dateRange": "from experience bank or empty",
      "bullets": ["rewritten bullet 1", "..."]
    }
  ],
  "project_bullets": [
    {
      "name": "exact match from plan",
      "techStack": "tech list relevant to this JD",
      "bullets": [""]
    }
  ]
}`,
    4000
  );
  return parseJSON(text, { experience_bullets: [], project_bullets: [] });
}

// ─── STEP 6: Optimize Skills Section ─────────────────────────────────────
async function step6_skills(resumeAnalysis, jobAnalysis) {
  const text = await callClaude(
    `Build the TECHNICAL SKILLS section. Use only skills the candidate actually has (from their experience bank). Order by relevance to this job. Use exact casing from the JD.

CANDIDATE'S SKILLS:
${JSON.stringify(resumeAnalysis.skills)}

JOB REQUIREMENTS:
- Required: ${JSON.stringify(jobAnalysis.required_skills)}
- Preferred: ${JSON.stringify(jobAnalysis.preferred_skills)}
- Domain: ${JSON.stringify(jobAnalysis.domain_keywords)}

Constraints:
- 3 categorized rows MAX
- Each row ≤ 10 items
- Category names should reflect what THIS job emphasizes (e.g. if JD focuses on data, use "Data Science & ML" not "Programming")
- Each row's items ordered by relevance to this JD (most relevant first)

Return ONLY valid JSON:
{
  "skills": [
    { "category": "category name reflecting job emphasis", "items": "comma-separated, ordered by relevance" }
  ]
}`,
    1200
  );
  return parseJSON(text, { skills: [] });
}

// ─── STEP 7: Calculate Match Score ───────────────────────────────────────
async function step7_score(jobAnalysis, matching, rewritten, skills) {
  const text = await callClaude(
    `Score the final tailored resume against the job requirements. Be honest.

JOB REQUIREMENTS:
${JSON.stringify(jobAnalysis)}

SKILL MATCHING SUMMARY:
${JSON.stringify(matching.skill_match_summary)}

FINAL RESUME CONTENT (bullets + skills):
${JSON.stringify({ experience: rewritten.experience_bullets, projects: rewritten.project_bullets, skills })}

Calculate match using weighted formula:
- Required skills coverage (40%): % of required skills present in skills section or bullets
- Experience relevance (30%): average relevance_score from matching, normalized
- Keyword optimization (20%): % of must_have_keywords appearing somewhere in the resume
- Quantification (10%): % of bullets containing a number/percentage

Return ONLY valid JSON:
{
  "match_score": {
    "overall_percentage": 0,
    "breakdown": {
      "required_skills_coverage": 0,
      "experience_relevance": 0,
      "keyword_optimization": 0,
      "quantification_quality": 0
    },
    "category": "STRONG MATCH|GOOD MATCH|MODERATE MATCH|WEAK MATCH"
  },
  "strengths": ["specific strength 1", "..."],
  "gaps": ["specific gap, e.g. 'No direct PostgreSQL experience'", "..."],
  "key_changes": ["the most important reframings made", "..."]
}

Categories: 80+ = STRONG, 65-79 = GOOD, 50-64 = MODERATE, <50 = WEAK.`,
    1800
  );
  return parseJSON(text, {
    match_score: { overall_percentage: 0, breakdown: {}, category: 'MODERATE MATCH' },
    strengths: [], gaps: [], key_changes: [],
  });
}

// ─── STEP 8: Assemble Final Resume ───────────────────────────────────────
async function step8_assemble(profile, jobAnalysis, plan, rewritten, skills, resumeAnalysis) {
  // Steps 5/6 already produced the heavy content. Step 8 just composes the summary
  // and education + assembles the final structured object.
  const text = await callClaude(
    `Write a 2-line professional summary tailored to this job. Use ONLY traits the candidate actually demonstrates in their experience.

JOB:
- Title: ${jobAnalysis.job_title}
- Industry: ${jobAnalysis.industry}
- Must-have keywords: ${JSON.stringify(jobAnalysis.must_have_keywords)}

SUMMARY STRATEGY (from plan):
${plan.summary_strategy}

CANDIDATE EXPERIENCE (snapshot):
- Education: ${JSON.stringify(resumeAnalysis.education)}
- Top experience: ${rewritten.experience_bullets[0]?.title} at ${rewritten.experience_bullets[0]?.company}
- Top project: ${rewritten.project_bullets[0]?.name}

Constraints:
- Exactly 2 lines, ~30 words total
- Pack 3-4 of the must-have keywords if the candidate genuinely has them
- No clichés ("results-driven", "passionate")
- Lead with the candidate's strongest credential for THIS job

Return ONLY valid JSON:
{
  "summary": "two-sentence professional summary"
}`,
    400
  );
  const summaryResult = parseJSON(text, { summary: '' });

  // Build education section directly from resume analysis (no extra API call needed)
  const education = (resumeAnalysis.education || []).map((e) => ({
    school: e.school || '',
    degree: e.degree || '',
    dateRange: e.dates || '',
    // Only include coursework if at least one course matches a JD keyword
    coursework: filterRelevantCoursework(e.coursework, jobAnalysis),
  }));

  return {
    summary: summaryResult.summary,
    education,
    skills: skills.skills || [],
    experience: (rewritten.experience_bullets || []).map((e) => ({
      title: e.title || '',
      company: e.company || '',
      location: e.location || '',
      dateRange: e.dateRange || '',
      bullets: e.bullets || [],
    })),
    projects: (rewritten.project_bullets || []).map((p) => ({
      name: p.name || '',
      techStack: p.techStack || '',
      bullets: p.bullets || [],
    })),
  };
}

function filterRelevantCoursework(courses, jobAnalysis) {
  if (!Array.isArray(courses) || courses.length === 0) return '';
  const jdKeywords = [
    ...(jobAnalysis.required_skills || []),
    ...(jobAnalysis.must_have_keywords || []),
    ...(jobAnalysis.domain_keywords || []),
  ].map((k) => String(k).toLowerCase());
  const relevant = courses.filter((c) => {
    const cl = String(c).toLowerCase();
    return jdKeywords.some((kw) => cl.includes(kw) || kw.includes(cl));
  });
  return (relevant.length > 0 ? relevant : courses).slice(0, 8).join(', ');
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────
export async function tailorResume(profile, experience, job, onProgress = () => {}) {
  const STEPS = [
    { n: 1, label: 'Analyzing job posting' },
    { n: 2, label: 'Analyzing your experience bank' },
    { n: 3, label: 'Matching your fit to requirements' },
    { n: 4, label: 'Creating optimization plan' },
    { n: 5, label: 'Rewriting bullets in JD voice' },
    { n: 6, label: 'Optimizing skills section' },
    { n: 7, label: 'Calculating match score' },
    { n: 8, label: 'Assembling final resume' },
  ];
  const fire = (step, status = 'running') => onProgress({ step: step.n, total: 8, label: step.label, status });

  fire(STEPS[0]); const jobAnalysis = await step1_analyzeJob(job); fire(STEPS[0], 'done');
  fire(STEPS[1]); const resumeAnalysis = await step2_analyzeResume(experience); fire(STEPS[1], 'done');
  fire(STEPS[2]); const matching = await step3_match(jobAnalysis, resumeAnalysis); fire(STEPS[2], 'done');
  fire(STEPS[3]); const plan = await step4_plan(jobAnalysis, matching); fire(STEPS[3], 'done');
  fire(STEPS[4]); const rewritten = await step5_rewriteBullets(jobAnalysis, resumeAnalysis, plan); fire(STEPS[4], 'done');
  fire(STEPS[5]); const skills = await step6_skills(resumeAnalysis, jobAnalysis); fire(STEPS[5], 'done');
  fire(STEPS[6]); const score = await step7_score(jobAnalysis, matching, rewritten, skills); fire(STEPS[6], 'done');
  fire(STEPS[7]); const assembled = await step8_assemble(profile, jobAnalysis, plan, rewritten, skills, resumeAnalysis); fire(STEPS[7], 'done');

  // Compose final output in the shape the renderer expects
  return {
    header: buildProfileHeader(profile),
    ...assembled,
    match_score: score.match_score?.overall_percentage ?? 0,
    match_breakdown: score.match_score?.breakdown ?? {},
    match_category: score.match_score?.category ?? '',
    strengths: score.strengths || [],
    gaps: score.gaps || [],
    key_changes: score.key_changes || [],
    ats_keywords_hit: matching.skill_match_summary?.matched_required_skills || [],
    ats_keywords_missing: matching.skill_match_summary?.missing_required_skills || [],
    // Bonus diagnostic data exposed for transparency
    _pipeline: { jobAnalysis, matching, plan },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cover Letter (still single-call — short generation, no pipeline benefit)
// ═══════════════════════════════════════════════════════════════════════════
export async function generateCoverLetter(profile, experience, job) {
  const profileBlock = [
    profile.name && `Name: ${profile.name}`,
    profile.email && `Email: ${profile.email}`,
    profile.phone && `Phone: ${profile.phone}`,
    profile.address && `Location: ${profile.address}`,
    profile.linkedin && `LinkedIn: ${profile.linkedin}`,
    profile.github && `GitHub: ${profile.github}`,
    profile.website && `Website: ${profile.website}`,
    profile.languages && `Languages: ${profile.languages}`,
  ].filter(Boolean).join('\n');

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
${profileBlock}

JOB LISTING:
${buildJobBlock(job)}

FULL EXPERIENCE BANK:
${experience.slice(0, 5000)}

Return ONLY valid JSON, no markdown:
{"cover_letter":"","highlights":[""]}`,
    2500,
    0.3
  );

  return parseJSON(text, { cover_letter: '', highlights: [] });
}
