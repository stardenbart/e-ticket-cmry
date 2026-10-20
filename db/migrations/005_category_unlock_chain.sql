-- Kategori berantai: kategori B baru dibuka setelah kuota kategori A habis (mis. Neon Festival setelah Electric Cow).
--
--   opens_after_category_id : kategori prasyarat (event yang sama). NULL = kategori biasa.
--   unlocked_at             : kapan prasyarat habis & kategori ini terbuka. Sekali terbuka tetap terbuka
--                             (pembatalan tiket di kategori prasyarat tidak mengunci ulang).
--
-- Selama terkunci (opens_after_category_id IS NOT NULL AND unlocked_at IS NULL) kategori tidak bisa diantre
-- maupun diklaim. Saat prasyarat habis, trigger di bawah membuka kategori ini DI TRANSAKSI YANG SAMA dengan klaim
-- terakhir, dan menggeser open_at ke saat itu (bila open_at-nya sudah lewat) sehingga antrean menerima peserta
-- bertahap (admit_batch per admit_interval_sec) mulai dari saat terbuka — bukan semua sekaligus.

ALTER TABLE ticket_categories
  ADD COLUMN opens_after_category_id uuid REFERENCES ticket_categories(id) ON DELETE SET NULL,
  ADD COLUMN unlocked_at timestamptz,
  ADD CONSTRAINT categories_opens_after_not_self_ck CHECK (opens_after_category_id IS NULL OR opens_after_category_id <> id);

CREATE INDEX ticket_categories_opens_after_idx ON ticket_categories (opens_after_category_id) WHERE opens_after_category_id IS NOT NULL;

CREATE FUNCTION unlock_dependent_categories() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ticket_categories
     SET unlocked_at = now(),
         open_at = GREATEST(open_at, now()),
         version = version + 1
   WHERE opens_after_category_id = NEW.id
     AND unlocked_at IS NULL
     AND close_at > now();
  RETURN NEW;
END $$;

-- Hanya kolom claimed/quota yang memicu, jadi UPDATE di dalam fungsi (kolom lain) tidak memicu ulang.
CREATE TRIGGER categories_unlock_dependents
  AFTER UPDATE OF claimed, quota ON ticket_categories
  FOR EACH ROW WHEN (NEW.claimed >= NEW.quota)
  EXECUTE FUNCTION unlock_dependent_categories();
