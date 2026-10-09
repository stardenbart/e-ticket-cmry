import { ButtonLink } from "@/components/ui";
import { StickerNote } from "@/components/site/ornaments";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-8 pt-20 sm:pt-24">
      <StickerNote sticker="cowWink" title="Halaman tidak ditemukan" action={<ButtonLink href="/">Kembali ke beranda</ButtonLink>}>
        Event atau halaman yang Anda cari tidak tersedia, sudah dihapus, atau belum dipublikasikan.
      </StickerNote>
    </div>
  );
}
