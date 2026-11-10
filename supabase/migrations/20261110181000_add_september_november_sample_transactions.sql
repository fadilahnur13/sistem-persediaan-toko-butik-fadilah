INSERT INTO public.bahan_baku
    (kode_bahan, nama_bahan, jenis_bahan, satuan, stok, stok_minimum, harga_pokok_rata_rata)
VALUES
    ('SIM-BB-KATUN26', 'SIMULASI - Kain Katun', 'Kain', 'meter', 0, 5, 0),
    ('SIM-BB-DENIM26', 'SIMULASI - Kain Denim', 'Kain', 'meter', 0, 5, 0),
    ('SIM-BB-BENANG26', 'SIMULASI - Benang Jahit', 'Benang', 'roll', 0, 5, 0)
ON CONFLICT (kode_bahan) DO NOTHING;

INSERT INTO public.barang_jadi
    (kode_barang, nama_barang, kategori, ukuran, warna, harga_jual, stok, harga_pokok_rata_rata)
VALUES
    ('SIM-BJ-BLOUSE26', 'SIMULASI - Blouse Katun', 'Atasan', 'M', 'Putih', 150000, 0, 0),
    ('SIM-BJ-ROKDEN26', 'SIMULASI - Rok Denim', 'Bawahan', 'M', 'Biru', 185000, 0, 0)
ON CONFLICT (kode_barang) DO NOTHING;

INSERT INTO public.detail_produksi (id_barang, id_bahan, jumlah_digunakan)
SELECT barang.id_barang, bahan.id_bahan, resep.jumlah_digunakan
FROM (VALUES
    ('SIM-BJ-BLOUSE26', 'SIM-BB-KATUN26', 1.5::NUMERIC),
    ('SIM-BJ-BLOUSE26', 'SIM-BB-BENANG26', 0.1::NUMERIC),
    ('SIM-BJ-ROKDEN26', 'SIM-BB-DENIM26', 1.5::NUMERIC),
    ('SIM-BJ-ROKDEN26', 'SIM-BB-BENANG26', 0.1::NUMERIC)
) AS resep(kode_barang, kode_bahan, jumlah_digunakan)
JOIN public.barang_jadi AS barang ON barang.kode_barang = resep.kode_barang
JOIN public.bahan_baku AS bahan ON bahan.kode_bahan = resep.kode_bahan
ON CONFLICT (id_barang, id_bahan) DO NOTHING;

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_bahan, jumlah, harga_perolehan_satuan, metode_pembayaran)
SELECT DATE '2026-09-02', 'MASUK',
       '[SIMULASI SEPTEMBER 2026] Pembelian kain katun',
       bahan.id_bahan, 10, 35000, 'TUNAI'
FROM public.bahan_baku AS bahan
WHERE bahan.kode_bahan = 'SIM-BB-KATUN26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI SEPTEMBER 2026] Pembelian kain katun'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_bahan, jumlah, harga_perolehan_satuan, metode_pembayaran)
SELECT DATE '2026-09-02', 'MASUK',
       '[SIMULASI SEPTEMBER 2026] Pembelian benang jahit',
       bahan.id_bahan, 1, 20000, 'TUNAI'
FROM public.bahan_baku AS bahan
WHERE bahan.kode_bahan = 'SIM-BB-BENANG26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI SEPTEMBER 2026] Pembelian benang jahit'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_barang, jumlah)
SELECT DATE '2026-09-04', 'PRODUKSI',
       '[SIMULASI SEPTEMBER 2026] Produksi 2 blouse katun',
       barang.id_barang, 2
FROM public.barang_jadi AS barang
WHERE barang.kode_barang = 'SIM-BJ-BLOUSE26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI SEPTEMBER 2026] Produksi 2 blouse katun'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_barang, jumlah, harga_jual_satuan, metode_pembayaran)
SELECT DATE '2026-09-06', 'KELUAR',
       '[SIMULASI SEPTEMBER 2026] Penjualan 1 blouse katun',
       barang.id_barang, 1, 150000, 'TUNAI'
FROM public.barang_jadi AS barang
WHERE barang.kode_barang = 'SIM-BJ-BLOUSE26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI SEPTEMBER 2026] Penjualan 1 blouse katun'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_bahan, jumlah, harga_perolehan_satuan, metode_pembayaran)
SELECT DATE '2026-11-02', 'MASUK',
       '[SIMULASI NOVEMBER 2026] Pembelian kain denim',
       bahan.id_bahan, 8, 45000, 'TUNAI'
FROM public.bahan_baku AS bahan
WHERE bahan.kode_bahan = 'SIM-BB-DENIM26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI NOVEMBER 2026] Pembelian kain denim'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_bahan, jumlah, harga_perolehan_satuan, metode_pembayaran)
SELECT DATE '2026-11-02', 'MASUK',
       '[SIMULASI NOVEMBER 2026] Pembelian benang jahit',
       bahan.id_bahan, 1, 20000, 'TUNAI'
FROM public.bahan_baku AS bahan
WHERE bahan.kode_bahan = 'SIM-BB-BENANG26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI NOVEMBER 2026] Pembelian benang jahit'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_barang, jumlah)
SELECT DATE '2026-11-04', 'PRODUKSI',
       '[SIMULASI NOVEMBER 2026] Produksi 2 rok denim',
       barang.id_barang, 2
FROM public.barang_jadi AS barang
WHERE barang.kode_barang = 'SIM-BJ-ROKDEN26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI NOVEMBER 2026] Produksi 2 rok denim'
  );

INSERT INTO public.transaksi
    (tanggal, jenis_transaksi, keterangan, id_barang, jumlah, harga_jual_satuan, metode_pembayaran)
SELECT DATE '2026-11-06', 'KELUAR',
       '[SIMULASI NOVEMBER 2026] Penjualan 1 rok denim',
       barang.id_barang, 1, 185000, 'TUNAI'
FROM public.barang_jadi AS barang
WHERE barang.kode_barang = 'SIM-BJ-ROKDEN26'
  AND NOT EXISTS (
      SELECT 1 FROM public.transaksi
      WHERE keterangan = '[SIMULASI NOVEMBER 2026] Penjualan 1 rok denim'
  );
