import { requireSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Every route in this group is behind authentication. The middleware already
 * redirects anonymous visitors; this is the second check, on the server, that
 * also supplies the signed-in user to the shell.
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <AppShell
      user={{
        id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role,
      }}
    >
      <div id="main" className="mx-auto w-full max-w-[1400px]">
        {children}
      </div>
    </AppShell>
  );
}
