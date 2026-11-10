UPDATE public.bahan_baku
SET kode_bahan = CASE kode_bahan
        WHEN 'SIM-BB-KATUN26' THEN 'BB-KATUN-26'
        WHEN 'SIM-BB-DENIM26' THEN 'BB-DENIM-26'
        WHEN 'SIM-BB-BENANG26' THEN 'BB-BENANG-26'
    END,
    nama_bahan = CASE kode_bahan
        WHEN 'SIM-BB-KATUN26' THEN 'Kain Katun'
        WHEN 'SIM-BB-DENIM26' THEN 'Kain Denim'
        WHEN 'SIM-BB-BENANG26' THEN 'Benang Jahit'
    END
WHERE kode_bahan IN ('SIM-BB-KATUN26', 'SIM-BB-DENIM26', 'SIM-BB-BENANG26');

UPDATE public.barang_jadi
SET kode_barang = CASE kode_barang
        WHEN 'SIM-BJ-BLOUSE26' THEN 'BJ-BLOUSE-26'
        WHEN 'SIM-BJ-ROKDEN26' THEN 'BJ-ROK-DENIM-26'
    END,
    nama_barang = CASE kode_barang
        WHEN 'SIM-BJ-BLOUSE26' THEN 'Blouse Katun'
        WHEN 'SIM-BJ-ROKDEN26' THEN 'Rok Denim'
    END
WHERE kode_barang IN ('SIM-BJ-BLOUSE26', 'SIM-BJ-ROKDEN26');

UPDATE public.transaksi
SET keterangan = replace(
    replace(keterangan, '[SIMULASI SEPTEMBER 2026] ', ''),
    '[SIMULASI NOVEMBER 2026] ',
    ''
)
WHERE keterangan LIKE '[SIMULASI SEPTEMBER 2026] %'
   OR keterangan LIKE '[SIMULASI NOVEMBER 2026] %';

UPDATE public.jurnal_umum
SET keterangan = replace(
    replace(keterangan, '[SIMULASI SEPTEMBER 2026] ', ''),
    '[SIMULASI NOVEMBER 2026] ',
    ''
)
WHERE keterangan LIKE '[SIMULASI SEPTEMBER 2026] %'
   OR keterangan LIKE '[SIMULASI NOVEMBER 2026] %';
