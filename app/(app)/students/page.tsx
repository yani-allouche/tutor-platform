import Link from "next/link";
import { ExternalLink, Plus, Trash2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { GuestStudentsPage } from "@/components/guest-workspace";
import { PageHeader } from "@/components/page-header";
import { getOptionalUser } from "@/lib/auth";
import { getStudents } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { deleteStudent } from "./actions";

export default async function StudentsPage() {
  const user = await getOptionalUser();
  if (!user) return <GuestStudentsPage />;

  const students = await getStudents();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Students"
        description="Private learner notes and lesson history."
        action={
          <Link className="btn-primary" href="/students/new">
            <Plus size={16} aria-hidden="true" />
            New student
          </Link>
        }
      />

      {students.length ? (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Lessons</th>
                  <th className="px-4 py-3">Last lesson</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {students.map((student) => (
                  <tr key={student.id} className="group hover:bg-slate-50">
                    <td className="p-0 font-medium text-ink">
                      <StudentRowLink studentId={student.id}>{student.name}</StudentRowLink>
                    </td>
                    <td className="p-0 text-slate-600">
                      <StudentRowLink studentId={student.id}>{student.lesson_count}</StudentRowLink>
                    </td>
                    <td className="p-0 text-slate-600">
                      <StudentRowLink studentId={student.id}>{formatDate(student.last_lesson_date)}</StudentRowLink>
                    </td>
                    <td className="px-4 py-3 group-hover:bg-slate-50">
                      <div className="flex justify-end gap-2">
                        <Link className="rounded-md p-2 text-slate-600 hover:bg-slate-100" href={`/students/${student.id}`} aria-label="Open student">
                          <ExternalLink size={16} aria-hidden="true" />
                        </Link>
                        <form action={deleteStudent.bind(null, student.id)}>
                          <button className="rounded-md p-2 text-coral hover:bg-red-50" aria-label="Delete student">
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Create the first student profile for your tutor workspace."
          action={
            <Link className="btn-primary" href="/students/new">
              <Plus size={16} aria-hidden="true" />
              Create student
            </Link>
          }
        />
      )}
    </div>
  );
}

function StudentRowLink({ studentId, children }: { studentId: string; children: ReactNode }) {
  return (
    <Link className="block h-full px-4 py-3 transition-colors group-hover:text-leaf" href={`/students/${studentId}`}>
      {children}
    </Link>
  );
}
