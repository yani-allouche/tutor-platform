import type { Lesson, StudentOption } from "@/lib/types";

export function LessonForm({
  action,
  lesson,
  students,
  submitLabel,
  defaultStudentId
}: {
  action: (formData: FormData) => void | Promise<void>;
  lesson?: Lesson;
  students: StudentOption[];
  submitLabel: string;
  defaultStudentId?: string;
}) {
  return (
    <form action={action} className="panel grid gap-5 p-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label className="label" htmlFor="title">
          Title
        </label>
        <input className="field" id="title" name="title" defaultValue={lesson?.title} required />
      </div>
      <div className="space-y-1.5">
        <label className="label" htmlFor="student_id">
          Student
        </label>
        <select className="field" id="student_id" name="student_id" defaultValue={lesson?.student_id ?? defaultStudentId ?? ""}>
          <option value="">No linked student</option>
          {students.map((student) => (
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
      <div className="space-y-1.5">
        <label className="label" htmlFor="topic">
          Topic
        </label>
        <input className="field" id="topic" name="topic" defaultValue={lesson?.topic} />
      </div>
      <div className="space-y-1.5">
        <label className="label" htmlFor="tags">
          Tags
        </label>
        <input className="field" id="tags" name="tags" defaultValue={lesson?.tags?.join(", ")} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="label" htmlFor="objective">
          Objective
        </label>
        <textarea className="field min-h-28" id="objective" name="objective" defaultValue={lesson?.objective} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <button className="btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
