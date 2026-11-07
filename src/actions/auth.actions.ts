"use server";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/errors";
import { loginSchema } from "@/lib/validations/staff";
import { formToObject } from "@/actions/helpers";

export type LoginState = ActionResult<{ redirectTo: string }> | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    const parsed = loginSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return fail("Please check the form.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: { select: { id: true } } },
    });

    // Same message whether the email is unknown or the password is wrong, so
    // the form cannot be used to discover which accounts exist.
    const genericError = "Email or password is incorrect.";

    if (!user) return fail(genericError);

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) return fail(genericError);

    if (!user.isActive) {
      return fail(
        "This account has been deactivated. Please contact the clinic administrator.",
      );
    }

    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      doctorId: user.doctorProfile?.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const raw = formData.get("next");
    const next = typeof raw === "string" ? raw : "";
    // Only allow same-origin paths, never an absolute URL.
    const redirectTo =
      next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

    return ok({ redirectTo }, `Welcome back, ${user.name.split(" ")[0]}.`);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}
