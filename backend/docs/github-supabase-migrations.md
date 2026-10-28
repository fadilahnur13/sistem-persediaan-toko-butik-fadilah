# GitHub ke Supabase: migrasi database

Workflow `.github/workflows/supabase-migrations.yml` menerapkan migrasi SQL ke
project Supabase produksi hanya ketika file `supabase/migrations/*.sql` berubah
di branch `main`. Deploy frontend ke GitHub Pages tetap ditangani oleh workflow
`pages.yml`.

## Aktifkan GitHub Actions

Workflow menggunakan koneksi langsung ke database, jadi tidak perlu membuat
Supabase Personal Access Token atau mengatur permission token. Tambahkan satu
repository secret melalui **GitHub → Settings → Secrets and variables →
Actions → New repository secret**:

| Secret | Isi |
|---|---|
| `SUPABASE_DB_URL` | Connection string PostgreSQL untuk database project butik. |

Ambil connection string di **Supabase Dashboard → project butik → Connect →
Connection string → URI**. Gunakan mode koneksi langsung bila tersedia; jika
jaringan tidak mendukung IPv6, gunakan session pooler yang disediakan dashboard.
Ganti placeholder password pada URI dengan password database project. Encode
karakter khusus pada password sebagai URL encoding sebelum menggantinya.

Di GitHub, isi **Name** dengan `SUPABASE_DB_URL` dan **Secret** dengan seluruh
URI. Jangan menyimpan URI/password di repository, kode frontend, commit, atau
pesan. Jika password database belum diketahui, atur/reset melalui pengaturan
database Supabase.

## Menambahkan migrasi

1. Buat file SQL baru di `supabase/migrations/` dengan nama berawalan timestamp,
   misalnya `20261029050000_add_inventory_note.sql`.
2. Isi file dengan perubahan skema yang sempit, aman diulang bila sesuai, dan
   sudah ditinjau. Data stok, transaksi, resep, serta jurnal tetap berada di
   Supabase; workflow hanya menerapkan SQL migrasi.
3. Uji perubahan pada project pengembangan atau database salinan, lalu kirim
   melalui pull request. Setelah ditinjau dan digabung ke `main`, GitHub Actions
   menjalankan `supabase db push --db-url` menggunakan connection string rahasia.
4. Periksa hasil pada tab **Actions**. Jika workflow gagal, perbaiki penyebabnya
   sebelum membuat migrasi susulan.

Workflow ini tidak menjalankan ulang `backend/database.sql` atau
`backend/database/database.sql`. Keduanya adalah skrip setup lama dan bukan
migrasi incremental; menerapkannya otomatis pada database aktif dapat mengubah
objek/data yang sudah ada.

## Sebelum mengaktifkan produksi

- Lindungi branch `main` dengan pull request dan review wajib agar migrasi
  produksi ditinjau sebelum di-merge.
- Gunakan database/project pengembangan untuk menguji migrasi terlebih dahulu.
- Project Supabase aktif yang sudah dibuat secara manual menjadi baseline.
  Jangan menambahkan ulang skema awal penuh sebagai migrasi produksi. Siapkan
  baseline terpisah jika kelak perlu membuat database baru hanya dari migrasi.
- Secret GitHub hanya bisa ditambahkan oleh pemilik atau administrator
  repository; workflow akan berhenti dengan pesan yang jelas jika secret belum
  tersedia.
