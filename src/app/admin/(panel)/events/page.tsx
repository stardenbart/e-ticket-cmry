import type { Metadata } from "next";
import { EventsList } from "@/components/admin/events-list";

export const metadata: Metadata = { title: "Daftar Event" };

export default function Page() {
  return <EventsList />;
}
