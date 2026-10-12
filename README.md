# Finora — Personal Finance Tracker

Fitur: pencatatan pemasukan & pengeluaran, statistik (per kategori + tren 6 bulan), anggaran bulanan, dan target tabungan.

**Stack:** Python (Flask + SQLAlchemy) · React + Vite · CSS · Vercel

## Struktur
```
api/index.py     -> REST API (Vercel Python Serverless Function)
src/             -> Frontend React (App.jsx, styles.css)
vercel.json      -> Rewrite /api/* ke Flask
requirements.txt -> Dependensi Python
.python-version  -> Python 3.12 untuk build dan runtime Vercel
```

## Jalankan lokal
```bash
# Terminal 1 — API (http://localhost:5000)
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python api/index.py

# Terminal 2 — Frontend (http://localhost:5173)
npm install
npm run dev
```
Lokal memakai SQLite (`finora.db`), tanpa konfigurasi tambahan.

## Deploy ke Vercel
1. Push project ke GitHub, lalu **Add New → Project** di Vercel dan import repo-nya (framework Vite terdeteksi otomatis).
2. Project mengunci Python 3.12 melalui `.python-version` agar cocok dengan versi `psycopg2-binary` di `requirements.txt`. Pertahankan file ini agar Vercel tidak memilih Python 3.14.
3. Filesystem Vercel bersifat sementara, jadi siapkan database Postgres gratis (Vercel Storage → Neon, atau neon.tech).
4. Di **Settings → Environment Variables** tambahkan `DATABASE_URL` berisi connection string Postgres. Tabel dibuat otomatis.
5. Klik **Deploy**. Atau via CLI: `npm i -g vercel && vercel --prod`.

## Catatan
Versi ini belum memiliki login, jadi semua pengunjung berbagi data yang sama. Untuk penggunaan publik, tambahkan autentikasi terlebih dulu.
