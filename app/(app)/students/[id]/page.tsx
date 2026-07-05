import Link from "next/link";
import { Edit, NotebookTabs, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LessonList } from "@/components/lesson-list";
import { PageHeader } from "@/components/page-header";
import { getStudent, getStudentLessons } from "@/lib/data";
import { deleteStudent } from "../actions";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, lessons] = await Promise.all([getStudent(id), getStudentLessons(id)]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={student.name}
        description={[student.language_learned, student.level].filter(Boolean).join(" · ") || "Student profile"}
        action={
          <>
            <Link className="btn-secondary" href={`/students/${student.id}/edit`}>
              <Edit size={16} aria-hidden="true" />
              Edit
            </Link>
            <form action={deleteStudent.bind(null, student.id)}>
              <button className="btn-danger" type="submit">
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </form>
          </>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Goals</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{student.goals || "No goals added yet."}</p>
        </section>
        <section className="panel p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{student.notes || "No notes added yet."}</p>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Linked lessons</h2>
          <Link className="btn-secondary" href={`/lessons/new?studentId=${student.id}`}>
            <Plus size={16} aria-hidden="true" />
            Lesson
          </Link>
        </div>
        {lessons.length ? (
          <LessonList lessons={lessons} />
        ) : (
          <EmptyState
            icon={NotebookTabs}
            title="No linked lessons"
            description="Create a lesson for this student to start their history."
          />
        )}
      </section>
    </div>
  );
}
