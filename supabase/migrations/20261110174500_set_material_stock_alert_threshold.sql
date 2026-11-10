ALTER TABLE public.bahan_baku
    ALTER COLUMN stok_minimum SET DEFAULT 5;

UPDATE public.bahan_baku
SET stok_minimum = 5
WHERE stok_minimum IS DISTINCT FROM 5;
