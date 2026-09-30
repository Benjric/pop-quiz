"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Returns an error instead of throwing on bad credentials; a successful
 * sign-in redirects, which Next signals by throwing, so that is rethrown.
 */
export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "That email and password don't match." };
    throw error;
  }

  // Only return to a path on this site.
  redirect(from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard");
}
