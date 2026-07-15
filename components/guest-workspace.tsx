"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Copy, ExternalLink, NotebookTabs, Plus, Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatDateTime } from "@/lib/format";

type GuestStudent = {
  id: string;
  name: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type GuestLesson = {
  id: string;
  student_id: string | null;
  title: string;
  lesson_date: string;
  created_at: string;
  updated_at: string;
};

type GuestStore = {
  students: GuestStudent[];
  lessons: GuestLesson[];
};

const STORE_KEY = "tutor-platform:guest-workspace";

function emptyStore(): GuestStore {
  return { students: [], lessons: [] };
}

function readStore(): GuestStore {
  if (typeof window === "undefined") return emptyStore();

  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    if (!stored) return emptyStore();
    const parsed = JSON.parse(stored) as Partial<GuestStore>;
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : []
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: GuestStore) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("guest-workspace-change"));
}

function useGuestStore() {
  const [store, setStore] = useStateFromLocalStorage();

  function update(nextStore: GuestStore) {
    setStore(nextStore);
    writeStore(nextStore);
  }

  return { store, update };
}

function useStateFromLocalStorage() {
  const [store, setStore] = useState<GuestStore>(emptyStore);

  useEffect(() => {
    setStore(readStore());

    function handleChange() {
      setStore(readStore());
    }

    window.addEventListener("storage", handleChange);
    window.addEventListener("guest-workspace-change", handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("guest-workspace-change", handleChange);
    };
  }, []);

  return [store, setStore] as const;
}

