import { ArrowRight, Sparkles, Search, FileText } from 'lucide-react';

const C = {
  bg: '#F7F4EE', surface: '#FFFFFF', border: '#E0DBD0',
  text: '#1A1A1A', muted: '#6B6860', accent: '#22C55E',
  accentBg: '#F0FDF4', accentDark: '#166534',
};

const steps = [
  {
    icon: <FileText size={20} color={C.accent} />,
    title: 'Save your background once',
    desc: 'Profile + experience saved locally — paste it once, reuse it forever.',
  },
  {
    icon: <Search size={20} color={C.accent} />,
    title: 'Drop a job posting link',
    desc: 'Found a role you want? Paste the URL or copy the description. Claude reads it.',
  },
  {
    icon: <Sparkles size={20} color={C.accent} />,
    title: 'Get a tailored resume + cover letter',
    desc: 'Claude rewrites your resume and writes a cover letter for that specific job.',
  },
];

export default function LandingView({ onStart }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem' }}>JobFlow</span>
        <button
          onClick={onStart}
          style={{
            backgroundColor: C.accent, color: '#FFF', border: 'none', borderRadius: 6,
            padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 600,
            fontFamily: "'Inter', sans-serif", cursor: 'pointer',
          }}
        >
          Get started
        </button>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', backgroundColor: C.accentBg,
          border: `1px solid #BBF7D0`, borderRadius: 20,
          padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 600,
          color: C.accentDark, marginBottom: '1.5rem', fontFamily: "'JetBrains Mono', monospace",
        }}>
          Powered by Claude AI
        </div>

        <h1 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
          fontWeight: 800, lineHeight: 1.15, marginBottom: '1.25rem', color: C.text,
        }}>
          One link.<br />A tailored resume.
        </h1>

        <p style={{ fontSize: '1.05rem', color: C.muted, lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: 520, margin: '0 auto 2.5rem' }}>
          Save your profile and experience once. Paste any job posting link.
          Claude returns a resume rewritten for that role and a cover letter to match.
        </p>

        <button
          onClick={onStart}
          style={{
            backgroundColor: C.accent, color: '#FFF', border: 'none', borderRadius: 8,
            padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700,
            fontFamily: "'Inter', sans-serif", cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          Start for free <ArrowRight size={16} />
        </button>
      </div>

      {/* Steps */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem 1.5rem 5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              backgroundColor: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '1.25rem',
            }}>
              <div style={{ marginBottom: '0.75rem' }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem', fontFamily: "'Syne', sans-serif" }}>{s.title}</div>
              <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '1.25rem 2rem', textAlign: 'center', fontSize: '0.78rem', color: C.muted }}>
        JobFlow — built with Claude API
      </div>
    </div>
  );
}
