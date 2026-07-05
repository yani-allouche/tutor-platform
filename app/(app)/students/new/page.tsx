import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";
import { createStudent } from "../actions";

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New student" description="Create a private learner profile." />
      <StudentForm action={createStudent} submitLabel="Create student" />
    </div>
  );
}
