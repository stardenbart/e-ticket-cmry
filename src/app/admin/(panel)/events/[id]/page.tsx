import type { Metadata } from "next";
import { EventEditor } from "@/components/admin/event-editor";

export const metadata: Metadata = { title: "Kelola Event" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventEditor id={id} />;
}
