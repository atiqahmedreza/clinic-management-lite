import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

/** The clinic has no public landing page - staff go straight to their work. */
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
