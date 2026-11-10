DO $$
DECLARE
    target_id BIGINT;
    target_stock NUMERIC(12,2);
    target_unit_cost NUMERIC(15,4);
    recipe_unit_cost NUMERIC(15,4);
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

    IF target_stock <= 0 THEN
        RAISE EXCEPTION 'Stok Rok Katun harus lebih dari 0 untuk dicatat nilainya.';
    END IF;

    IF target_unit_cost <> 0 THEN
        RAISE EXCEPTION 'HPP Rok Katun sudah terisi; penilaian tidak diterapkan.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.transaksi
        WHERE id_barang = target_id
          AND jenis_transaksi = 'PENILAIAN_AWAL'
    ) THEN
        RAISE EXCEPTION 'Penilaian stok Rok Katun sudah tercatat; tidak membuat duplikat.';
    END IF;

    SELECT ROUND(SUM(detail.jumlah_digunakan * bahan.harga_pokok_rata_rata), 4)
    INTO recipe_unit_cost
    FROM public.detail_produksi AS detail
    JOIN public.bahan_baku AS bahan
      ON bahan.id_bahan = detail.id_bahan
    WHERE detail.id_barang = target_id
      AND bahan.aktif = TRUE
      AND bahan.harga_pokok_rata_rata > 0;

    IF recipe_unit_cost IS NULL OR recipe_unit_cost <= 0 THEN
        RAISE EXCEPTION 'HPP resep Rok Katun belum dapat dihitung dari bahan baku aktif.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.detail_produksi AS detail
        JOIN public.bahan_baku AS bahan
          ON bahan.id_bahan = detail.id_bahan
        WHERE detail.id_barang = target_id
          AND (NOT bahan.aktif OR bahan.harga_pokok_rata_rata <= 0)
    ) THEN
        RAISE EXCEPTION 'Ada bahan resep Rok Katun yang tidak aktif atau belum memiliki HPP.';
    END IF;

    INSERT INTO public.transaksi (
        tanggal,
        jenis_transaksi,
        keterangan,
        id_barang,
        jumlah,
        harga_perolehan_satuan
    )
    VALUES (
        CURRENT_DATE,
        'PENILAIAN_AWAL',
        'Penilaian stok Rok Katun berdasarkan HPP resep aktif dan HPP rata-rata bahan baku saat pencatatan.',
        target_id,
        target_stock,
        recipe_unit_cost
    );
END
$$;
