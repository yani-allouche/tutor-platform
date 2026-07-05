import { ClassroomEditor } from "@/components/classroom-editor";
import { getLessonBoards, getLessonWithStudent } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await getLessonWithStudent(id);
  let boards = await getLessonBoards(id);

  if (!boards.length) {
    const supabase = await createClient();
    await supabase.from("boards").insert({ lesson_id: id, name: "Board 1", order: 1 });
    boards = await getLessonBoards(id);
  }

  return <ClassroomEditor lesson={lesson} boards={boards} />;
}
