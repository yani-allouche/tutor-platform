import { PageHeader } from "@/components/page-header";
import { LessonForm } from "@/components/lesson-form";
import { getStudentOptions } from "@/lib/data";
import { createLesson } from "../actions";

export default async function NewLessonPage({
  searchParams
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const [students, params] = await Promise.all([getStudentOptions(), searchParams]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New lesson" description="Create a lesson with or without a linked student." />
      <LessonForm
        action={createLesson}
        students={students}
        submitLabel="Create lesson"
        defaultStudentId={params.studentId}
      />
    </div>
  );
}
