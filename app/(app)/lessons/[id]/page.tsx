import { ClassroomEditor } from "@/components/classroom-editor";
import { GuestLessonDetailPage } from "@/components/guest-workspace";
import { getOptionalUser } from "@/lib/auth";
import { getLessonBoards, getLessonSwitcherOptions, getLessonWithStudent } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) return <GuestLessonDetailPage id={id} />;

  const [lesson, lessonOptions] = await Promise.all([getLessonWithStudent(id), getLessonSwitcherOptions()]);
  let boards = await getLessonBoards(id);

  if (!boards.length) {
    const supabase = await createClient();
    await supabase.from("boards").insert({ lesson_id: id, name: "Board 1", order: 1 });
    boards = await getLessonBoards(id);
  }

  return <ClassroomEditor lesson={lesson} boards={boards} lessonOptions={lessonOptions} />;
}
