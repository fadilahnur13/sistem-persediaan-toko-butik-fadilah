UPDATE public.transaksi AS transaksi
SET keterangan = 'Penilaian stok '
    || TRUNC(transaksi.jumlah)::TEXT
    || ' '
    || bahan.satuan
    || ' '
    || bahan.nama_bahan
FROM public.bahan_baku AS bahan
WHERE transaksi.id_bahan = bahan.id_bahan
  AND transaksi.jenis_transaksi = 'PENILAIAN_AWAL'
  AND bahan.kode_bahan = 'BB004'
  AND bahan.nama_bahan = 'Kancing'
  AND transaksi.keterangan =
      'Penilaian stok Kancing berdasarkan harga pembelian Rp30.000 per pack isi 50 pcs.';
