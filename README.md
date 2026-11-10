# Sistem Persediaan Toko Butik

Aplikasi web Fadilah Boutique untuk mengelola bahan baku, barang jadi, bahan habis pakai untuk produksi, transaksi persediaan, dan laporan akuntansi. Frontend statis menggunakan Supabase untuk autentikasi dan penyimpanan data.

**Buka aplikasi:** [Fadilah Boutique](https://fadilahnur13.github.io/sistem-persediaan-toko-butik-fadilah/)

## Fitur

- Dashboard persediaan bahan baku, barang jadi, dan transaksi.
- Pengelolaan bahan baku, barang jadi, dan bahan habis pakai untuk produksi.
- Pencatatan pembelian, pemakaian bahan, produksi, penjualan, dan saldo awal persediaan.
- Peringatan stok bahan baku pada 5 atau kurang dan barang jadi pada 1 atau kurang di dashboard.
- Pengelompokan koleksi produk menjadi atasan dan bawahan.
- Riwayat transaksi dan jurnal laporan keuangan diurutkan berdasarkan tanggal.
- Pembaruan stok, perhitungan harga pokok, dan jurnal melalui trigger database.
- Laporan persediaan dan akuntansi dengan ekspor CSV.
- Validasi input pada formulir.
- Kode bahan dan produk dibuat otomatis; perubahan stok dicatat melalui transaksi agar semua data tetap terhubung.

## Memulai

1. Buka link aplikasi di atas.
2. Masuk menggunakan akun email yang sudah dibuat oleh pengelola di **Supabase → Authentication → Users**. Aplikasi tidak menyediakan pendaftaran akun.
3. Pengguna yang masuk mengakses data butik yang sama di project Supabase.

Untuk menyiapkan project baru, jalankan `backend/database.sql` melalui **Supabase → SQL Editor**. File `backend/database/database.sql` adalah salinan yang sama; jalankan salah satu saja. Konfigurasi URL project dan publishable/anon key aplikasi berada di `frontend/js/config.js`. Jangan pernah menaruh password database atau `service_role` key di frontend.

## Deploy dan migrasi

- GitHub Actions menerbitkan folder `frontend` ke GitHub Pages pada push ke branch `main`.
- Skema awal diterapkan sekali secara manual menggunakan `backend/database.sql`.
- Migrasi berikutnya dapat dibuat sebagai file timestamp `.sql` di `supabase/migrations/`. Workflow migrasi membutuhkan repository secret `SUPABASE_DB_URL` dan hanya menjalankan migrasi incremental—bukan mengulang skrip setup awal.
- Petunjuk migrasi lebih lengkap ada di [backend/docs/github-supabase-migrations.md](backend/docs/github-supabase-migrations.md).

## Struktur repository

```text
├── .github/workflows/       # Deploy GitHub Pages dan migrasi Supabase
├── backend/
│   ├── database.sql         # Skema dan setup database
│   ├── database/            # Salinan skema database
│   └── docs/                # Dokumentasi database
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
└── supabase/
    ├── config.toml
    └── migrations/
```

## Teknologi

- HTML, CSS, dan JavaScript.
- Supabase PostgreSQL, Supabase Auth, dan Supabase JavaScript Client v2.
- GitHub Pages.

Dokumentasi tabel, relasi, trigger, dan kebijakan akses tersedia di [backend/docs/skema-database.md](backend/docs/skema-database.md).
