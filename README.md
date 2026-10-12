# Sistem Persediaan Toko Butik

Aplikasi web untuk mengelola persediaan bahan baku, barang jadi, resep produksi, dan transaksi stok pada toko butik. Frontend dibuat dengan HTML, CSS, dan JavaScript, dengan Supabase sebagai database.

🌐 **Demo website:** [Sistem Persediaan Toko Butik](https://fadilahnur13.github.io/sistem-persediaan-toko-butik-fadilah/)

## Struktur repository

```text
Sistem Persediaan Butik/
├── .github/
│   └── workflows/
│       └── pages.yml
├── backend/
│   ├── database/
│   │   └── database.sql
│   ├── docs/
│   │   ├── laporan-skema-database-inventory.pdf
│   │   └── skema-database.md
│   └── database.sql
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── config.js
│   │   └── SCRIPT.JS
│   └── index.html
├── .gitignore
├── index.html
└── README.md
```

## Fitur

- Dashboard ringkasan bahan baku, barang jadi, dan transaksi stok.
- Pengelolaan bahan baku, barang jadi, dan resep produksi.
- Pencatatan bahan masuk, pemakaian bahan, produksi, dan barang keluar.
- Validasi stok dan pembaruan persediaan melalui trigger database.

## Menyiapkan database

1. Buat project Supabase dan buka **SQL Editor**.
2. Jalankan `backend/database.sql` untuk membuat tabel, trigger, kebijakan akses, dan data contoh.
3. Atur URL project dan publishable/anon key pada `frontend/js/config.js`.
4. Pastikan project Supabase aktif dan kebijakan RLS sudah diterapkan.

`backend/database/database.sql` adalah salinan skema yang sama. Jalankan salah satu file SQL saja.

## Teknologi

- HTML, CSS, dan JavaScript statis.
- Supabase PostgreSQL dan Supabase JavaScript Client v2.
- GitHub Pages untuk hosting frontend.

Dokumentasi tabel, relasi ERD, trigger, dan kebijakan database ada di [backend/docs/skema-database.md](backend/docs/skema-database.md).
