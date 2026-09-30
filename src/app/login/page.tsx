import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { Credit } from "@/components/Credit";

export const metadata = { title: "Teacher sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { from } = await props.searchParams;

  return (
    <main className="safe-screen flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 bg-brand">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={64} inverted />
        <h1 className="font-display text-4xl font-extrabold text-white">Pop Quiz</h1>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-white p-6">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Teacher sign in</h2>
          <p className="mt-1 text-sm text-muted">Students don&apos;t need an account — they join with the game PIN.</p>
        </div>
        <LoginForm from={typeof from === "string" ? from : ""} />
      </div>
      <Link href="/" className="text-sm font-bold text-[#E4DDFB] hover:text-white">
        Joining a game? Enter the PIN
      </Link>
      <Credit />
    </main>
  );
}