export function GuestDashboard() {
  const { store } = useGuestStore();
  const students = getStudentSummaries(store);
  const lessons = getLessonSummaries(store).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Try the tutor workspace before creating an account."
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
        {lessons.length ? <GuestLessonTable lessons={lessons} /> : <GuestEmptyLessons />}
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
                <p className="mt-3 text-xs text-slate-500">
                  {student.lesson_count} lessons
                  {student.last_lesson_date ? ` · Last ${formatDate(student.last_lesson_date)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <GuestEmptyStudents />
        )}
      </section>
    </div>
  );
}

export function GuestStudentsPage() {
  const { store, update } = useGuestStore();
  const students = getStudentSummaries(store);

  function deleteStudent(id: string) {
    update({
      students: store.students.filter((student) => student.id !== id),
      lessons: store.lessons.map((lesson) => (lesson.student_id === id ? { ...lesson, student_id: null, updated_at: now() } : lesson))
    });
  }

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
                      <RowLink href={`/students/${student.id}`}>{student.name}</RowLink>
                    </td>
                    <td className="p-0 text-slate-600">
                      <RowLink href={`/students/${student.id}`}>{student.lesson_count}</RowLink>
                    </td>
                    <td className="p-0 text-slate-600">
                      <RowLink href={`/students/${student.id}`}>{formatDate(student.last_lesson_date)}</RowLink>
                    </td>
                    <td className="px-4 py-3 group-hover:bg-slate-50">
                      <div className="flex justify-end gap-2">
                        <Link className="rounded-md p-2 text-slate-600 hover:bg-slate-100" href={`/students/${student.id}`} aria-label="Open student">
                          <ExternalLink size={16} aria-hidden="true" />
                        </Link>
                        <button className="rounded-md p-2 text-coral hover:bg-red-50" onClick={() => deleteStudent(student.id)} aria-label="Delete student">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <GuestEmptyStudents />
      )}
    </div>
  );
}

export function GuestNewStudentPage() {
  return <GuestStudentFormPage mode="create" />;
}

export function GuestEditStudentPage({ id }: { id: string }) {
  return <GuestStudentFormPage id={id} mode="edit" />;
}

function GuestStudentFormPage({ id, mode }: { id?: string; mode: "create" | "edit" }) {
  const router = useRouter();
  const { store, update } = useGuestStore();
  const student = id ? store.students.find((item) => item.id === id) : undefined;

  function submit(formData: FormData) {
    const timestamp = now();
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim()
    };

    if (!payload.name) return;

    if (mode === "edit" && student) {
      update({
        ...store,
        students: store.students.map((item) => (item.id === student.id ? { ...item, ...payload, updated_at: timestamp } : item))
      });
      router.push(`/students/${student.id}`);
      return;
    }

    const nextStudent: GuestStudent = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: timestamp,
      updated_at: timestamp
    };
    update({ ...store, students: [nextStudent, ...store.students] });
    router.push(`/students/${nextStudent.id}`);
  }

  if (mode === "edit" && !student) return <GuestNotFound label="student" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={mode === "edit" ? "Edit student" : "New student"}
        description={mode === "edit" ? "Update learner notes." : "Create a private learner profile."}
      />
      <form action={submit} className="panel grid gap-5 p-5">
        <div className="space-y-1.5">
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="field" id="name" name="name" defaultValue={student?.name} required />
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea className="field min-h-40" id="notes" name="notes" defaultValue={student?.notes} />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">
            {mode === "edit" ? "Save student" : "Create student"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function GuestStudentDetailPage({ id }: { id: string }) {
  const { store } = useGuestStore();
  const student = store.students.find((item) => item.id === id);
  if (!student) return <GuestNotFound label="student" />;

  const lessons = getLessonSummaries(store).filter((lesson) => store.lessons.find((item) => item.id === lesson.id)?.student_id === student.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={student.name}
        description="Student profile and linked lessons."
        action={
          <>
            <Link className="btn-secondary" href={`/students/${student.id}/edit`}>
              Edit
            </Link>
            <Link className="btn-primary" href={`/lessons/new?studentId=${student.id}`}>
              <Plus size={16} aria-hidden="true" />
              Lesson
            </Link>
          </>
        }
      />
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="panel p-5 md:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{student.notes || "No notes yet."}</p>
        </div>
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold text-ink">Profile</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="text-ink">{formatDateTime(student.created_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Updated</dt>
              <dd className="text-ink">{formatDateTime(student.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Linked lessons</h2>
          <Link className="btn-secondary" href={`/lessons/new?studentId=${student.id}`}>
            <Plus size={16} aria-hidden="true" />
            Lesson
          </Link>
        </div>
        {lessons.length ? <GuestLessonTable lessons={lessons} /> : <GuestEmptyLinkedLessons />}
      </section>
    </div>
  );
}

export function GuestLessonsPage() {
  const { store } = useGuestStore();
  const lessons = getLessonSummaries(store);

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
      {lessons.length ? <GuestLessonTable lessons={lessons} /> : <GuestEmptyLessons />}
    </div>
  );
}

export function GuestNewLessonPage({ defaultStudentId }: { defaultStudentId?: string }) {
  return <GuestLessonFormPage mode="create" defaultStudentId={defaultStudentId} />;
}

export function GuestEditLessonPage({ id }: { id: string }) {
  return <GuestLessonFormPage id={id} mode="edit" />;
}

function GuestLessonFormPage({
  id,
  mode,
  defaultStudentId
}: {
  id?: string;
  mode: "create" | "edit";
  defaultStudentId?: string;
}) {
  const router = useRouter();
  const { store, update } = useGuestStore();
  const lesson = id ? store.lessons.find((item) => item.id === id) : undefined;

  function submit(formData: FormData) {
    const timestamp = now();
    const lessonDate = String(formData.get("lesson_date") ?? "").trim();
    if (!lessonDate) return;

    const payload = {
      student_id: String(formData.get("student_id") ?? "").trim() || null,
      title: `Lesson ${lessonDate}`,
      lesson_date: lessonDate
    };

    if (mode === "edit" && lesson) {
      update({
        ...store,
        lessons: store.lessons.map((item) => (item.id === lesson.id ? { ...item, ...payload, updated_at: timestamp } : item))
      });
      router.push(`/lessons/${lesson.id}`);
      return;
    }

    const nextLesson: GuestLesson = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: timestamp,
      updated_at: timestamp
    };
    update({ ...store, lessons: [nextLesson, ...store.lessons] });
    router.push(`/lessons/${nextLesson.id}`);
  }

  if (mode === "edit" && !lesson) return <GuestNotFound label="lesson" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={mode === "edit" ? "Edit lesson" : "New lesson"} description="Choose a student and date." />
      <form action={submit} className="panel grid gap-5 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label" htmlFor="student_id">
            Student
          </label>
          <select className="field" id="student_id" name="student_id" defaultValue={lesson?.student_id ?? defaultStudentId ?? ""}>
            <option value="">No linked student</option>
            {store.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="lesson_date">
            Lesson date
          </label>
          <input
            className="field"
            id="lesson_date"
            name="lesson_date"
            type="date"
            defaultValue={lesson?.lesson_date ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <button className="btn-primary" type="submit">
            {mode === "edit" ? "Save lesson" : "Create lesson"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function GuestLessonDetailPage({ id }: { id: string }) {
  const { store } = useGuestStore();
  const lesson = store.lessons.find((item) => item.id === id);
  if (!lesson) return <GuestNotFound label="lesson" />;

  const student = lesson.student_id ? store.students.find((item) => item.id === lesson.student_id) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={formatDate(lesson.lesson_date)}
        description={student ? `Lesson for ${student.name}` : "Unlinked lesson"}
        action={
          <Link className="btn-secondary" href={`/lessons/${lesson.id}/edit`}>
            Edit
          </Link>
        }
      />
      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Classroom preview</h2>
        <p className="mt-2 text-sm text-slate-600">
          The saved classroom, file uploads, and whiteboard history are available after creating an account.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn-primary" href="/signup">
            Create account to save permanently
          </Link>
          <Link className="btn-secondary" href="/lessons">
            Back to lessons
          </Link>
        </div>
      </div>
    </div>
  );
}

function GuestLessonTable({
  lessons
}: {
  lessons: Array<{ id: string; lesson_date: string; updated_at: string; student_name: string | null; board_count: number }>;
}) {
  const { store, update } = useGuestStore();

  function deleteLesson(id: string) {
    update({ ...store, lessons: store.lessons.filter((lesson) => lesson.id !== id) });
  }

  function duplicateLesson(id: string) {
    const lesson = store.lessons.find((item) => item.id === id);
    if (!lesson) return;
    const timestamp = now();
    const copy = {
      ...lesson,
      id: crypto.randomUUID(),
      title: `${lesson.title} copy`,
      created_at: timestamp,
      updated_at: timestamp
    };
    update({ ...store, lessons: [copy, ...store.lessons] });
  }

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
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lessons.map((lesson) => (
              <tr key={lesson.id} className="group hover:bg-slate-50">
                <td className="p-0 font-medium text-ink">
                  <RowLink href={`/lessons/${lesson.id}`}>{lesson.student_name ?? "Unlinked"}</RowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <RowLink href={`/lessons/${lesson.id}`}>{formatDate(lesson.lesson_date)}</RowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <RowLink href={`/lessons/${lesson.id}`}>{formatDateTime(lesson.updated_at)}</RowLink>
                </td>
                <td className="p-0 text-slate-600">
                  <RowLink href={`/lessons/${lesson.id}`}>{lesson.board_count}</RowLink>
                </td>
                <td className="px-4 py-3 group-hover:bg-slate-50">
                  <div className="flex justify-end gap-2">
                    <Link className="rounded-md p-2 text-slate-600 hover:bg-slate-100" href={`/lessons/${lesson.id}`} aria-label="Open lesson">
                      <ExternalLink size={16} aria-hidden="true" />
                    </Link>
                    <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" onClick={() => duplicateLesson(lesson.id)} aria-label="Duplicate lesson">
                      <Copy size={16} aria-hidden="true" />
                    </button>
                    <button className="rounded-md p-2 text-coral hover:bg-red-50" onClick={() => deleteLesson(lesson.id)} aria-label="Delete lesson">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="block h-full px-4 py-3 transition-colors group-hover:text-leaf" href={href}>
      {children}
    </Link>
  );
}

function GuestEmptyStudents() {
  return (
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
  );
}

function GuestEmptyLessons() {
  return (
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
  );
}

function GuestEmptyLinkedLessons() {
  return (
    <EmptyState
      icon={NotebookTabs}
      title="No linked lessons"
      description="Create a lesson for this student."
      action={
        <Link className="btn-primary" href="/lessons/new">
          <Plus size={16} aria-hidden="true" />
          Create lesson
        </Link>
      }
    />
  );
}

function GuestNotFound({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="panel p-6">
        <h1 className="text-lg font-semibold text-ink">This {label} is not in your demo workspace.</h1>
        <p className="mt-2 text-sm text-slate-600">Create a new one or log in to access saved data.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn-primary" href={label === "student" ? "/students/new" : "/lessons/new"}>
            Create {label}
          </Link>
          <Link className="btn-secondary" href={label === "student" ? "/students" : "/lessons"}>
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}

function getStudentSummaries(store: GuestStore) {
  return store.students
    .map((student) => {
      const lessonDates = store.lessons
        .filter((lesson) => lesson.student_id === student.id)
        .map((lesson) => lesson.lesson_date)
        .filter(Boolean)
        .sort();
      return {
        id: student.id,
        name: student.name,
        lesson_count: lessonDates.length,
        last_lesson_date: lessonDates.at(-1) ?? null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getLessonSummaries(store: GuestStore) {
  return store.lessons
    .map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      lesson_date: lesson.lesson_date,
      updated_at: lesson.updated_at,
      student_name: lesson.student_id ? store.students.find((student) => student.id === lesson.student_id)?.name ?? null : null,
      board_count: 1
    }))
    .sort((a, b) => {
      const dateCompare = b.lesson_date.localeCompare(a.lesson_date);
      return dateCompare || b.updated_at.localeCompare(a.updated_at);
    });
}

function now() {
  return new Date().toISOString();
}
