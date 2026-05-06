import { useState, useEffect } from 'react';
import { User, FileText, Save, Check, Trash2, Briefcase, Mail, ExternalLink, Sparkles, Link2, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { fetchJobUrl, extractJobFromText, tailorResume, generateCoverLetter } from '../services/claudeService';

const C = {
  bg: '#F7F4EE', surface: '#FFFFFF', border: '#E0DBD0',
  text: '#1A1A1A', muted: '#6B6860', accent: '#22C55E', error: '#DC2626',
  accentBg: '#F0FDF4', accentDark: '#166534',
  tabActive: '#22C55E', tabInactive: '#F0EDE6',
  green: '#16A34A', red: '#DC2626',
};

const input = {
  width: '100%', backgroundColor: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 6, color: C.text, padding: '0.6rem 0.9rem',
  fontSize: '0.875rem', fontFamily: "'Inter', sans-serif",
  outline: 'none', boxSizing: 'border-box',
};

const fieldLabel = {
  display: 'block', fontSize: '0.72rem', fontWeight: 500,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem',
};

const STORAGE_KEY = 'jobflow_profiles';
const EXP_STORAGE_KEY = 'jobflow_saved_experiences';
const MAX_PROFILES = 3;
const MAX_EXPERIENCES = 3;
const emptyProfile = { name: '', email: '', phone: '', address: '', linkedin: '', github: '', website: '', languages: '' };

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function loadSavedExperiences() {
  try { return JSON.parse(localStorage.getItem(EXP_STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function experienceLabel(text, idx) {
  const trimmed = text.trim();
  if (!trimmed) return `Experience ${idx + 1}`;
  const firstLine = trimmed.split('\n')[0].trim();
  return firstLine.length > 28 ? firstLine.slice(0, 28) + '…' : firstLine;
}

function applicationKey(job) { return `${job.company}::${job.title}`; }

// Convert structured resume → plain text for .txt fallback
function resumeToText(r) {
  if (typeof r === 'string') return r;
  if (!r || typeof r !== 'object') return '';
  const lines = [];
  if (r.header?.name) lines.push(r.header.name);
  if (r.header?.contact?.length) lines.push(r.header.contact.join(' • '));
  if (r.header?.links?.length) lines.push(r.header.links.join(' • '));
  if (r.header?.languages) lines.push('Languages: ' + r.header.languages);
  if (r.summary) lines.push('', 'SUMMARY', r.summary);
  if (r.education?.length) {
    lines.push('', 'EDUCATION');
    r.education.forEach((e) => {
      lines.push(`${e.school}${e.degree ? ' — ' + e.degree : ''}${e.dateRange ? '  (' + e.dateRange + ')' : ''}`);
      if (e.coursework) lines.push(`Relevant Coursework: ${e.coursework}`);
    });
  }
  if (r.skills?.length) {
    lines.push('', 'TECHNICAL SKILLS');
    r.skills.forEach((s) => lines.push(`${s.category}: ${s.items}`));
  }
  if (r.experience?.length) {
    lines.push('', 'EXPERIENCE');
    r.experience.forEach((x) => {
      lines.push(`${x.title}${x.company ? ' | ' + x.company : ''}${x.location ? ', ' + x.location : ''}${x.dateRange ? '  (' + x.dateRange + ')' : ''}`);
      x.bullets?.forEach((b) => lines.push(`  — ${b}`));
    });
  }
  if (r.projects?.length) {
    lines.push('', 'PROJECTS');
    r.projects.forEach((p) => {
      lines.push(`${p.name}${p.techStack ? '  [' + p.techStack + ']' : ''}`);
      p.bullets?.forEach((b) => lines.push(`  — ${b}`));
    });
  }
  return lines.join('\n');
}

function downloadAsTxt(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Standalone print stylesheet — used inside the isolated print window so there's
// no modal/overlay interference. Has its own copies of the print sizes to keep
// this self-contained.
const PRINT_STYLESHEET = `
  @page { margin: 0; size: 8.5in 11in; }
  html, body { margin: 0; padding: 0; background: white; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: #000;
    padding: 0.3in 0.4in 0.5in 0.4in;
    box-sizing: border-box;
  }
  .resume-name { text-align: center; font-size: 18pt; font-weight: 700; margin: 0 0 4pt 0; line-height: 1.15; letter-spacing: 0.5pt; }
  .resume-contact { text-align: center; font-size: 10pt; margin: 0 0 6pt 0; line-height: 1.3; }
  .resume-langs { text-align: center; font-size: 9.5pt; margin: 0 0 4pt 0; color: #444; }
  .resume-section { margin-top: 8pt; }
  .resume-section-title { font-size: 10.5pt; font-weight: 700; padding-bottom: 1pt; margin-bottom: 4pt; border-bottom: 1pt solid #000; letter-spacing: 1pt; }
  .resume-item-title { font-size: 11pt; font-weight: 700; }
  .resume-summary { font-size: 10.5pt; line-height: 1.4; margin: 0 0 3pt 0; }
  .resume-coursework { font-size: 10pt; }
  .resume-skill-row { font-size: 10.5pt; margin-bottom: 2pt; }
  .resume-tech-stack { font-size: 10pt; font-style: italic; color: #222; margin-top: 2pt; }
  .resume-bullets { list-style: none; margin: 2pt 0 4pt 0; padding: 0; }
  .resume-bullet { font-size: 10.5pt; line-height: 1.35; margin-bottom: 2pt; padding-left: 1em; text-indent: -1em; }
  .resume-entry { margin-bottom: 6pt; page-break-inside: avoid; }
  .resume-row-right { font-size: 10pt; font-style: italic; }
  /* Two-column row used for entry headers (title left, date right) */
  .resume-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  .resume-row-left { flex: 1 1 65%; min-width: 0; word-break: normal; overflow-wrap: break-word; }
`;

// Print by opening a new window — fully isolated from the modal.
// Renders the resume, MEASURES actual content height in the new window, then scales
// down with CSS zoom if the content would overflow one page. This is the only reliable
// way to guarantee a one-page PDF.
function printResumeInNewWindow() {
  const root = document.getElementById('resume-printable');
  if (!root) return;
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    alert('Please allow popups in your browser to download the PDF.');
    return;
  }

  // Step 1: write content into the new window with normal styles (no zoom yet)
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Resume</title>
  <style>
    ${PRINT_STYLESHEET}
    /* Wrapper class lets us target the resume body for measurement and scaling */
    body.__resume__ { transform-origin: top left; }
  </style>
</head>
<body class="__resume__">${root.innerHTML}</body>
</html>`);
  printWindow.document.close();

  // Step 2: wait for layout, then measure the ACTUAL rendered height
  setTimeout(() => {
    const body = printWindow.document.body;
    const contentHeight = body.scrollHeight;
    const pageHeightPx = 11 * 96; // 11in × 96dpi = 1056px
    // Body has 0.5in top + bottom padding baked into the stylesheet (1in total = 96px),
    // but scrollHeight includes that padding so compare against full page height.

    // Step 3: if content overflows one page, scale via CSS zoom (most reliable for print)
    if (contentHeight > pageHeightPx) {
      const scale = Math.max(0.55, (pageHeightPx / contentHeight) * 0.97);
      body.style.zoom = String(scale);
    }

    // Step 4: trigger print dialog (user picks "Save as PDF")
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 800);
    }, 200);
  }, 400);
}

function downloadDocument(viewing) {
  if (viewing.type === 'resume') {
    const choice = window.confirm('Click OK to save as PDF (uses browser print dialog).\nClick Cancel to download as plain text (.txt).');
    if (choice) {
      printResumeInNewWindow();
    } else {
      const safeLabel = (viewing.label || 'resume').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      downloadAsTxt(`resume_${safeLabel}.txt`, resumeToText(viewing.content));
    }
  } else {
    const safeLabel = (viewing.label || 'cover_letter').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    downloadAsTxt(`cover_letter_${safeLabel}.txt`, viewing.content || '');
  }
}

function Field({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input style={input} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function InputView({ profile, onProfileChange, experience, onExperienceChange, applications = [], onApplicationsChange }) {
  const [tab, setTab] = useState('profile');
  const [viewing, setViewing] = useState(null);

  const [savedProfiles, setSavedProfiles] = useState(loadSaved);
  const [activeId, setActiveId] = useState(null);
  const [saved, setSaved] = useState(false);

  const [savedExperiences, setSavedExperiences] = useState(loadSavedExperiences);
  const [activeExpId, setActiveExpId] = useState(null);
  const [expSaved, setExpSaved] = useState(false);

  // Tailor tab state
  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [parsedJob, setParsedJob] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [coverWriting, setCoverWriting] = useState(false);
  const [tailorError, setTailorError] = useState('');
  const [resumeResult, setResumeResult] = useState(null);
  const [coverResult, setCoverResult] = useState(null);
  // Tracks step-by-step pipeline progress for the multi-stage tailoring
  // Shape: { 1: 'done', 2: 'running', ... }
  const [tailorSteps, setTailorSteps] = useState({});

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfiles)); }, [savedProfiles]);
  useEffect(() => { localStorage.setItem(EXP_STORAGE_KEY, JSON.stringify(savedExperiences)); }, [savedExperiences]);

  const p = (field) => (val) => onProfileChange((prev) => ({ ...prev, [field]: val }));

  // ===== Profile management =====
  const handleSave = () => {
    if (activeId) {
      setSavedProfiles((prev) => prev.map((sp) => sp.id === activeId ? { ...profile, id: activeId } : sp));
    } else {
      if (savedProfiles.length >= MAX_PROFILES) return;
      const id = Date.now().toString();
      setSavedProfiles((prev) => [...prev, { ...profile, id }]);
      setActiveId(id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleLoad = (sp) => {
    const { id, ...fields } = sp;
    onProfileChange(fields);
    setActiveId(id);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setSavedProfiles((prev) => prev.filter((sp) => sp.id !== id));
    if (activeId === id) {
      setActiveId(null);
      onProfileChange(emptyProfile);
    }
  };

  const handleNew = () => {
    setActiveId(null);
    onProfileChange(emptyProfile);
  };

  // ===== Experience management =====
  const handleSaveExperience = () => {
    if (!experience.trim()) return;
    if (activeExpId) {
      setSavedExperiences((prev) => prev.map((se) => se.id === activeExpId ? { id: activeExpId, text: experience } : se));
    } else {
      if (savedExperiences.length >= MAX_EXPERIENCES) return;
      const id = Date.now().toString();
      setSavedExperiences((prev) => [...prev, { id, text: experience }]);
      setActiveExpId(id);
    }
    setExpSaved(true);
    setTimeout(() => setExpSaved(false), 1800);
  };

  const handleLoadExperience = (se) => {
    onExperienceChange(se.text);
    setActiveExpId(se.id);
  };

  const handleDeleteExperience = (id, e) => {
    e.stopPropagation();
    setSavedExperiences((prev) => prev.filter((se) => se.id !== id));
    if (activeExpId === id) {
      setActiveExpId(null);
      onExperienceChange('');
    }
  };

  const handleNewExperience = () => {
    setActiveExpId(null);
    onExperienceChange('');
  };

  // ===== Applications management =====
  const upsertApplication = (job, patch) => {
    const key = applicationKey(job);
    onApplicationsChange?.((prev) => {
      const existing = prev.find((a) => a.id === key);
      const now = new Date().toISOString();
      if (existing) return prev.map((a) => a.id === key ? { ...a, ...patch, updatedAt: now } : a);
      return [
        ...prev,
        {
          id: key, company: job.company, jobTitle: job.title,
          jobUrl: job.url, jobLocation: job.location, source: job.source,
          status: 'pending', notes: '', tailoredResume: '', coverLetter: '',
          matchScore: 0, createdAt: now, updatedAt: now, ...patch,
        },
      ];
    });
  };

  const updateApplication = (id, patch) => {
    onApplicationsChange?.((prev) => prev.map((a) => a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a));
  };

  const deleteApplication = (id) => {
    onApplicationsChange?.((prev) => prev.filter((a) => a.id !== id));
  };

  const composeEmail = (app) => {
    if (!profile.email) {
      alert('Add your email in the Profile tab first.');
      return;
    }
    const subject = encodeURIComponent(`Application for ${app.jobTitle} at ${app.company}`);
    const body = encodeURIComponent(app.coverLetter || `Dear Hiring Team at ${app.company},\n\n[Add your message]\n\nBest,\n${profile.name}`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
    updateApplication(app.id, { status: 'applied' });
  };

  // ===== Tailor flow =====
  const resetTailor = () => {
    setParsedJob(null);
    setResumeResult(null);
    setCoverResult(null);
    setParseError('');
    setTailorError('');
  };

  const handleParseJob = async () => {
    setParsing(true);
    setParseError('');
    resetTailor();
    try {
      let rawText = jobText.trim();
      let sourceUrl = '';
      if (jobUrl.trim()) {
        sourceUrl = jobUrl.trim();
        rawText = await fetchJobUrl(sourceUrl);
      }
      if (!rawText) throw new Error('Paste a job URL or the job description text.');
      const job = await extractJobFromText(rawText, sourceUrl);
      if (!job.title || !job.company) {
        throw new Error('Could not extract title/company. Try pasting the job text directly.');
      }
      setParsedJob(job);
    } catch (e) {
      setParseError(e.message ?? 'Failed to parse job posting.');
    } finally {
      setParsing(false);
    }
  };

  const handleTailorResume = async () => {
    if (!parsedJob) return;
    if (!experience.trim()) { setTailorError('Add your experience first (Experience tab).'); return; }
    setTailoring(true);
    setTailorError('');
    setTailorSteps({}); // reset
    try {
      const result = await tailorResume(profile, experience, parsedJob, ({ step, status }) => {
        // Use functional update so concurrent step transitions don't drop state
        setTailorSteps((prev) => ({ ...prev, [step]: status }));
      });
      setResumeResult(result);
      upsertApplication(parsedJob, {
        tailoredResume: result,
        matchScore: result.match_score,
      });
    } catch (e) {
      setTailorError(e.message ?? 'Tailoring failed.');
    } finally {
      setTailoring(false);
    }
  };

  const handleWriteCover = async () => {
    if (!parsedJob) return;
    if (!experience.trim()) { setTailorError('Add your experience first (Experience tab).'); return; }
    setCoverWriting(true);
    setTailorError('');
    try {
      const result = await generateCoverLetter(profile, experience, parsedJob);
      setCoverResult(result);
      upsertApplication(parsedJob, { coverLetter: result.cover_letter });
    } catch (e) {
      setTailorError(e.message ?? 'Cover letter failed.');
    } finally {
      setCoverWriting(false);
    }
  };

  const tabBtn = (id, icon, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.5rem 1.1rem', border: 'none', borderRadius: 6, cursor: 'pointer',
        fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 600,
        backgroundColor: tab === id ? C.accent : C.tabInactive,
        color: tab === id ? '#FFF' : C.muted,
        transition: 'all 0.15s',
      }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, color: C.text, fontFamily: "'Inter', sans-serif", padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 800, marginBottom: '0.2rem' }}>JobFlow</h1>
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: '2rem' }}>
          Save your profile + experience. Drop a job link. Get a tailored resume and cover letter.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {tabBtn('profile', <User size={14} />, 'Profile')}
          {tabBtn('experience', <FileText size={14} />, 'Experience')}
          {tabBtn('tailor', <Sparkles size={14} />, 'Tailor')}
          {tabBtn('applications', <Briefcase size={14} />, `Applications${applications.length ? ` (${applications.length})` : ''}`)}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div>
            {savedProfiles.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {savedProfiles.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => handleLoad(sp)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.9rem', border: `1px solid ${activeId === sp.id ? C.accent : C.border}`,
                      borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      fontSize: '0.82rem', fontWeight: 600,
                      backgroundColor: activeId === sp.id ? C.accentBg : C.surface,
                      color: activeId === sp.id ? C.accentDark : C.text,
                    }}
                  >
                    <User size={12} />
                    {sp.name || `Profile ${savedProfiles.indexOf(sp) + 1}`}
                    <span onClick={(e) => handleDelete(sp.id, e)} style={{ display: 'flex', alignItems: 'center', color: C.muted, marginLeft: '0.1rem', cursor: 'pointer' }}>
                      <Trash2 size={11} />
                    </span>
                  </button>
                ))}
                {savedProfiles.length < MAX_PROFILES && (
                  <button onClick={handleNew} style={{ padding: '0.45rem 0.9rem', border: `1px dashed ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '0.82rem', color: C.muted, backgroundColor: 'transparent' }}>
                    + New profile
                  </button>
                )}
              </div>
            )}

            <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Full Name" placeholder="John Doe" value={profile.name} onChange={p('name')} />
              <Field label="Email" placeholder="john.doe@email.com" value={profile.email} onChange={p('email')} type="email" />
              <Field label="Phone" placeholder="+1 (555) 555-0123" value={profile.phone} onChange={p('phone')} />
              <Field label="Location" placeholder="City, State" value={profile.address} onChange={p('address')} />
              <Field label="LinkedIn" placeholder="linkedin.com/in/johndoe" value={profile.linkedin} onChange={p('linkedin')} />
              <Field label="GitHub" placeholder="github.com/johndoe" value={profile.github} onChange={p('github')} />
              <Field label="Personal Website" placeholder="johndoe.com" value={profile.website} onChange={p('website')} />
              <Field label="Languages" placeholder="English, Spanish" value={profile.languages} onChange={p('languages')} />
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
              {savedProfiles.length >= MAX_PROFILES && !activeId && (
                <span style={{ fontSize: '0.78rem', color: C.muted }}>Max 3 profiles reached</span>
              )}
              <button
                onClick={handleSave}
                disabled={savedProfiles.length >= MAX_PROFILES && !activeId}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.45rem 1.1rem', border: `1px solid ${C.accent}`,
                  borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  fontSize: '0.82rem', fontWeight: 600,
                  backgroundColor: saved ? C.accentBg : C.surface,
                  color: C.accentDark,
                  opacity: savedProfiles.length >= MAX_PROFILES && !activeId ? 0.4 : 1,
                }}
              >
                {saved ? <Check size={13} /> : <Save size={13} />}
                {saved ? 'Saved' : activeId ? 'Update profile' : 'Save profile'}
              </button>
            </div>
          </div>
        )}

        {/* Experience Tab */}
        {tab === 'experience' && (
          <div>
            {savedExperiences.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {savedExperiences.map((se, idx) => (
                  <button
                    key={se.id}
                    onClick={() => handleLoadExperience(se)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.9rem', border: `1px solid ${activeExpId === se.id ? C.accent : C.border}`,
                      borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      fontSize: '0.82rem', fontWeight: 600,
                      backgroundColor: activeExpId === se.id ? C.accentBg : C.surface,
                      color: activeExpId === se.id ? C.accentDark : C.text,
                    }}
                  >
                    <FileText size={12} />
                    {experienceLabel(se.text, idx)}
                    <span onClick={(e) => handleDeleteExperience(se.id, e)} style={{ display: 'flex', alignItems: 'center', color: C.muted, marginLeft: '0.1rem', cursor: 'pointer' }}>
                      <Trash2 size={11} />
                    </span>
                  </button>
                ))}
                {savedExperiences.length < MAX_EXPERIENCES && (
                  <button onClick={handleNewExperience} style={{ padding: '0.45rem 0.9rem', border: `1px dashed ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '0.82rem', color: C.muted, backgroundColor: 'transparent' }}>
                    + New experience
                  </button>
                )}
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: C.text, marginBottom: '0.5rem', lineHeight: 1.5 }}>
              Don't have a resume? <strong>No problem.</strong> Just write down what you've done — in any order, in your own words. Claude turns it into a real resume.
            </p>
            <ExperienceHints onInsert={(text) => onExperienceChange(experience + (experience ? '\n\n' : '') + text)} />
            <textarea
              style={{
                width: '100%', minHeight: 360, backgroundColor: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
                padding: '1rem', fontSize: '0.88rem', fontFamily: "'Inter', sans-serif",
                lineHeight: 1.7, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
              placeholder={`Examples — write however feels natural:

JOBS
I worked at Acme Corp from 2020 to now as an operations associate. I handle inventory, work with vendors, and trained 3 new hires on our internal tools.

Last summer I interned at Sample Tech building a customer dashboard with React and a REST API.

PROJECTS
Built a stock-tracker — a Python app that pulls live market data and sends alerts when prices cross thresholds.

Made a personal website with React.

EDUCATION
State University, B.S. Computer Science, expected May 2027.
Took: data structures, machine learning, databases, statistics.

SKILLS
Python, SQL, JavaScript, React, Node.js, Git, PostgreSQL.`}
              value={experience}
              onChange={(e) => onExperienceChange(e.target.value)}
            />

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
              {savedExperiences.length >= MAX_EXPERIENCES && !activeExpId && (
                <span style={{ fontSize: '0.78rem', color: C.muted }}>Max 3 experiences reached</span>
              )}
              <button
                onClick={handleSaveExperience}
                disabled={!experience.trim() || (savedExperiences.length >= MAX_EXPERIENCES && !activeExpId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.45rem 1.1rem', border: `1px solid ${C.accent}`,
                  borderRadius: 6, cursor: experience.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: "'Inter', sans-serif", fontSize: '0.82rem', fontWeight: 600,
                  backgroundColor: expSaved ? C.accentBg : C.surface,
                  color: C.accentDark,
                  opacity: !experience.trim() || (savedExperiences.length >= MAX_EXPERIENCES && !activeExpId) ? 0.4 : 1,
                }}
              >
                {expSaved ? <Check size={13} /> : <Save size={13} />}
                {expSaved ? 'Saved' : activeExpId ? 'Update experience' : 'Save experience'}
              </button>
            </div>
          </div>
        )}

        {/* Tailor Tab */}
        {tab === 'tailor' && (
          <TailorPanel
            jobUrl={jobUrl} setJobUrl={setJobUrl}
            jobText={jobText} setJobText={setJobText}
            parsedJob={parsedJob}
            parsing={parsing} parseError={parseError}
            tailoring={tailoring} coverWriting={coverWriting}
            tailorError={tailorError}
            resumeResult={resumeResult} coverResult={coverResult}
            tailorSteps={tailorSteps}
            onParse={handleParseJob} onReset={() => { setJobUrl(''); setJobText(''); resetTailor(); setTailorSteps({}); }}
            onTailor={handleTailorResume} onCover={handleWriteCover}
            onView={(type) => setViewing({ type, content: type === 'resume' ? resumeResult : coverResult.cover_letter, label: parsedJob.company })}
          />
        )}

        {/* Applications Tab */}
        {tab === 'applications' && (
          <ApplicationsList
            applications={applications}
            onUpdate={updateApplication}
            onDelete={deleteApplication}
            onCompose={composeEmail}
            onView={(type, app) => setViewing({ type, content: type === 'resume' ? app.tailoredResume : app.coverLetter, label: app.company })}
          />
        )}
      </div>

      {/* Document modal */}
      {viewing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', zIndex: 100 }} onClick={() => setViewing(null)}>
          <div style={{ backgroundColor: viewing.type === 'resume' ? '#FFF' : C.surface, border: `1px solid ${C.border}`, borderRadius: 10, maxWidth: 820, width: '100%', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`, alignItems: 'center', position: 'sticky', top: 0, backgroundColor: viewing.type === 'resume' ? '#FFF' : C.surface, zIndex: 1 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
                {viewing.type === 'resume' ? 'Tailored Resume' : 'Cover Letter'} — {viewing.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => downloadDocument(viewing)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'Inter', sans-serif", padding: '0.35rem 0.7rem', borderRadius: 6 }}
                  title="Save as PDF or print"
                >
                  <Download size={12} /> Download
                </button>
                <button style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }} onClick={() => setViewing(null)}>×</button>
              </div>
            </div>
            {viewing.type === 'resume' ? (
              <ResumeRenderer resume={viewing.content} profile={profile} />
            ) : (
              <pre style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.88rem', color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, margin: 0, padding: '1.5rem' }}>
                {viewing.content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PIPELINE_STEPS = [
  { n: 1, label: 'Analyzing job posting' },
  { n: 2, label: 'Reading your experience bank' },
  { n: 3, label: 'Matching your fit to requirements' },
  { n: 4, label: 'Creating optimization plan' },
  { n: 5, label: 'Rewriting bullets in JD voice' },
  { n: 6, label: 'Optimizing skills section' },
  { n: 7, label: 'Calculating match score' },
  { n: 8, label: 'Assembling final resume' },
];

function StepIcon({ status }) {
  if (status === 'done') {
    return <CheckCircle size={14} color={C.green} style={{ flexShrink: 0 }} />;
  }
  if (status === 'running') {
    // Simple spinning ring using inline SVG so we don't need extra deps
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0, animation: 'jobflow-spin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke={C.accent} strokeWidth="3" fill="none" strokeDasharray="42 16" strokeLinecap="round" />
      </svg>
    );
  }
  // Pending: empty circle
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={C.border} strokeWidth="2" fill="none" />
    </svg>
  );
}

function PipelineProgress({ steps }) {
  const completedCount = Object.values(steps).filter((s) => s === 'done').length;
  const pct = Math.round((completedCount / PIPELINE_STEPS.length) * 100);

  return (
    <div style={{
      marginTop: '1rem', padding: '0.85rem 1rem',
      backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    }}>
      {/* Inline keyframe injection for the spinner */}
      <style>{`@keyframes jobflow-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.78rem', color: C.muted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Tailoring pipeline
        </span>
        <span style={{ fontSize: '0.78rem', color: C.accentDark, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: '0.75rem' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: C.accent, transition: 'width 0.25s ease' }} />
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {PIPELINE_STEPS.map((s) => {
          const status = steps[s.n] || 'pending';
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StepIcon status={status} />
              <span style={{
                fontSize: '0.82rem',
                color: status === 'pending' ? C.muted : C.text,
                fontWeight: status === 'running' ? 600 : 400,
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: C.muted, marginRight: '0.4rem' }}>
                  {s.n}/8
                </span>
                {s.label}
                {status === 'running' && '…'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TailorPanel({ jobUrl, setJobUrl, jobText, setJobText, parsedJob, parsing, parseError, tailoring, coverWriting, tailorError, resumeResult, coverResult, tailorSteps = {}, onParse, onReset, onTailor, onCover, onView }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!parsedJob && (
        <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1.25rem' }}>
          <label style={fieldLabel}>Job posting URL</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              style={{ ...input, flex: 1 }}
              placeholder="https://company.com/jobs/data-analyst"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onParse()}
            />
            <button
              onClick={onParse}
              disabled={parsing || (!jobUrl.trim() && !jobText.trim())}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                backgroundColor: parsing ? '#86EFAC' : C.accent, color: '#FFF',
                border: 'none', borderRadius: 6, padding: '0 1.1rem',
                fontSize: '0.85rem', fontWeight: 700,
                cursor: parsing ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                opacity: !jobUrl.trim() && !jobText.trim() ? 0.5 : 1,
              }}
            >
              <Link2 size={13} />
              {parsing ? 'Reading…' : 'Read job'}
            </button>
          </div>

          <div style={{ textAlign: 'center', color: C.muted, fontSize: '0.78rem', margin: '0.5rem 0' }}>
            — or paste the job description text —
          </div>

          <textarea
            style={{
              width: '100%', minHeight: 180, backgroundColor: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
              padding: '0.75rem', fontSize: '0.82rem', fontFamily: "'Inter', sans-serif",
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
            placeholder="Paste the full job description here if URL fetching fails (LinkedIn, Indeed, etc. often block direct fetches)…"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
          />

          {parseError && (
            <p style={{ color: C.error, fontSize: '0.82rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={13} /> {parseError}
            </p>
          )}
        </div>
      )}

      {parsedJob && (
        <>
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>{parsedJob.title}</div>
                <div style={{ fontSize: '0.9rem', color: C.muted }}>{parsedJob.company}{parsedJob.location ? ` · ${parsedJob.location}` : ''}</div>
              </div>
              <button onClick={onReset} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', color: C.muted, fontFamily: "'Inter', sans-serif" }}>
                New job
              </button>
            </div>

            {parsedJob.requirements?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
                {parsedJob.requirements.slice(0, 10).map((r, i) => (
                  <span key={i} style={{ backgroundColor: '#B8860B', color: '#FFF', borderRadius: 4, padding: '0.15rem 0.45rem', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>{r}</span>
                ))}
              </div>
            )}

            {parsedJob.description && (
              <p style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.6, maxHeight: 140, overflow: 'auto', marginBottom: '1rem' }}>
                {parsedJob.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={onTailor}
                disabled={tailoring}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  backgroundColor: tailoring ? '#86EFAC' : C.accent, color: '#FFF',
                  border: 'none', borderRadius: 6, padding: '0.5rem 1.1rem',
                  fontSize: '0.85rem', fontWeight: 700,
                  cursor: tailoring ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                <Sparkles size={13} />
                {tailoring ? 'Tailoring…' : resumeResult ? 'Re-tailor Resume' : 'Tailor Resume'}
              </button>
              <button
                onClick={onCover}
                disabled={coverWriting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  backgroundColor: 'transparent',
                  color: coverWriting ? '#86EFAC' : C.accentDark,
                  border: `1px solid ${C.accent}`, borderRadius: 6,
                  padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700,
                  cursor: coverWriting ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                <Mail size={13} />
                {coverWriting ? 'Writing…' : coverResult ? 'Re-write Cover Letter' : 'Cover Letter'}
              </button>
            </div>

            {tailorError && (
              <p style={{ color: C.error, fontSize: '0.82rem', marginTop: '0.75rem' }}>{tailorError}</p>
            )}

            {tailoring && <PipelineProgress steps={tailorSteps} />}
          </div>

          {resumeResult && (
            <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>Tailored Resume</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', fontWeight: 700, color: resumeResult.match_score >= 70 ? C.green : resumeResult.match_score >= 50 ? C.accent : C.muted, padding: '0.15rem 0.5rem', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  Match {resumeResult.match_score}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle size={11} color={C.green} /> Strengths
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {resumeResult.strengths?.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertCircle size={11} color={C.red} /> Gaps
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {resumeResult.gaps?.map((g, i) => <li key={i}>• {g}</li>)}
                  </ul>
                </div>
              </div>
              {(resumeResult.ats_keywords_hit?.length > 0 || resumeResult.ats_keywords_missing?.length > 0) && (
                <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    ATS Keyword Coverage
                  </div>
                  {resumeResult.ats_keywords_hit?.length > 0 && (
                    <div style={{ marginBottom: resumeResult.ats_keywords_missing?.length > 0 ? '0.5rem' : 0 }}>
                      <div style={{ fontSize: '0.72rem', color: C.green, fontWeight: 600, marginBottom: '0.25rem' }}>✓ Keywords landed in resume:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {resumeResult.ats_keywords_hit.map((kw, i) => (
                          <span key={i} style={{ backgroundColor: '#F0FDF4', border: `1px solid ${C.accentDark}`, borderRadius: 3, padding: '0.1rem 0.4rem', fontSize: '0.72rem', color: C.accentDark, fontFamily: "'JetBrains Mono', monospace" }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {resumeResult.ats_keywords_missing?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: C.red, fontWeight: 600, marginBottom: '0.25rem' }}>✗ Job wants but you don't have:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {resumeResult.ats_keywords_missing.map((kw, i) => (
                          <span key={i} style={{ backgroundColor: '#FEF2F2', border: `1px solid ${C.red}`, borderRadius: 3, padding: '0.1rem 0.4rem', fontSize: '0.72rem', color: C.red, fontFamily: "'JetBrains Mono', monospace" }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => onView('resume')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline', padding: 0, fontFamily: "'Inter', sans-serif" }}>
                View full resume →
              </button>
            </div>
          )}

          {coverResult && (
            <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>Cover Letter</div>
              {coverResult.highlights?.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '0 0 0.75rem 0', padding: 0, fontSize: '0.82rem', color: C.muted, lineHeight: 1.6 }}>
                  {coverResult.highlights.map((h, i) => <li key={i}>• {h}</li>)}
                </ul>
              )}
              <button onClick={() => onView('cover')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline', padding: 0, fontFamily: "'Inter', sans-serif" }}>
                View full cover letter →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#6B6860' },
  { value: 'applied', label: 'Applied', color: '#2563EB' },
  { value: 'replied', label: 'Replied', color: '#B8860B' },
  { value: 'interview', label: 'Interview', color: '#22C55E' },
  { value: 'offer', label: 'Offer', color: '#16A34A' },
  { value: 'rejected', label: 'Rejected', color: '#DC2626' },
];

function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

function ApplicationsList({ applications, onUpdate, onDelete, onCompose, onView }) {
  if (applications.length === 0) {
    return (
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
        <Briefcase size={28} color={C.muted} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>No applications yet</div>
        <div style={{ fontSize: '0.85rem', color: C.muted }}>
          Tailor a resume on the Tailor tab — applications save here automatically.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.78rem', color: C.muted, marginBottom: '0.25rem' }}>
        Click "Send via Gmail" to open a pre-filled draft and mark as applied.
      </p>
      {applications.map((app) => (
        <div key={app.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{app.jobTitle}</div>
              <div style={{ fontSize: '0.85rem', color: C.muted }}>{app.company}{app.jobLocation ? ` · ${app.jobLocation}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {app.matchScore > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', fontWeight: 700, color: app.matchScore >= 70 ? '#16A34A' : app.matchScore >= 50 ? C.accent : C.muted, padding: '0.15rem 0.5rem', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  {app.matchScore}%
                </span>
              )}
              <button onClick={() => onDelete(app.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }} title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onUpdate(app.id, { status: opt.value })}
                style={{
                  padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 600,
                  border: `1px solid ${app.status === opt.value ? opt.color : C.border}`,
                  backgroundColor: app.status === opt.value ? opt.color : 'transparent',
                  color: app.status === opt.value ? '#FFF' : opt.color,
                  borderRadius: 4, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            placeholder="Reply tracking · interview notes · contacts…"
            value={app.notes || ''}
            onChange={(e) => onUpdate(app.id, { notes: e.target.value })}
            style={{
              width: '100%', minHeight: 50, backgroundColor: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
              padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontFamily: "'Inter', sans-serif",
              outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '0.6rem',
            }}
          />

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {app.tailoredResume && (
              <button onClick={() => onView('resume', app)} style={pillBtn()}>
                <FileText size={11} /> Resume
              </button>
            )}
            {app.coverLetter && (
              <button onClick={() => onView('cover', app)} style={pillBtn()}>
                <Mail size={11} /> Cover Letter
              </button>
            )}
            {app.coverLetter && (
              <button onClick={() => onCompose(app)} style={{ ...pillBtn(), borderColor: C.accent, color: C.accentDark }}>
                <Mail size={11} /> Send via Gmail
              </button>
            )}
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" style={{ ...pillBtn(), textDecoration: 'none' }}>
                <ExternalLink size={11} /> Job posting
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function pillBtn() {
  return {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.35rem 0.7rem', fontSize: '0.78rem', fontWeight: 600,
    border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text,
    borderRadius: 6, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  };
}

const HINT_TEMPLATES = [
  {
    label: 'Add a job',
    text: '[Job title] at [Company name], [start date] — [end date or Present]\nWhat I did: [Describe your day-to-day, projects you owned, tools you used]\nImpact: [Numbers if you have them — customers helped, sales, time saved, etc.]',
  },
  {
    label: 'Add a project',
    text: '[Project name] — [tech you used]\nWhat it does: [One sentence on what the project is]\nWhat I built: [Key things you implemented]\nWhy it matters: [What problem it solves or what you learned]',
  },
  {
    label: 'Add education',
    text: '[School name], [Degree], [graduation year]\nRelevant classes: [list any courses related to the jobs you want]\nGPA (if 3.5+): [your GPA]',
  },
  {
    label: 'Add skills',
    text: 'SKILLS\nProgramming: [languages]\nTools: [software, frameworks]\nOther: [anything else relevant]',
  },
  {
    label: 'Add a volunteer / club role',
    text: '[Role] at [Organization], [dates]\nWhat I did: [responsibilities, events organized, people led]',
  },
];

function ExperienceHints({ onInsert }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.75rem', color: C.muted, alignSelf: 'center', marginRight: '0.25rem' }}>Need ideas? Insert a template:</span>
      {HINT_TEMPLATES.map((h, i) => (
        <button
          key={i}
          onClick={() => onInsert(h.text)}
          style={{
            padding: '0.3rem 0.65rem', fontSize: '0.75rem',
            border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text,
            borderRadius: 4, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}
        >
          + {h.label}
        </button>
      ))}
    </div>
  );
}

// ===== Resume Renderer =====
// Font: Helvetica Neue / Helvetica / Arial — the gold standard for professional, ATS-friendly resumes.
// Sizes mirror standard professional resume typography (11pt body, 18pt name).
const RESUME_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const R = {
  page: { fontFamily: RESUME_FONT, color: '#000', backgroundColor: '#FFF', padding: '1.1rem 1.3rem', lineHeight: 1.4 },
  name: { textAlign: 'center', fontFamily: RESUME_FONT, fontSize: '1.55rem', fontWeight: 700, marginBottom: '0.3rem', lineHeight: 1.15, letterSpacing: '0.01em' },
  contactBlock: { textAlign: 'center', fontFamily: RESUME_FONT, fontSize: '0.85rem', marginBottom: '0.5rem', lineHeight: 1.4, color: '#000' },
  contact: { textAlign: 'center', fontFamily: RESUME_FONT, fontSize: '0.85rem', marginBottom: '0.05rem' },
  langs: { textAlign: 'center', fontFamily: RESUME_FONT, fontSize: '0.8rem', color: '#444', marginBottom: '0.3rem' },
  section: { marginTop: '0.6rem' },
  sectionTitle: { fontFamily: RESUME_FONT, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid #000', paddingBottom: '0.08rem', marginBottom: '0.35rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' },
  rowLeft: { flex: '1 1 65%', minWidth: 0, wordBreak: 'normal', overflowWrap: 'break-word' },
  rowRight: { fontFamily: RESUME_FONT, fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'nowrap', color: '#000', flex: '0 0 auto' },
  itemTitle: { fontFamily: RESUME_FONT, fontWeight: 700, fontSize: '0.95rem' },
  itemSubtitle: { fontFamily: RESUME_FONT, fontSize: '0.9rem' },
  techStack: { fontFamily: RESUME_FONT, fontSize: '0.85rem', fontStyle: 'italic', color: '#222', marginTop: '0.05rem' },
  coursework: { fontFamily: RESUME_FONT, fontSize: '0.85rem', marginTop: '0.08rem' },
  skillRow: { fontFamily: RESUME_FONT, fontSize: '0.9rem', marginBottom: '0.18rem' },
  skillCat: { fontWeight: 700 },
  bullets: { listStyle: 'none', margin: '0.3rem 0 0.45rem 0', padding: 0 },
  bullet: { fontFamily: RESUME_FONT, fontSize: '0.9rem', marginBottom: '0.22rem', lineHeight: 1.45, paddingLeft: '1em', textIndent: '-1em' },
  summary: { fontFamily: RESUME_FONT, fontSize: '0.92rem', marginBottom: '0.3rem', lineHeight: 1.5 },
  entry: { marginBottom: '0.55rem' },
};

function ResumeRenderer({ resume, profile }) {
  if (!resume || typeof resume !== 'object' || (!resume.header && !resume.summary && !resume.experience)) {
    // Backwards compat: old saved resumes are plain strings
    return (
      <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#000', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, margin: 0, padding: '1.5rem' }}>
        {typeof resume === 'string' ? resume : JSON.stringify(resume, null, 2)}
      </pre>
    );
  }

  const { summary, education = [], skills = [], experience = [], projects = [] } = resume;

  // Always derive header from current profile (source of truth) — fall back to whatever Claude returned only if profile is empty
  const profileContact = profile ? [profile.address, profile.email, profile.phone].filter(Boolean) : [];
  const profileLinks = profile ? [profile.linkedin, profile.github, profile.website].filter(Boolean) : [];
  const header = {
    name: profile?.name || resume.header?.name || '',
    contact: profileContact.length > 0 ? profileContact : (resume.header?.contact ?? []),
    links: profileLinks.length > 0 ? profileLinks : (resume.header?.links ?? []),
    languages: profile?.languages || resume.header?.languages || '',
  };

  const noProfileInfo = !header.name && header.contact.length === 0 && header.links.length === 0;

  return (
    <div id="resume-printable" style={R.page}>
      {noProfileInfo ? (
        <div style={{ ...R.name, color: '#B45309', fontSize: '1rem', fontStyle: 'italic' }}>
          ⚠ Fill in your name and contact info in the Profile tab — they'll appear here.
        </div>
      ) : (
        <>
          {header.name && <div className="resume-name" style={R.name}>{header.name}</div>}
          {(() => {
            const cleanUrl = (s) => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
            const all = [
              ...header.contact,
              ...header.links.map(cleanUrl),
              header.languages ? `Languages: ${header.languages}` : null,
            ].filter(Boolean);
            return all.length > 0 ? (
              <div className="resume-contact" style={R.contactBlock}>{all.join(' • ')}</div>
            ) : null;
          })()}
        </>
      )}

      {summary && (
        <div className="resume-section" style={R.section}>
          <div className="resume-section-title" style={R.sectionTitle}>SUMMARY</div>
          <div className="resume-summary" style={R.summary}>{summary}</div>
        </div>
      )}

      {education.length > 0 && (
        <div className="resume-section" style={R.section}>
          <div className="resume-section-title" style={R.sectionTitle}>EDUCATION</div>
          {education.map((e, i) => (
            <div key={i} className="resume-entry" style={R.entry}>
              <div style={R.row}>
                <div style={R.rowLeft}><span className="resume-item-title" style={R.itemTitle}>{e.school}</span>{e.degree ? ` — ${e.degree}` : ''}</div>
                {e.dateRange && <div className="resume-row-right" style={R.rowRight}>{e.dateRange}</div>}
              </div>
              {e.coursework && <div className="resume-coursework" style={R.coursework}>Relevant Coursework: {e.coursework}</div>}
            </div>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div className="resume-section" style={R.section}>
          <div className="resume-section-title" style={R.sectionTitle}>TECHNICAL SKILLS</div>
          {skills.map((s, i) => (
            <div key={i} className="resume-skill-row" style={R.skillRow}>
              <span style={R.skillCat}>{s.category}:</span> {s.items}
            </div>
          ))}
        </div>
      )}

      {experience.length > 0 && (
        <div className="resume-section" style={R.section}>
          <div className="resume-section-title" style={R.sectionTitle}>EXPERIENCE</div>
          {experience.map((x, i) => (
            <div key={i} className="resume-entry" style={R.entry}>
              <div style={R.row}>
                <div style={R.rowLeft}>
                  <span className="resume-item-title" style={R.itemTitle}>{x.title}</span>
                  {x.company && <span> &nbsp;|&nbsp; {x.company}</span>}
                  {x.location && <span style={{ color: '#444' }}>, {x.location}</span>}
                </div>
                {x.dateRange && <div className="resume-row-right" style={R.rowRight}>{x.dateRange}</div>}
              </div>
              {x.bullets?.length > 0 && (
                <ul className="resume-bullets" style={R.bullets}>
                  {x.bullets.map((b, j) => (
                    <li key={j} className="resume-bullet" style={R.bullet}>{`— ${b}`}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="resume-section" style={R.section}>
          <div className="resume-section-title" style={R.sectionTitle}>PROJECTS</div>
          {projects.map((pr, i) => (
            <div key={i} className="resume-entry" style={R.entry}>
              <div className="resume-item-title" style={R.itemTitle}>{pr.name}</div>
              {pr.techStack && <div className="resume-tech-stack" style={R.techStack}>{pr.techStack}</div>}
              {pr.bullets?.length > 0 && (
                <ul className="resume-bullets" style={R.bullets}>
                  {pr.bullets.map((b, j) => (
                    <li key={j} className="resume-bullet" style={R.bullet}>{`— ${b}`}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
