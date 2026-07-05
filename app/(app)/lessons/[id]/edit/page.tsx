import { PageHeader } from "@/components/page-header";
import { LessonForm } from "@/components/lesson-form";
import { getLesson, getStudentOptions } from "@/lib/data";
import { updateLesson } from "../../actions";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lesson, students] = await Promise.all([getLesson(id), getStudentOptions()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit lesson" description={lesson.title} />
      <LessonForm action={updateLesson.bind(null, lesson.id)} lesson={lesson} students={students} submitLabel="Save lesson" />
    </div>
  );
}
