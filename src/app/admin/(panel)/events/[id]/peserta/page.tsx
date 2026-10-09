import type { Metadata } from "next";
import { Participants } from "@/components/admin/participants";

export const metadata: Metadata = { title: "Peserta" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Participants id={id} />;
}
