import { useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { searchJobs } from '../services/claudeService';

const C = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  border: '#2A2A2A',
  text: '#E8E8E8',
  muted: '#8A8A8A',
  accent: '#B8955A',
  error: '#C0392B',
  inputBg: '#111111',
};

const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "'DM Sans', sans-serif",
    padding: '2rem 1.5rem',
  },
  container: { maxWidth: 760, margin: '0 auto' },
  heading: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '2rem',
    fontWeight: 700,
    color: C.text,
    marginBottom: '0.25rem',
  },
  subheading: { color: C.muted, fontSize: '0.9rem', marginBottom: '2.5rem' },
  section: { marginBottom: '2rem' },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '0.6rem',
  },
  card: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '1rem',
    marginBottom: '0.75rem',
  },
  input: {
    width: '100%',
    backgroundColor: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    backgroundColor: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '0.6rem 0.75rem',
    fontSize: '0.8rem',
    fontFamily: "'IBM Plex Mono', monospace",
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.6,
    boxSizing: 'border-box',
    minHeight: 90,
  },
  select: {
    backgroundColor: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    cursor: 'pointer',
  },
  row: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' },
  col2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    padding: '0.3rem',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 3,
    flexShrink: 0,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'none',
    border: `1px dashed ${C.border}`,
    borderRadius: 4,
    color: C.muted,
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '0.5rem 0.75rem',
    width: '100%',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
  },
  primaryBtn: {
    backgroundColor: C.accent,
    color: '#0F0F0F',
    border: 'none',
    borderRadius: 4,
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    whiteSpace: 'nowrap',
  },
  expHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    marginBottom: 0,
  },
  expTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: C.text,
  },
  expMeta: {
    fontSize: '0.75rem',
    color: C.muted,
    marginTop: '0.1rem',
  },
  typeBadge: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.7rem',
    color: C.accent,
    border: `1px solid #7A6240`,
    borderRadius: 3,
    padding: '0.1rem 0.4rem',
    marginRight: '0.5rem',
  },
  error: { color: C.error, fontSize: '0.8rem', marginTop: '0.5rem' },
};

const EXP_TYPES = ['job', 'project', 'research', 'coursework', 'other'];

function ExperienceCard({ exp, onUpdate, onDelete, canDelete }) {
  const [open, setOpen] = useState(!exp.title);

  const u = (field, val) => onUpdate({ ...exp, [field]: val });
  const summary = exp.title || 'New experience';
  const meta = [exp.organization, exp.dates].filter(Boolean).join(' · ');

  return (
    <div style={S.card}>
      <div style={S.expHeader} onClick={() => setOpen((o) => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={S.typeBadge}>{exp.type}</span>
            <span style={S.expTitle}>{summary}</span>
          </div>
          {!open && meta && <div style={S.expMeta}>{meta}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {canDelete && (
            <button
              style={S.iconBtn}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={S.col2}>
            <select style={S.select} value={exp.type} onChange={(e) => u('type', e.target.value)}>
              {EXP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              style={S.input}
              placeholder="Title / Role"
              value={exp.title}
              onChange={(e) => u('title', e.target.value)}
            />
          </div>
          <div style={S.col2}>
            <input
              style={S.input}
              placeholder="Organization (optional)"
              value={exp.organization}
              onChange={(e) => u('organization', e.target.value)}
            />
            <input
              style={S.input}
              placeholder="Dates (e.g. Jan 2024 – May 2024)"
              value={exp.dates}
              onChange={(e) => u('dates', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <textarea
              style={S.textarea}
              placeholder="What you did — bullet points or prose. Be specific: tools used, scale, outcomes."
              value={exp.description}
              onChange={(e) => u('description', e.target.value)}
            />
          </div>
          <input
            style={S.input}
            placeholder="Skills used (e.g. Python, SQL, scikit-learn, Tableau)"
            value={exp.skills}
            onChange={(e) => u('skills', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function JobApplicationSystem({
  profile, onProfileChange,
  experiences, onExperiencesChange,
  onJobsLoaded, newExperience,
}) {
  const [query, setQuery] = useState('data science / analytics internship');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addExp = () => onExperiencesChange((e) => [...e, newExperience()]);
  const updateExp = (updated) => onExperiencesChange((e) => e.map((x) => (x.id === updated.id ? updated : x)));
  const deleteExp = (id) => onExperiencesChange((e) => e.filter((x) => x.id !== id));
  const u = (field, val) => onProfileChange((p) => ({ ...p, [field]: val }));

  const handleSearch = async () => {
    const filled = experiences.filter((e) => e.title.trim() || e.description.trim());
    if (filled.length === 0) {
      setError('Add at least one experience before searching.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const jobs = await searchJobs(query);
      onJobsLoaded(jobs);
    } catch (e) {
      console.error(e);
      setError(e.message ?? 'Search failed. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.heading}>JobFlow</h1>
        <p style={S.subheading}>Add your experiences. JobFlow picks the best ones for each job.</p>

        {/* Profile */}
        <div style={S.section}>
          <span style={S.label}>Profile</span>
          <div style={S.card}>
            <div style={{ ...S.row, marginBottom: '0.5rem' }}>
              <input
                style={S.input}
                placeholder="Full name"
                value={profile.name}
                onChange={(e) => u('name', e.target.value)}
              />
            </div>
            <div style={{ ...S.row, marginBottom: '0.5rem' }}>
              <input
                style={S.input}
                placeholder="Contact info (email · LinkedIn · GitHub)"
                value={profile.contact}
                onChange={(e) => u('contact', e.target.value)}
              />
            </div>
            <textarea
              style={{ ...S.textarea, minHeight: 60 }}
              placeholder="Education (e.g. University of Colorado Boulder — B.S. Data Science, Expected May 2027)"
              value={profile.education}
              onChange={(e) => u('education', e.target.value)}
            />
          </div>
        </div>

        {/* Experiences */}
        <div style={S.section}>
          <span style={S.label}>Experiences · {experiences.length} added</span>
          {experiences.map((exp) => (
            <ExperienceCard
              key={exp.id}
              exp={exp}
              onUpdate={updateExp}
              onDelete={() => deleteExp(exp.id)}
              canDelete={experiences.length > 1}
            />
          ))}
          <button style={S.addBtn} onClick={addExp}>
            <Plus size={14} /> Add experience
          </button>
        </div>

        {/* Search */}
        <div style={S.section}>
          <span style={S.label}>Job Search</span>
          <div style={{ ...S.card, display: 'flex', gap: '0.5rem', padding: '0.75rem' }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="e.g. data science, ML, analytics, quant"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              style={{ ...S.primaryBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              onClick={handleSearch}
              disabled={loading}
            >
              <Search size={15} />
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p style={S.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
