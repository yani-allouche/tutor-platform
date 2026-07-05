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
    <form action={action} className="panel grid gap-5 p-5">
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
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
