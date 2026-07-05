import Link from "next/link";
import { BookOpen, LayoutDashboard, LogOut, Users, NotebookTabs } from "lucide-react";
import { logOut } from "@/app/(auth)/auth/actions";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/lessons", label: "Lessons", icon: NotebookTabs }
];

export function AppShell({ children, tutorName }: { children: React.ReactNode; tutorName: string }) {
  return (
    <div className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-leaf text-white">
            <BookOpen size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Tutor Platform</span>
            <span className="block text-xs text-slate-500">V1 workspace</span>
          </span>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-ink"
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-5 border-t border-slate-200 pt-4">
          <p className="mb-3 truncate text-sm font-medium text-ink">{tutorName}</p>
          <form action={logOut}>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-ink">
              <LogOut size={18} aria-hidden="true" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <header className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-ink">
            <BookOpen size={20} aria-hidden="true" />
            Tutor Platform
          </Link>
          <form action={logOut}>
            <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Log out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
