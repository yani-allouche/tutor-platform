import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";
import { GuestEditStudentPage } from "@/components/guest-workspace";
import { getOptionalUser } from "@/lib/auth";
import { getStudent } from "@/lib/data";
import { updateStudent } from "../../actions";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user) return <GuestEditStudentPage id={id} />;

  const student = await getStudent(id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit student" description={student.name} />
      <StudentForm action={updateStudent.bind(null, student.id)} student={student} submitLabel="Save student" />
    </div>
  );
}
