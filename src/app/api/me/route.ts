import { json, route } from "@/lib/http";
import { currentUser, profileComplete } from "@/lib/auth";

export const GET = route(async () => {
  const u = await currentUser();
  if (!u) return json({ user: null });
  return json({
    user: {
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      nik: u.nik,
      verified: !!u.email_verified_at,
      profileComplete: profileComplete(u),
    },
  });
});
