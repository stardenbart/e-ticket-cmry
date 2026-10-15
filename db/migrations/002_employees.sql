-- Daftar karyawan eligible (acuan klaim tiket) + identitas berbasis NIK karyawan.
--
-- NIK (Nomor Induk Karyawan):
--   CMD (karyawan tetap)  : 04.XXXXX     contoh 04.12345
--   OS  (outsourcing)     : A1.XX.XXXX   contoh A1.23.4567

CREATE TABLE employees (
  nik        text PRIMARY KEY,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  -- Nama ternormalisasi untuk pencocokan (huruf besar, tanpa tanda baca, spasi tunggal).
  name_key   text NOT NULL,
  dept       text NOT NULL DEFAULT '',
  category   text NOT NULL CHECK (category IN ('CMD', 'OS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT employees_nik_format_ck CHECK (
    (category = 'CMD' AND nik ~ '^04\.[0-9]{5}$') OR
    (category = 'OS'  AND nik ~ '^A1\.[0-9]{2}\.[0-9]{4}$')
  )
);
CREATE INDEX employees_dept_idx ON employees (dept);
CREATE INDEX employees_name_key_idx ON employees (name_key);
CREATE TRIGGER employees_touch BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Akun ↔ karyawan: satu NIK hanya boleh dipakai satu akun. (Tanpa FK agar import ulang daftar karyawan
-- tidak memutus akun; keterkaitan dicek di aplikasi.)
ALTER TABLE users ADD COLUMN nik text;
CREATE UNIQUE INDEX users_nik_uq ON users (nik) WHERE nik IS NOT NULL;

-- Jenis identitas kini juga NIK karyawan.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_type_check;
ALTER TABLE users ADD CONSTRAINT users_id_type_check CHECK (id_type IN ('KTP', 'SIM', 'PASPOR', 'NIK'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_last4_check;

-- Data tiket: NIK, departemen, dan ukuran baju disalin saat klaim.
ALTER TABLE tickets ADD COLUMN nik text;
ALTER TABLE tickets ADD COLUMN dept text;
ALTER TABLE tickets ADD COLUMN shirt_size text
  CHECK (shirt_size IN ('2S', '3S', '4S', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'));
CREATE INDEX tickets_nik_idx ON tickets (nik);

-- Masuk/daftar dengan akun Google: `sub` dari id_token Google (stabil per akun Google).
ALTER TABLE users ADD COLUMN google_sub text;
CREATE UNIQUE INDEX users_google_sub_uq ON users (google_sub) WHERE google_sub IS NOT NULL;
