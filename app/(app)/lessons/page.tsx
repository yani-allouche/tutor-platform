import Link from "next/link";
import { NotebookTabs, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { GuestLessonsPage } from "@/components/guest-workspace";
import { LessonList } from "@/components/lesson-list";
import { PageHeader } from "@/components/page-header";
import { getOptionalUser } from "@/lib/auth";
import { getLessons } from "@/lib/data";

export default async function LessonsPage() {
  const user = await getOptionalUser();
  if (!user) return <GuestLessonsPage />;

  const lessons = await getLessons();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Lessons"
        description="Classroom workspaces by student and date."
        action={
          <Link className="btn-primary" href="/lessons/new">
            <Plus size={16} aria-hidden="true" />
            New lesson
          </Link>
        }
      />

      {lessons.length ? (
        <LessonList lessons={lessons} />
      ) : (
        <EmptyState
          icon={NotebookTabs}
          title="No lessons yet"
          description="Create a lesson for a student or keep it unlinked."
          action={
            <Link className="btn-primary" href="/lessons/new">
              <Plus size={16} aria-hidden="true" />
              Create lesson
            </Link>
          }
        />
      )}
    </div>
  );
}
