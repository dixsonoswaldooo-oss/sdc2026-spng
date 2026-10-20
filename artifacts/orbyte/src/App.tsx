const steps = [
  'Pemicu',
  'Ambil data',
  'Keputusan (aturan + AI)',
  'Approval oleh role yang tepat',
  'Hasil + riwayat tercatat',
];

export default function App() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-6 py-16 text-slate-900 antialiased">
      <h1 className="text-2xl font-semibold">Orbyte Plug-in</h1>
      <p className="mt-2 text-slate-600">
        Aplikasi masih kosong. Fitur belum dibuat. Alur yang akan dibangun:
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </main>
  );
}
