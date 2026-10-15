-- Jumlah digit NIK tidak selalu sama (mis. 04.0018 dan 04.12345). Format yang berlaku:
--   CMD : 04.<1-8 angka>              contoh 04.0018, 04.12345
--   OS  : A1.<1-4 angka>.<1-8 angka>  contoh A1.23.4567
ALTER TABLE employees DROP CONSTRAINT employees_nik_format_ck;
ALTER TABLE employees ADD CONSTRAINT employees_nik_format_ck CHECK (
  (category = 'CMD' AND nik ~ '^04\.[0-9]{1,8}$') OR
  (category = 'OS'  AND nik ~ '^A1\.[0-9]{1,4}\.[0-9]{1,8}$')
);
