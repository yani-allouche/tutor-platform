import type { Student } from "@/lib/types";

export function StudentForm({
  action,
  student,
  submitLabel
}: {
  action: (formData: FormData) => void | Promise<void>;
  student?: Student;
  submitLabel: string;
}) {
  return (
    <form action={action} className="panel grid gap-5 p-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label className="label" htmlFor="name">
          Name
        </label>
        <input className="field" id="name" name="name" defaultValue={student?.name} required />
      </div>
      <div className="space-y-1.5">
        <label className="label" htmlFor="language_learned">
          Language learned
        </label>
        <input className="field" id="language_learned" name="language_learned" defaultValue={student?.language_learned} />
      </div>
      <div className="space-y-1.5">
        <label className="label" htmlFor="level">
          Level
        </label>
        <input className="field" id="level" name="level" defaultValue={student?.level} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="label" htmlFor="goals">
          Goals
        </label>
        <textarea className="field min-h-28" id="goals" name="goals" defaultValue={student?.goals} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea className="field min-h-28" id="notes" name="notes" defaultValue={student?.notes} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <button className="btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
