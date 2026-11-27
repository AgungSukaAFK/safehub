-- =====================================================================================
-- 29 MATRIX APD MENGIKUTI RUMUS EXCEL (Safe Hub, fase 6; keputusan user 2026-11-27)
--   Nilai awal di 24 diambil dari sheet "Matrix APD". User menetapkan yang benar = rumus sheet "Populasi Manpower"
--   (Monitoring APD GMI 2026.xlsx): Duedate = Supply + N hari; status MR bila Days Left <= ambang.
--     Kemeja / Kaos Safety : 180 hari, MR 60 hari     Sepatu : 545 hari, MR 90 hari
--     Helm                 : 1095 hari, MR 365 hari   Jeans  : 730 hari, MR 365 hari
--   Jenis lain tidak diubah. Idempoten; tercatat di apd_types_logs (aksi update, tanpa aktor).
-- =====================================================================================
update __APP__.apd_types t
   set interval_days = x.interval_days, interval_label = x.interval_label, warn_days = x.warn_days
  from (values ('uniform_shirt',  180::smallint,  '2x setahun',       60::smallint),
               ('uniform_tshirt', 180::smallint,  '2x setahun',       60::smallint),
               ('safety_shoes',   545::smallint,  '1x per 1,5 tahun', 90::smallint),
               ('safety_helmet',  1095::smallint, '1x per 3 tahun',   365::smallint),
               ('uniform_pants',  730::smallint,  '1x per 2 tahun',   365::smallint)) x(code, interval_days, interval_label, warn_days)
 where t.code = x.code
   and (t.interval_days, t.interval_label, t.warn_days) is distinct from (x.interval_days, x.interval_label, x.warn_days);
