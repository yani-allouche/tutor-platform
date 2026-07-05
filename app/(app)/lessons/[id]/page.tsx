import Link from "next/link";
import { Copy, Edit, Layers, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getLesson, getLessonBoards, getStudentOptions } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { deleteLesson, duplicateLesson } from "../actions";

export default async function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lesson, boards, students] = await Promise.all([getLesson(id), getLessonBoards(id), getStudentOptions()]);
  const student = students.find((option) => option.id === lesson.student_id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={lesson.title}
        description={`${formatDate(lesson.lesson_date)} · ${student?.name ?? "Unlinked lesson"}`}
        action={
          <>
            <Link className="btn-secondary" href={`/lessons/${lesson.id}/edit`}>
              <Edit size={16} aria-hidden="true" />
              Edit
            </Link>
            <form action={duplicateLesson.bind(null, lesson.id)}>
              <button className="btn-secondary" type="submit">
                <Copy size={16} aria-hidden="true" />
                Duplicate
              </button>
            </form>
            <form action={deleteLesson.bind(null, lesson.id)}>
              <button className="btn-danger" type="submit">
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </form>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <section className="panel p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Lesson plan</h2>
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="font-medium text-slate-700">Topic</dt>
              <dd className="mt-1 text-slate-600">{lesson.topic || "No topic added."}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Objective</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-600">{lesson.objective || "No objective added."}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {lesson.tags.length ? (
                  lesson.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-600">No tags.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers size={18} className="text-leaf" aria-hidden="true" />
            <h2 className="text-base font-semibold text-ink">Boards</h2>
          </div>
          <div className="space-y-2">
            {boards.map((board) => (
              <div key={board.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                {board.name}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Updated {formatDateTime(lesson.updated_at)}</p>
        </aside>
      </div>
    </div>
  );
}
