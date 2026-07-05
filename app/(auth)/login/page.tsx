import Link from "next/link";
import { BookOpen } from "lucide-react";
import { logIn } from "../auth/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-leaf text-white">
            <BookOpen size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Tutor Platform</h1>
            <p className="text-sm text-slate-500">Log in to your tutor workspace</p>
          </div>
        </div>

        {params.error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={logIn} className="space-y-4">
          <div className="space-y-1.5">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="field" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="field"
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            Log in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New tutor?{" "}
          <Link className="font-medium text-leaf hover:underline" href="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
