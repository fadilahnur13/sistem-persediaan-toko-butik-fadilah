# SHOPLY

Sistem informasi akuntansi untuk jasa personal shopper fashion. Aplikasi memakai tepat empat tabel Supabase: pelanggan, layanan/produk, transaksi (termasuk rincian pesanan), dan catatan keuangan (akun serta jurnal).

Demo aplikasi: [Buka SHOPLY](https://fadilahnur13.github.io/sistem-persediaan-toko-butik-fadilah/)

## Identitas tugas

| Keterangan | Detail |
| --- | --- |
| Nama | Nayla Clarissa |
| NIM | 12030121420008 |
| Mata Kuliah | Pengkodean dan Pemrograman |
| Kelas | D |
| Dosen Pengampu | Dr. Totok Dewayanto, S.E., M.Si., Akt. |

Disusun untuk memenuhi Tugas Project UTS Pengkodean dan Pemrogramman.

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
5. Tambahkan akun pengguna melalui **Supabase → Authentication → Users** agar dapat masuk ke aplikasi. Aplikasi menggunakan login email dan kata sandi Supabase; aplikasi tidak menyediakan pendaftaran akun.

`backend/database/database.sql` adalah salinan skema yang sama. Jalankan salah satu file SQL saja.

### Memperbarui project Supabase yang sudah ada

Perubahan file SQL di repository tidak otomatis mengubah database Supabase. Untuk menerapkan pembaruan skema akuntansi pada project yang sudah berisi data, jalankan kembali seluruh `backend/database.sql` melalui **SQL Editor** pada project yang URL-nya sama dengan `SUPABASE_URL` di `frontend/js/config.js`. Skrip memperbarui kolom, trigger, dan kebijakan yang diperlukan tanpa menghapus transaksi atau mengosongkan tabel; data contoh hanya ditambahkan jika kodenya belum ada. Setelah berhasil, muat ulang aplikasi.

## Menghubungkan GitHub Actions

- **Deploy frontend:** pada repository GitHub, buka **Settings → Pages**, pilih **GitHub Actions** sebagai build and deployment source. Workflow `.github/workflows/pages.yml` menerbitkan folder `frontend` setiap ada push ke branch `main`; workflow juga dapat dijalankan manual dari tab **Actions**.
- **Alamat autentikasi Supabase:** pada **Supabase → Authentication → URL Configuration**, jadikan URL GitHub Pages aplikasi sebagai **Site URL** dan tambahkan ke **Redirect URLs**. Pastikan URL project dan publishable/anon key di `frontend/js/config.js` berasal dari project Supabase yang sama.
- **Migrasi database otomatis:** siapkan baseline dengan menjalankan `backend/database.sql` secara manual sekali. Kemudian tambahkan repository secret bernama `SUPABASE_DB_URL` di **Settings → Secrets and variables → Actions**. Nilainya adalah connection string PostgreSQL dari project Supabase. Workflow migrasi hanya menjalankan berkas baru di `supabase/migrations/` pada push ke `main`; workflow tidak menjalankan ulang skema baseline.

Jangan masukkan password database atau `service_role` key ke frontend, repository, atau commit. Publishable/anon key pada `frontend/js/config.js` memang digunakan oleh aplikasi browser; keamanan akses data tetap bergantung pada autentikasi dan kebijakan RLS. Petunjuk rinci tersedia di [backend/docs/github-supabase-migrations.md](backend/docs/github-supabase-migrations.md).

## Teknologi

- HTML, CSS, dan JavaScript statis.
- Supabase PostgreSQL dan Supabase JavaScript Client v2.
- GitHub Pages untuk hosting frontend.

Dokumentasi tabel, relasi ERD, trigger, dan kebijakan database ada di [backend/docs/skema-database.md](backend/docs/skema-database.md).
