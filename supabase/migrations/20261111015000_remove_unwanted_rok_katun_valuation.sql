DO $$
DECLARE
    target_id BIGINT;
    target_transaction_id BIGINT;
    target_stock INTEGER;
    target_unit_cost NUMERIC(15,4);
    target_transaction_count INTEGER;
BEGIN
    SELECT id_barang, stok, harga_pokok_rata_rata
    INTO target_id, target_stock, target_unit_cost
    FROM public.barang_jadi
    WHERE kode_barang = 'BJ003'
      AND nama_barang = 'Rok Katun'
      AND aktif = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barang Rok Katun aktif (BJ003) tidak ditemukan.';
    END IF;

    SELECT COUNT(*), MIN(id_transaksi)
    INTO target_transaction_count, target_transaction_id
    FROM public.transaksi
    WHERE jenis_transaksi = 'PENILAIAN_AWAL'
      AND id_barang = target_id
      AND jumlah = target_stock
      AND harga_perolehan_satuan = 54980.0000
      AND keterangan =
          'Penilaian stok Rok Katun berdasarkan HPP resep aktif dan HPP rata-rata bahan baku saat pencatatan.';

    IF target_transaction_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one newly added Rok Katun valuation transaction; found %. No changes applied.',
            target_transaction_count;
    END IF;

    IF target_stock <> 8 OR target_unit_cost <> 54980.0000 THEN
        RAISE EXCEPTION
            'Rok Katun stock or cost differs from the values set by the added valuation; no changes applied.';
    END IF;

    DELETE FROM public.jurnal_umum
    WHERE id_transaksi = target_transaction_id;

    DELETE FROM public.transaksi
    WHERE id_transaksi = target_transaction_id;

    UPDATE public.barang_jadi
    SET harga_pokok_rata_rata = 0
    WHERE id_barang = target_id;
END
$$;
