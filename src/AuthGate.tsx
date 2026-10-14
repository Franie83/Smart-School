import React, { useEffect, useState } from 'react';
import App from './App';
import { initializeServerStorage } from './services/serverStorage';

type AuthUser = { id: string; username: string; name: string; role: string; schoolId?: string | null; assignedClassIds?: string[] };
const API = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function cacheIdentity(user: AuthUser) {
  const normalized = { id: user.id, email: user.username, name: user.name, role: user.role, schoolId: user.schoolId || '', assignedClassIds: user.assignedClassIds || [] };
  try { localStorage.setItem('smart_register_current_user', JSON.stringify(normalized)); } catch { /* cache is optional */ }
}

const DEMO_ACCOUNTS: Array<{
  label: string;
  sub: string;
  username: string;
  password: string;
  color: string;
}> = [
  {
    label: 'Super Admin',
    sub: 'System-wide · manage accounts',
    username: 'admin',
    password: 'Frankie@83@schoolrecordmgt',
    color: 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900',
  },
  {
    label: 'School Admin',
    sub: 'Principal · full school access',
    username: 'admin@demointernational.edu',
    password: 'DemoAdmin@2026',
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700',
  },
  {
    label: 'Teacher',
    sub: 'Mr. Okafor · JSS 1A only',
    username: 'james.okafor@demointernational.edu',
    password: 'DemoTeacher@2026',
    color: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
  },
  {
    label: 'Teacher',
    sub: 'Mrs. Adeleke · JSS 1B only',
    username: 'grace.adeleke@demointernational.edu',
    password: 'DemoTeacher@2026',
    color: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
  },
  {
    label: 'Teacher',
    sub: 'Mr. Davies · JSS 2A only',
    username: 'emmanuel.davies@demointernational.edu',
    password: 'DemoTeacher@2026',
    color: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
  },
  {
    label: 'Viewer',
    sub: 'Ministry inspection · read-only',
    username: 'inspector@ministry.gov',
    password: 'DemoViewer@2026',
    color: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700',
  },
];

export default function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    api('/api/auth/me').then(async (data) => {
      cacheIdentity(data.user);
      await initializeServerStorage(data.user.role);
      setUser(data.user);
    }).catch(async () => {
      try { const status = await api('/api/auth/setup-status'); setSetupRequired(Boolean(status.setupRequired)); }
      catch { setError('Cannot connect to the Flask server. Start the backend and try again.'); }
      setUser(null);
    }).finally(() => setBusy(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const data = setupRequired
        ? await api('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password, name: displayName }) })
        : await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      cacheIdentity(data.user);
      await initializeServerStorage(data.user.role);
      setUser(data.user); setPassword('');
    } catch (err: any) { setError(err.message || 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  async function quickLogin(demoUsername: string, demoPassword: string) {
    setBusy(true);
    setError('');
    setUsername(demoUsername);
    setPassword(demoPassword);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: demoUsername, password: demoPassword }),
      });
      cacheIdentity(data.user);
      await initializeServerStorage(data.user.role);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setBusy(false);
    }
  }


  if (user) return <App />;
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-5">
      <div className="text-center space-y-2"><div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-2xl font-bold">S</div><h1 className="text-2xl font-bold text-slate-900">Smart School Records</h1><p className="text-sm text-slate-500">{setupRequired ? 'Create the first administrator account' : 'Sign in with your assigned account'}</p></div>
      {error && <div role="alert" className="rounded-lg bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}
      {setupRequired && <label className="block text-sm font-medium text-slate-700">Administrator name<input autoComplete="name" required value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-600" /></label>}
      <label className="block text-sm font-medium text-slate-700">Username<input autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-600" /></label>
      <label className="block text-sm font-medium text-slate-700">Password<input type="password" autoComplete={setupRequired ? "new-password" : "current-password"} minLength={setupRequired ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-emerald-600" /></label>
      <button disabled={busy} className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold p-3">{busy ? 'Please wait…' : setupRequired ? 'Create administrator and sign in' : 'Sign in securely'}</button>
      <p className="text-xs text-slate-500 text-center">Access is controlled by your server-assigned role and school.</p>
    </form>

        {/* ─── Quick Access Demo Logins ─────────────────────────────── */}
        <div className="pt-5 mt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Quick Access — Demo Roles
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Click any role below to sign in instantly. Use these to test
            role-based permissions across the school.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.username}
                type="button"
                disabled={busy}
                onClick={() => quickLogin(acct.username, acct.password)}
                className={`text-left px-3 py-2.5 rounded-lg border shadow-2xs transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${acct.color}`}
              >
                <div className="text-xs font-bold leading-tight">
                  {acct.label}
                </div>
                <div className="text-[10px] opacity-90 mt-0.5 leading-snug">
                  {acct.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

  </div>;
}
