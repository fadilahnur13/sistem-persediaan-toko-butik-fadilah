BEGIN;

CREATE TEMP TABLE bahan_baku_code_map ON COMMIT DROP AS
WITH classified AS (
    SELECT
        id_bahan,
        CASE
            WHEN lower(concat_ws(' ', jenis_bahan, nama_bahan)) ~ '\mbenang\M' THEN 'BN'
            WHEN lower(concat_ws(' ', jenis_bahan, nama_bahan)) ~ '\mjarum\M' THEN 'BJ'
            WHEN lower(coalesce(jenis_bahan, '')) ~ '\m(aksesoris|aksesori|accessory|accessories)\M' THEN 'BA'
            WHEN lower(coalesce(jenis_bahan, '')) ~ '\m(kain|katun|denim|satin|brokat|linen|voal|cotton|fabric|sutra|silk)\M' THEN 'BK'
            WHEN lower(coalesce(nama_bahan, '')) ~ '\m(aksesoris|aksesori|accessory|accessories|resleting|ritsleting|zipper|kancing|button)\M' THEN 'BA'
            WHEN lower(coalesce(nama_bahan, '')) ~ '\m(kain|katun|denim|satin|brokat|linen|voal|cotton|fabric|sutra|silk)\M' THEN 'BK'
        END AS prefix
    FROM public.bahan_baku
),
numbered AS (
    SELECT
        id_bahan,
        prefix,
        row_number() OVER (PARTITION BY prefix ORDER BY id_bahan) AS sequence_number
    FROM classified
    WHERE prefix IS NOT NULL
)
SELECT
    id_bahan,
    prefix || lpad(sequence_number::TEXT, 3, '0') AS new_code
FROM numbered;

CREATE TEMP TABLE barang_jadi_code_map ON COMMIT DROP AS
WITH classified AS (
    SELECT
        id_barang,
        CASE
            WHEN lower(concat_ws(' ', kategori, nama_barang)) ~ '\mdress\M' THEN 'DR'
            WHEN lower(concat_ws(' ', kategori, nama_barang)) ~ '\mgaun\M' THEN 'GN'
            WHEN lower(concat_ws(' ', kategori, nama_barang)) ~ '\m(atasan|blouse|blus|jaket|jacket|blazer|outer|vest|kemeja|kaos|tunik|sweater|cardigan|hoodie)\M' THEN 'AT'
            WHEN lower(concat_ws(' ', kategori, nama_barang)) ~ '\m(bawahan|rok|celana|jeans|kulot|legging|shorts|skirt|trouser|pants)\M' THEN 'BW'
        END AS prefix
    FROM public.barang_jadi
),
numbered AS (
    SELECT
        id_barang,
        prefix,
        row_number() OVER (PARTITION BY prefix ORDER BY id_barang) AS sequence_number
    FROM classified
    WHERE prefix IS NOT NULL
)
SELECT
    id_barang,
    prefix || lpad(sequence_number::TEXT, 3, '0') AS new_code
FROM numbered;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM bahan_baku_code_map AS mapped
        JOIN public.bahan_baku AS existing
          ON existing.kode_bahan = mapped.new_code
         AND existing.id_bahan <> mapped.id_bahan
        WHERE NOT EXISTS (
            SELECT 1
            FROM bahan_baku_code_map AS also_mapped
            WHERE also_mapped.id_bahan = existing.id_bahan
        )
    ) THEN
        RAISE EXCEPTION 'Kode bahan baru bertabrakan dengan bahan yang tidak dapat diklasifikasikan; tidak ada kode yang diubah.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM barang_jadi_code_map AS mapped
        JOIN public.barang_jadi AS existing
          ON existing.kode_barang = mapped.new_code
         AND existing.id_barang <> mapped.id_barang
        WHERE NOT EXISTS (
            SELECT 1
            FROM barang_jadi_code_map AS also_mapped
            WHERE also_mapped.id_barang = existing.id_barang
        )
    ) THEN
        RAISE EXCEPTION 'Kode barang baru bertabrakan dengan barang jadi yang tidak dapat diklasifikasikan; tidak ada kode yang diubah.';
    END IF;
END
$$;

UPDATE public.bahan_baku AS bahan
SET kode_bahan = 'TMPB' || bahan.id_bahan::TEXT
FROM bahan_baku_code_map AS mapped
WHERE mapped.id_bahan = bahan.id_bahan;

UPDATE public.bahan_baku AS bahan
SET kode_bahan = mapped.new_code
FROM bahan_baku_code_map AS mapped
WHERE mapped.id_bahan = bahan.id_bahan;

UPDATE public.barang_jadi AS barang
SET kode_barang = 'TMPP' || barang.id_barang::TEXT
FROM barang_jadi_code_map AS mapped
WHERE mapped.id_barang = barang.id_barang;

UPDATE public.barang_jadi AS barang
SET kode_barang = mapped.new_code
FROM barang_jadi_code_map AS mapped
WHERE mapped.id_barang = barang.id_barang;

COMMIT;
