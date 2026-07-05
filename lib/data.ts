import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, LessonSummary, Student, StudentOption, StudentSummary } from "@/lib/types";

type StudentRow = Student & {
  lessons?: { lesson_date: string; deleted_at: string | null }[];
};

type LessonSummaryRow = Pick<Lesson, "id" | "title" | "lesson_date" | "updated_at"> & {
  students?: { name: string } | { name: string }[] | null;
  boards?: { id: string }[];
};

export async function getCurrentTutorId() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function getStudents(): Promise<StudentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,name,language_learned,level,goals,notes,created_at,updated_at,lessons(lesson_date,deleted_at)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as StudentRow[]).map((student) => {
    const lessonDates = (student.lessons ?? [])
      .filter((lesson) => !lesson.deleted_at)
      .map((lesson) => lesson.lesson_date)
      .filter(Boolean)
      .sort();
    return {
      id: student.id,
      name: student.name,
      language_learned: student.language_learned,
      level: student.level,
      lesson_count: lessonDates.length,
      last_lesson_date: lessonDates.at(-1) ?? null
    };
  });
}

export async function getStudentOptions(): Promise<StudentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudentOption[];
}

export async function getStudent(id: string): Promise<Student> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,name,language_learned,level,goals,notes,created_at,updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) notFound();
  return data as Student;
}

export async function getStudentLessons(studentId: string): Promise<LessonSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("id,title,lesson_date,updated_at,students(name),boards(id)")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("lesson_date", { ascending: false });

  if (error) throw new Error(error.message);
  return mapLessonSummaries((data ?? []) as unknown as LessonSummaryRow[]);
}

export async function getLessons(limit?: number): Promise<LessonSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lessons")
    .select("id,title,lesson_date,updated_at,students(name),boards(id)")
    .is("deleted_at", null)
    .order("lesson_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapLessonSummaries((data ?? []) as unknown as LessonSummaryRow[]);
}

export async function getLesson(id: string): Promise<Lesson> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("id,student_id,title,lesson_date,objective,topic,tags,created_at,updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) notFound();
  return data as Lesson;
}

export async function getLessonBoards(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .select('id,name,"order",created_at,updated_at')
    .eq("lesson_id", id)
    .order("order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

function mapLessonSummaries(rows: LessonSummaryRow[]): LessonSummary[] {
  return rows.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    lesson_date: lesson.lesson_date,
    updated_at: lesson.updated_at,
    student_name: Array.isArray(lesson.students) ? lesson.students[0]?.name ?? null : lesson.students?.name ?? null,
    board_count: lesson.boards?.length ?? 0
  }));
}
