import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tutor } = await supabase
    .from("tutors")
    .select("first_name,last_name,email")
    .eq("id", user.id)
    .single();

  const tutorName =
    [tutor?.first_name, tutor?.last_name].filter(Boolean).join(" ") || tutor?.email || user.email || "Tutor";

  return <AppShell tutorName={tutorName}>{children}</AppShell>;
}
