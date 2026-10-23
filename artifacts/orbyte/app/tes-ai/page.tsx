'use client';
// T2's AI test page, kept from the Cash Guard app. It calls T1's Express route /api/ai-test (Replit sends /api to api-server).
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

const fallbackMessage = 'AI sedang bangun, coba lagi sebentar';

export default function AiTestPage() {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnswer('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
            ? result.error
            : fallbackMessage;
        setError(message);
        return;
      }

      if (typeof result !== 'object' || result === null || !('answer' in result) || typeof result.answer !== 'string') {
        setError(fallbackMessage);
        return;
      }

      setAnswer(result.answer);
    } catch {
      setError(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-6 py-16 text-slate-900 antialiased">
      <Link href="/" className="text-sm text-slate-600 underline">
        Kembali
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Tes AI</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label htmlFor="ai-prompt" className="block text-sm font-medium">
          Tulis pertanyaan
        </label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={10000}
          required
          rows={5}
          className="w-full rounded-md border border-slate-300 bg-white p-3 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Mengirim…' : 'Kirim'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      )}
      {answer && (
        <section aria-live="polite" className="mt-6">
          <h2 className="text-lg font-semibold">Jawaban AI</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{answer}</p>
        </section>
      )}
    </main>
  );
}
