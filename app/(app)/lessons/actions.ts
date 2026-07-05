"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTutorId } from "@/lib/data";
import { splitTags } from "@/lib/format";

function lessonPayload(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  return {
    student_id: studentId || null,
    title: String(formData.get("title") ?? "").trim(),
    lesson_date: String(formData.get("lesson_date") ?? "").trim(),
    objective: String(formData.get("objective") ?? "").trim(),
    topic: String(formData.get("topic") ?? "").trim(),
    tags: splitTags(formData.get("tags"))
  };
}

export async function createLesson(formData: FormData) {
  const supabase = await createClient();
  const tutorId = await getCurrentTutorId();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({ ...lessonPayload(formData), tutor_id: tutorId })
    .select("id")
    .single();

  if (lessonError) throw new Error(lessonError.message);

  const { error: boardError } = await supabase.from("boards").insert({
    lesson_id: lesson.id,
    name: "Board 1",
    order: 1
  });

  if (boardError) throw new Error(boardError.message);

  revalidatePath("/dashboard");
  revalidatePath("/lessons");
  redirect(`/lessons/${lesson.id}`);
}

export async function updateLesson(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update(lessonPayload(formData)).eq("id", id).is("deleted_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/lessons");
  revalidatePath(`/lessons/${id}`);
  redirect(`/lessons/${id}`);
}

export async function deleteLesson(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ deleted_at: new Date().toISOString() }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/lessons");
}

export async function duplicateLesson(id: string) {
  const supabase = await createClient();
  const tutorId = await getCurrentTutorId();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("student_id,title,lesson_date,objective,topic,tags")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (lessonError || !lesson) throw new Error(lessonError?.message ?? "Lesson not found");

  const { data: boards, error: boardsError } = await supabase
    .from("boards")
    .select('name,"order"')
    .eq("lesson_id", id)
    .order("order", { ascending: true });

  if (boardsError) throw new Error(boardsError.message);

  const { data: copiedLesson, error: copyError } = await supabase
    .from("lessons")
    .insert({
      ...lesson,
      tutor_id: tutorId,
      title: `${lesson.title} copy`
    })
    .select("id")
    .single();

  if (copyError) throw new Error(copyError.message);

  const copiedBoards = boards?.length ? boards : [{ name: "Board 1", order: 1 }];
  const { error: boardCopyError } = await supabase.from("boards").insert(
    copiedBoards.map((board) => ({
      lesson_id: copiedLesson.id,
      name: board.name,
      order: board.order
    }))
  );

  if (boardCopyError) throw new Error(boardCopyError.message);

  revalidatePath("/dashboard");
  revalidatePath("/lessons");
  redirect(`/lessons/${copiedLesson.id}`);
}
