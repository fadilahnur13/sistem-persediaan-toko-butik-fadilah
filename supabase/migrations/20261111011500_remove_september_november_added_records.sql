DO $$
DECLARE
    target_transaction_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO target_transaction_count
    FROM public.transaksi AS transaksi
    LEFT JOIN public.bahan_baku AS bahan
        ON bahan.id_bahan = transaksi.id_bahan
    LEFT JOIN public.barang_jadi AS barang
        ON barang.id_barang = transaksi.id_barang
    WHERE bahan.kode_bahan IN (
            'BB-KATUN-26',
            'BB-DENIM-26',
            'BB-BENANG-26'
        )
       OR barang.kode_barang IN (
            'BJ-BLOUSE-26',
            'BJ-ROK-DENIM-26'
       );

    IF target_transaction_count <> 8 THEN
        RAISE EXCEPTION
            'Expected 8 September/November added transactions, found %; no records were removed.',
            target_transaction_count;
    END IF;
END
$$;

DELETE FROM public.jurnal_umum AS jurnal
USING public.transaksi AS transaksi
LEFT JOIN public.bahan_baku AS bahan
    ON bahan.id_bahan = transaksi.id_bahan
LEFT JOIN public.barang_jadi AS barang
    ON barang.id_barang = transaksi.id_barang
WHERE jurnal.id_transaksi = transaksi.id_transaksi
  AND (
      bahan.kode_bahan IN (
          'BB-KATUN-26',
          'BB-DENIM-26',
          'BB-BENANG-26'
      )
      OR barang.kode_barang IN (
          'BJ-BLOUSE-26',
          'BJ-ROK-DENIM-26'
      )
  );

DELETE FROM public.transaksi AS transaksi
USING public.bahan_baku AS bahan
WHERE transaksi.id_bahan = bahan.id_bahan
  AND bahan.kode_bahan IN (
      'BB-KATUN-26',
      'BB-DENIM-26',
      'BB-BENANG-26'
  );

DELETE FROM public.transaksi AS transaksi
USING public.barang_jadi AS barang
WHERE transaksi.id_barang = barang.id_barang
  AND barang.kode_barang IN (
      'BJ-BLOUSE-26',
      'BJ-ROK-DENIM-26'
  );

DELETE FROM public.detail_produksi AS resep
USING public.barang_jadi AS barang
WHERE resep.id_barang = barang.id_barang
  AND barang.kode_barang IN (
      'BJ-BLOUSE-26',
      'BJ-ROK-DENIM-26'
  );

DELETE FROM public.detail_produksi AS resep
USING public.bahan_baku AS bahan
WHERE resep.id_bahan = bahan.id_bahan
  AND bahan.kode_bahan IN (
      'BB-KATUN-26',
      'BB-DENIM-26',
      'BB-BENANG-26'
  );

DELETE FROM public.barang_jadi
WHERE kode_barang IN (
    'BJ-BLOUSE-26',
    'BJ-ROK-DENIM-26'
);

DELETE FROM public.bahan_baku
WHERE kode_bahan IN (
    'BB-KATUN-26',
    'BB-DENIM-26',
    'BB-BENANG-26'
);
