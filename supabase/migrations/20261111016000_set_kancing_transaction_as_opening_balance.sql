DO $$
DECLARE
    target_material_id BIGINT;
    target_transaction_id BIGINT;
    matching_transaction_count INTEGER;
BEGIN
    SELECT id_bahan
    INTO target_material_id
    FROM public.bahan_baku
    WHERE kode_bahan = 'BB004'
      AND nama_bahan = 'Kancing'
      AND aktif = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bahan Kancing aktif (BB004) tidak ditemukan.';
    END IF;

    SELECT COUNT(*), MIN(id_transaksi)
    INTO matching_transaction_count, target_transaction_id
    FROM public.transaksi
    WHERE id_bahan = target_material_id
      AND jenis_transaksi = 'PENILAIAN_AWAL'
      AND jumlah = 500
      AND harga_perolehan_satuan = 600
      AND keterangan = 'Penilaian stok 500 pcs Kancing';

    IF matching_transaction_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one existing Kancing valuation transaction; found %. No changes applied.',
            matching_transaction_count;
    END IF;

    UPDATE public.transaksi
    SET jenis_transaksi = 'SALDO_AWAL',
        keterangan = 'Saldo awal persediaan 500 pcs Kancing'
    WHERE id_transaksi = target_transaction_id;
END
$$;
