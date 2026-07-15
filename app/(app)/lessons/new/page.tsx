import { PageHeader } from "@/components/page-header";
import { LessonForm } from "@/components/lesson-form";
import { GuestNewLessonPage } from "@/components/guest-workspace";
import { getOptionalUser } from "@/lib/auth";
import { getStudentOptions } from "@/lib/data";
import { createLesson } from "../actions";

export default async function NewLessonPage({
  searchParams
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const [user, params] = await Promise.all([getOptionalUser(), searchParams]);
  if (!user) return <GuestNewLessonPage defaultStudentId={params.studentId} />;

  const students = await getStudentOptions();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New lesson" description="Choose a student and date." />
      <LessonForm
        action={createLesson}
        students={students}
        submitLabel="Create lesson"
        defaultStudentId={params.studentId}
      />
    </div>
  );
}
