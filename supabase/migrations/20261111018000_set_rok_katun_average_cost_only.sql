DO $$
DECLARE
    target_id BIGINT;
    target_stock INTEGER;
    current_unit_cost NUMERIC(15,4);
    recipe_unit_cost NUMERIC(15,4);
BEGIN
    SELECT id_barang, stok, harga_pokok_rata_rata
    INTO target_id, target_stock, current_unit_cost
    FROM public.barang_jadi
    WHERE kode_barang = 'BJ003'
      AND nama_barang = 'Rok Katun'
      AND aktif = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barang Rok Katun aktif (BJ003) tidak ditemukan.';
    END IF;

    IF target_stock <> 8 THEN
        RAISE EXCEPTION
            'Rok Katun stock differs from the expected 8 units; no HPP change applied.';
    END IF;

    IF current_unit_cost <> 0 THEN
        RAISE EXCEPTION
            'Rok Katun average HPP is not zero; no HPP change applied.';
    END IF;

    SELECT ROUND(SUM(detail.jumlah_digunakan * bahan.harga_pokok_rata_rata), 4)
    INTO recipe_unit_cost
    FROM public.detail_produksi AS detail
    JOIN public.bahan_baku AS bahan
      ON bahan.id_bahan = detail.id_bahan
    WHERE detail.id_barang = target_id
      AND bahan.aktif = TRUE;

    IF recipe_unit_cost IS NULL OR recipe_unit_cost <= 0 THEN
        RAISE EXCEPTION 'HPP resep Rok Katun belum dapat dihitung.';
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

    UPDATE public.barang_jadi
    SET harga_pokok_rata_rata = recipe_unit_cost
    WHERE id_barang = target_id;
END
$$;
