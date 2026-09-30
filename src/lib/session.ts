import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** For pages: the signed-in teacher's id, or a redirect to the login. */
export async function requireTeacherId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/** For API routes: the signed-in teacher's id, or null (answer 401). */
export async function getTeacherId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
