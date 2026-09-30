import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Logo } from "@/components/Logo";
import { NavLinks } from "./NavLinks";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await auth();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-2 border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="rounded-lg">
            <Logo size={34} />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard/quizzes/new" className="btn btn-primary btn-sm">
              New quiz
            </Link>
            <span className="hidden text-sm font-semibold text-muted sm:inline">{session?.user?.name}</span>
            <form action={logout}>
              <button type="submit" className="btn btn-outline btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
