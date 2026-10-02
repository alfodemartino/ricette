import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { NavLink } from "@/components/NavLink";
import { Card } from "@/components/ui";

export const metadata = { title: "Crea un account — Ricette" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/ricette");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card title="Crea un account" description="Bastano nome, email e password.">
        <RegisterForm />
      </Card>

      <p className="text-center text-[13px] text-label-secondary">
        Hai già un account?{" "}
        <NavLink href="/login" className="font-semibold text-tint hover:underline">
          Accedi
        </NavLink>
      </p>
    </div>
  );
}
