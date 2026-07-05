import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";
import { getStudent } from "@/lib/data";
import { updateStudent } from "../../actions";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await getStudent(id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit student" description={student.name} />
      <StudentForm action={updateStudent.bind(null, student.id)} student={student} submitLabel="Save student" />
    </div>
  );
}
