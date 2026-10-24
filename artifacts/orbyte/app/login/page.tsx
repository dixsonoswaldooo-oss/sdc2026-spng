'use client';
// Shared sign-in page. Sign-in is simulated: pick a demo account (password "demo").
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { DemoSpace } from '@/components/DemoSpace';
import { Reveal } from '@/components/Reveal';
import { ACCOUNTS, COMPANY, EMPLOYEES } from '@/lib/seed';
import { useStore } from '@/lib/store';

export default function LoginPage() {
  const { account, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState(ACCOUNTS[0].email);
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');

  useEffect(() => {
    if (account) router.replace(account.role === 'HR' ? '/hr' : '/employee');
  }, [account, router]);

  // Wake the AI worker in the background; nothing waits for it.
  useEffect(() => {
    fetch('/ai/classify-leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warmup: true }) }).catch(() => {});
  }, []);

  const go = (id: string) => signIn(id).catch((e: Error) => setError(e.message));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!found || password !== 'demo') return setError('Unknown email or wrong password. Use a demo account below (password: demo).');
    go(found.id);
  };

  return (
    <div className="app flex min-h-screen flex-col bg-gray">
      <header className="site-header">
        <div className="wrap">
          <a href="/" className="brand">
            <img src="/assets/orbyte-icon.png" alt="" className="chop-mark" />
            Orbyte
          </a>
          <a href="/" className="btn btn-line">← Back to Orbyte</a>
        </div>
      </header>

      <main className="wrap grid w-full flex-1 items-start gap-10 py-14 lg:grid-cols-[1fr_1.05fr] lg:py-20">
        <Reveal>
          <span className="eyebrow">Smart feature on Orbyte</span>
          <h1 className="mt-3 !text-[clamp(2.4rem,4.6vw,3.8rem)]">e-Salary Guard.</h1>
          <p className="lede mt-5 !max-w-[34ch]">Take-home pay worked out from attendance, explained to every employee before payday, not after.</p>
          <ul className="plain mt-8 max-w-md">
            <li>Deductions calculated from attendance, lateness and leave</li>
            <li>WhatsApp alert the moment a deduction appears</li>
            <li>AI reads leave reasons; HR has the final say</li>
            <li>One-click payroll with a full activity log</li>
          </ul>
        </Reveal>

        <Reveal delay={120} className="rounded-[var(--radius-lg)] bg-white p-7 shadow-[0_30px_70px_-30px_rgba(11,11,12,0.18)] sm:p-9">
          <h2 className="!text-[1.6rem]">Sign in</h2>
          <p className="small mt-1">{COMPANY} · demo workspace</p>
          <form onSubmit={submit} className="mt-6">
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <p role="alert" className="mb-4 text-sm font-medium text-danger">{error}</p>}
            <button type="submit" className="btn btn-primary w-full justify-center !py-3">Sign in</button>
          </form>

          <div className="mt-8">
            <p className="text-xs font-semibold text-muted">Demo accounts · password <code>demo</code> · one click to sign in</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {ACCOUNTS.map((a) => {
                const emp = EMPLOYEES.find((e) => e.id === a.employeeId);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => go(a.id)}
                      className="w-full cursor-pointer rounded-[var(--radius-sm)] border border-line bg-gray px-4 py-3 text-left transition hover:border-royal hover:bg-white"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-navy">{a.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${a.role === 'HR' ? 'bg-royal text-white' : 'bg-royal/10 text-royal'}`}>{a.role === 'HR' ? 'HR' : 'Employee'}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{emp ? emp.position : 'HR Manager'} · {a.email}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <DemoSpace />
        </Reveal>
      </main>
    </div>
  );
}
