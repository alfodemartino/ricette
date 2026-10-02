import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loginWithGoogleAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/forms/LoginForm";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/ui";

export const metadata = { title: "Accedi — Ricette" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/ricette");

  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card title="Accedi">
        <LoginForm />

        {googleEnabled && (
          <form action={loginWithGoogleAction} className="mt-4 border-t border-separator pt-4">
            <SubmitButton variant="secondary" className="w-full" pendingLabel="Apro Google…">
              Continua con Google
            </SubmitButton>
          </form>
        )}
      </Card>

      <p className="text-center text-[13px] text-label-secondary">
        Non hai un account?{" "}
        <NavLink href="/registrati" className="font-semibold text-tint hover:underline">
          Registrati
        </NavLink>
      </p>
    </div>
  );
}
