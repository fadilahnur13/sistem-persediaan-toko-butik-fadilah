DO $$
DECLARE
    target_material_id BIGINT;
    target_transaction_id BIGINT;
    matching_transaction_count INTEGER;
    matching_journal_count INTEGER;
    changed_row_count INTEGER;
BEGIN
    SELECT id_bahan
    INTO target_material_id
    FROM public.bahan_baku
    WHERE kode_bahan = 'BB004'
      AND nama_bahan = 'Kancing'
      AND aktif = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bahan Kancing aktif (BB004) tidak ditemukan.';
    END IF;

    SELECT COUNT(*), MIN(id_transaksi)
    INTO matching_transaction_count, target_transaction_id
    FROM public.transaksi
    WHERE id_bahan = target_material_id
      AND jenis_transaksi = 'SALDO_AWAL'
      AND jumlah = 500
      AND harga_perolehan_satuan = 600
      AND nilai_persediaan = 300000
      AND keterangan = 'Saldo awal persediaan 500 pcs Kancing';

    IF matching_transaction_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one existing Kancing opening-balance transaction; found %. No changes applied.',
            matching_transaction_count;
    END IF;

    SELECT COUNT(*)
    INTO matching_journal_count
    FROM public.jurnal_umum
    WHERE id_transaksi = target_transaction_id
      AND (
          (akun = 'Persediaan Bahan Baku'
              AND debit = 300000 AND kredit = 0
              AND keterangan = 'Pengakuan saldo awal persediaan')
          OR
          (akun = 'Modal Pemilik'
              AND debit = 0 AND kredit = 300000
              AND keterangan = 'Saldo awal persediaan')
      );

    IF matching_journal_count <> 2 THEN
        RAISE EXCEPTION
            'Expected the two original opening-balance journal rows; found %. No changes applied.',
            matching_journal_count;
    END IF;

    UPDATE public.transaksi
    SET jenis_transaksi = 'MASUK',
        metode_pembayaran = 'TRANSFER',
        keterangan = 'Pembelian bahan baku 500 pcs Kancing'
    WHERE id_transaksi = target_transaction_id;

    UPDATE public.jurnal_umum
    SET keterangan = 'Pembelian bahan baku'
    WHERE id_transaksi = target_transaction_id
      AND akun = 'Persediaan Bahan Baku'
      AND debit = 300000
      AND kredit = 0
      AND keterangan = 'Pengakuan saldo awal persediaan';

    GET DIAGNOSTICS changed_row_count = ROW_COUNT;
    IF changed_row_count <> 1 THEN
        RAISE EXCEPTION 'Could not update the existing inventory journal row.';
    END IF;

    UPDATE public.jurnal_umum
    SET akun = 'Bank',
        keterangan = 'Pembayaran pembelian bahan baku'
    WHERE id_transaksi = target_transaction_id
      AND akun = 'Modal Pemilik'
      AND debit = 0
      AND kredit = 300000
      AND keterangan = 'Saldo awal persediaan';

    GET DIAGNOSTICS changed_row_count = ROW_COUNT;
    IF changed_row_count <> 1 THEN
        RAISE EXCEPTION 'Could not update the existing payment journal row.';
    END IF;
END
$$;
