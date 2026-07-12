import Link from "next/link";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import type { LessonSummary } from "@/lib/types";
import { deleteLesson, duplicateLesson } from "@/app/(app)/lessons/actions";

export function LessonList({ lessons, showActions = true }: { lessons: LessonSummary[]; showActions?: boolean }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Lesson date</th>
              <th className="px-4 py-3">Last updated</th>
              <th className="px-4 py-3">Boards</th>
              {showActions ? <th className="px-4 py-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lessons.map((lesson) => (
              <tr key={lesson.id} className="group hover:bg-slate-50">
                <td className="p-0 font-medium text-ink">
                  <LessonRowLink lessonId={lesson.id}>{lesson.student_name ?? "Unlinked"}</LessonRowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <LessonRowLink lessonId={lesson.id}>{formatDate(lesson.lesson_date)}</LessonRowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <LessonRowLink lessonId={lesson.id}>{formatDateTime(lesson.updated_at)}</LessonRowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <LessonRowLink lessonId={lesson.id}>{lesson.board_count}</LessonRowLink>
                </td>
                {showActions ? (
                  <td className="px-4 py-3 group-hover:bg-slate-50">
                    <div className="flex justify-end gap-2">
                      <Link className="rounded-md p-2 text-slate-600 hover:bg-slate-100" href={`/lessons/${lesson.id}`} aria-label="Open lesson">
                        <ExternalLink size={16} aria-hidden="true" />
                      </Link>
                      <form action={duplicateLesson.bind(null, lesson.id)}>
                        <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Duplicate lesson">
                          <Copy size={16} aria-hidden="true" />
                        </button>
                      </form>
                      <form action={deleteLesson.bind(null, lesson.id)}>
                        <button className="rounded-md p-2 text-coral hover:bg-red-50" aria-label="Delete lesson">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LessonRowLink({ lessonId, children }: { lessonId: string; children: ReactNode }) {
  return (
    <Link className="block h-full px-4 py-3 transition-colors group-hover:text-leaf" href={`/lessons/${lessonId}`}>
      {children}
    </Link>
  );
}
