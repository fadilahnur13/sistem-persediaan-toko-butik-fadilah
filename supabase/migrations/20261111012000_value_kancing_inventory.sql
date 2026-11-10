DO $$
DECLARE
    target_id BIGINT;
    target_stock NUMERIC(12,2);
    target_unit_cost NUMERIC(15,4);
BEGIN
    SELECT id_bahan, stok, harga_pokok_rata_rata
    INTO target_id, target_stock, target_unit_cost
    FROM public.bahan_baku
    WHERE kode_bahan = 'BB004'
      AND nama_bahan = 'Kancing'
      AND aktif = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bahan Kancing aktif (BB004) tidak ditemukan.';
    END IF;

    IF target_stock <= 0 THEN
        RAISE EXCEPTION 'Stok Kancing harus lebih dari 0 untuk dicatat nilainya.';
    END IF;

    IF target_unit_cost <> 0 THEN
        RAISE EXCEPTION 'HPP Kancing sudah terisi; penilaian tidak diterapkan.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.transaksi
        WHERE id_bahan = target_id
          AND jenis_transaksi = 'PENILAIAN_AWAL'
    ) THEN
        RAISE EXCEPTION 'Penilaian stok Kancing sudah tercatat; tidak membuat duplikat.';
    END IF;

    INSERT INTO public.transaksi (
        tanggal,
        jenis_transaksi,
        keterangan,
        id_bahan,
        jumlah,
        harga_perolehan_satuan
    )
    VALUES (
        CURRENT_DATE,
        'PENILAIAN_AWAL',
        'Penilaian stok Kancing berdasarkan harga pembelian Rp30.000 per pack isi 50 pcs.',
        target_id,
        target_stock,
        600
    );
END
$$;
