import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/student-form";
import { GuestNewStudentPage } from "@/components/guest-workspace";
import { getOptionalUser } from "@/lib/auth";
import { createStudent } from "../actions";

export default async function NewStudentPage() {
  const user = await getOptionalUser();
  if (!user) return <GuestNewStudentPage />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New student" description="Create a private learner profile." />
      <StudentForm action={createStudent} submitLabel="Create student" />
    </div>
  );
}
