"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTutorId } from "@/lib/data";

function studentPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    language_learned: String(formData.get("language_learned") ?? "").trim(),
    level: String(formData.get("level") ?? "").trim(),
    goals: String(formData.get("goals") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim()
  };
}

export async function createStudent(formData: FormData) {
  const supabase = await createClient();
  const tutorId = await getCurrentTutorId();
  const { data, error } = await supabase
    .from("students")
    .insert({ ...studentPayload(formData), tutor_id: tutorId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/students");
  redirect(`/students/${data.id}`);
}

export async function updateStudent(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("students").update(studentPayload(formData)).eq("id", id).is("deleted_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export async function deleteStudent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  redirect("/students");
}
