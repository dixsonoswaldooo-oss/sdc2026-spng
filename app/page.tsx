// Halaman awal kosong: hanya menunjukkan alur wajib yang akan dibangun.
const alur = [
  "Pemicu",
  "Ambil data",
  "Keputusan (aturan + AI)",
  "Approval oleh role yang tepat",
  "Hasil + riwayat tercatat",
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Orbyte Plug-in</h1>
      <p className="mt-2 text-slate-600">
        Aplikasi masih kosong. Fitur belum dibuat. Alur yang akan dibangun:
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5">
        {alur.map((langkah) => (
          <li key={langkah}>{langkah}</li>
        ))}
      </ol>
    </main>
  );
}
