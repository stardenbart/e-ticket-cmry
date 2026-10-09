export type AdminEvent = {
  id: string;
  slug: string;
  name: string;
  event_type: string;
  organizer: string;
  description: string;
  terms: string;
  banner_url: string | null;
  thumb_url: string | null;
  gallery: string[];
  venue: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  start_at: string;
  end_at: string;
  gate_open_at: string | null;
  gates: string[];
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  cancel_deadline_hours: number;
  require_id_match: boolean;
  email_text: string;
  version: number;
};

export type AdminCategory = {
  id: string;
  name: string;
  description: string;
  quota: number;
  claimed: number;
  open_at: string;
  close_at: string;
  is_closed: boolean;
  sort_order: number;
  color: string;
  admit_batch: number;
  admit_interval_sec: number;
  version: number;
  ticket_count: number;
};

export type AdminStaff = { user_id: string; gates: string[]; valid_until: string; email: string; full_name: string; pending: boolean };

export type EventPayload = {
  event: AdminEvent;
  categories: AdminCategory[];
  staff: AdminStaff[];
  status: string;
  problems: string[];
  eventTypes: string[];
};
