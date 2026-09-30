import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PinForm } from "./PinForm";

export default function Home() {
  return (
    <main className="safe-screen flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 bg-brand">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={64} inverted />
        <h1 className="font-display text-4xl font-extrabold text-white">Pop Quiz</h1>
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6">
        <PinForm />
      </div>
      <p className="text-center font-semibold text-[#E4DDFB]">No account or app needed</p>
      <Link href="/login" className="text-sm font-bold text-[#E4DDFB] underline-offset-4 hover:text-white hover:underline">
        Teacher sign in
      </Link>
    </main>
  );
}
