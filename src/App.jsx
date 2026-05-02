import { useState, useEffect } from 'react';
import LandingView from './components/LandingView';
import InputView from './components/InputView';

const emptyProfile = { name: '', email: '', phone: '', address: '', linkedin: '', github: '', website: '', languages: '' };
const EXP_KEY = 'jobflow_experience';
const APP_KEY = 'jobflow_applications';

function loadExperience() {
  try { return localStorage.getItem(EXP_KEY) ?? ''; }
  catch { return ''; }
}

function loadApplications() {
  try { return JSON.parse(localStorage.getItem(APP_KEY) ?? '[]'); }
  catch { return []; }
}

export default function App() {
  const [view, setView] = useState('landing');
  const [profile, setProfile] = useState(emptyProfile);
  const [experience, setExperience] = useState(loadExperience);
  const [applications, setApplications] = useState(loadApplications);

  useEffect(() => {
    localStorage.setItem(EXP_KEY, experience);
  }, [experience]);

  useEffect(() => {
    localStorage.setItem(APP_KEY, JSON.stringify(applications));
  }, [applications]);

  if (view === 'landing') return <LandingView onStart={() => setView('input')} />;

  return (
    <InputView
      profile={profile}
      onProfileChange={setProfile}
      experience={experience}
      onExperienceChange={setExperience}
      applications={applications}
      onApplicationsChange={setApplications}
    />
  );
}
