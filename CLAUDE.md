# Aturan untuk semua AI di project ini
Baca file ini dulu sebelum menulis kode.

Project: satu fitur plug-in untuk Orbyte (SDC Hackathon 2026, Domain 2).
Alur wajib: pemicu → ambil data → keputusan (aturan + AI) → approval oleh role yang tepat → hasil + riwayat tercatat.

Teknologi: Next.js + TypeScript + Tailwind.
Hosting: Replit (kode diambil dari GitHub). AI: endpoint RunPod.

Aturan:
- Semua data palsu. Jangan pernah pakai nama/nomor/data asli.
- API key dibaca dari Secrets (RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID). Jangan pernah ditulis di kode.
- Role hanya dua: Staff dan Owner. Cek izin di server, bukan cuma menyembunyikan tombol.
- Setiap klik penting dicatat di riwayat: siapa, apa, kapan, kenapa.
- Aturan bisnis ditulis sebagai kode biasa, bukan di dalam prompt AI.
- Jawaban AI selalu berisi: saran, alasan, dan seberapa yakin (0–1). Kalau AI error atau lebih dari 20 detik, pakai jawaban cadangan.
- Pakai nama yang jelas dan beri komentar singkat di kode yang sulit.
- Setelah selesai, jelaskan apa yang kamu buat dengan bahasa sederhana.