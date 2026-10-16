-- 1) NIK KTP (Nomor Induk Kependudukan, 16 digit) di data karyawan: peserta boleh daftar/klaim
--    memakai NIK karyawan ATAU NIK KTP. Akun tetap tertaut ke NIK karyawan.
ALTER TABLE employees ADD COLUMN nik_ktp text CONSTRAINT employees_nik_ktp_ck CHECK (nik_ktp ~ '^[0-9]{16}$');
CREATE UNIQUE INDEX employees_nik_ktp_uq ON employees (nik_ktp) WHERE nik_ktp IS NOT NULL;

-- 2) Nomor HP peserta (format 08xxxxxxxxxx).
ALTER TABLE users ADD COLUMN phone text CONSTRAINT users_phone_ck CHECK (phone ~ '^08[0-9]{8,12}$');

-- 3) Gambar desain/mock-up baju dan chart ukuran per event (diunggah admin, tampil di halaman event & klaim).
ALTER TABLE events ADD COLUMN shirt_design_url text;
ALTER TABLE events ADD COLUMN size_chart_url text;
