import Link from "next/link";
import { UserPlus } from "lucide-react";
import { signUp } from "../auth/actions";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-10">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-leaf text-white">
            <UserPlus size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Create tutor account</h1>
            <p className="text-sm text-slate-500">Tutor-only access for your private workspace</p>
          </div>
        </div>

        {params.error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={signUp} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="label" htmlFor="first_name">
              First name
            </label>
            <input className="field" id="first_name" name="first_name" required autoComplete="given-name" />
          </div>
          <div className="space-y-1.5">
            <label className="label" htmlFor="last_name">
              Last name
            </label>
            <input className="field" id="last_name" name="last_name" required autoComplete="family-name" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="field" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="field"
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button className="btn-primary sm:col-span-2" type="submit">
            Sign up
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-medium text-leaf hover:underline" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
