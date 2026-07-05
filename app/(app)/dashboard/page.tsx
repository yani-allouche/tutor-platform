import Link from "next/link";
import { NotebookTabs, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LessonList } from "@/components/lesson-list";
import { PageHeader } from "@/components/page-header";
import { getLessons, getStudents } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const [lessons, students] = await Promise.all([getLessons(6), getStudents()]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Your private tutor workspace."
        action={
          <>
            <Link className="btn-secondary" href="/students/new">
              <Plus size={16} aria-hidden="true" />
              Student
            </Link>
            <Link className="btn-primary" href="/lessons/new">
              <Plus size={16} aria-hidden="true" />
              Lesson
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Students</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{students.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Recent lessons</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{lessons.length}</p>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent lessons</h2>
          <Link className="text-sm font-medium text-leaf hover:underline" href="/lessons">
            View all
          </Link>
        </div>
        {lessons.length ? (
          <LessonList lessons={lessons} />
        ) : (
          <EmptyState
            icon={NotebookTabs}
            title="No lessons yet"
            description="Create a lesson with or without a linked student."
            action={
              <Link className="btn-primary" href="/lessons/new">
                <Plus size={16} aria-hidden="true" />
                Create lesson
              </Link>
            }
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Students</h2>
          <Link className="text-sm font-medium text-leaf hover:underline" href="/students">
            View all
          </Link>
        </div>
        {students.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.slice(0, 6).map((student) => (
              <Link key={student.id} className="panel p-4 transition hover:border-leaf" href={`/students/${student.id}`}>
                <p className="font-medium text-ink">{student.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {[student.language_learned, student.level].filter(Boolean).join(" · ") || "No level set"}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {student.lesson_count} lessons
                  {student.last_lesson_date ? ` · Last ${formatDate(student.last_lesson_date)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No students yet"
            description="Create a profile to track goals, notes, and lesson history."
            action={
              <Link className="btn-primary" href="/students/new">
                <Plus size={16} aria-hidden="true" />
                Create student
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
