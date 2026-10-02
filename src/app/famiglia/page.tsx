import { notFound } from "next/navigation";
import {
  CreateFamilyForm,
  DeleteFamilyForm,
  InviteCode,
  JoinFamilyForm,
  LeaveFamilyButton,
  MemberActions,
  RenameFamilyForm,
} from "@/components/forms/FamilyForms";
import { Avatar, Badge, Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireViewer } from "@/lib/session";

export const metadata = { title: "La mia famiglia — Ricette" };

export default async function FamilyPage() {
  const viewer = await requireViewer();

  if (!viewer.familyId) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Il ricettario di famiglia</h1>
          <p className="max-w-2xl text-[15px] text-label-secondary">
            Le ricette appartengono a una famiglia: tutti i suoi membri le vedono e possono
            modificarle. Creane una nuova oppure entra in quella dei tuoi con il codice di invito.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Crea una famiglia" description="Ne diventi l'amministratore.">
            <CreateFamilyForm />
          </Card>
          <Card title="Entra in una famiglia" description="Serve il codice di invito.">
            <JoinFamilyForm />
          </Card>
        </div>
      </div>
    );
  }

  const family = await prisma.family.findUnique({
    where: { id: viewer.familyId },
    include: {
      members: {
        orderBy: [{ familyRole: "asc" }, { joinedAt: "asc" }],
        select: { id: true, name: true, email: true, familyRole: true, _count: { select: { recipesCreated: true } } },
      },
      _count: { select: { recipes: true } },
    },
  });
  if (!family) notFound();

  const isOwner = viewer.familyRole === "OWNER";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[13px] text-label-secondary">La mia famiglia</p>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">{family.name}</h1>
        <p className="mt-1 text-[13px] text-label-secondary">
          {family._count.recipes === 1 ? "1 ricetta" : `${family._count.recipes} ricette`} ·{" "}
          {family.members.length === 1 ? "1 membro" : `${family.members.length} membri`}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Codice di invito" description="Chi si registra e lo inserisce entra nella famiglia e vede tutte le ricette.">
            <InviteCode code={family.inviteCode} canRegenerate={isOwner} />
          </Card>

          <Card title="Membri" flush>
            <ul className="divide-y divide-separator">
              {family.members.map((member) => {
                const name = member.name ?? member.email;
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">
                        {name}
                        {member.id === viewer.id && <span className="font-normal text-label-secondary"> (tu)</span>}
                      </p>
                      <p className="text-[12px] text-label-secondary">
                        {member._count.recipesCreated === 1 ? "1 ricetta scritta" : `${member._count.recipesCreated} ricette scritte`}
                      </p>
                    </div>
                    {member.familyRole === "OWNER" && <Badge>Amministratore</Badge>}
                    {isOwner && member.id !== viewer.id && <MemberActions memberId={member.id} name={name} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          {isOwner && (
            <Card title="Nome della famiglia">
              <RenameFamilyForm name={family.name} />
            </Card>
          )}

          {/* L'amministratore non può uscire così: prima passa il ruolo (o, se
              è rimasto solo, elimina la famiglia). Il pulsante non gli si
              mostra nemmeno, invece di lasciarlo premere per sentirsi dire di no. */}
          {isOwner ? (
            family.members.length > 1 && (
              <p className="px-1 text-[13px] text-label-secondary">
                Per uscire dalla famiglia passa prima il ruolo di amministratore a un altro membro.
              </p>
            )
          ) : (
            <Card title="Esci dalla famiglia" description="Le ricette che hai scritto restano agli altri membri.">
              <LeaveFamilyButton />
            </Card>
          )}

          {isOwner && (
            <Card
              title="Elimina la famiglia"
              description="Spariscono tutte le ricette, con foto e tag. Gli account dei membri restano."
            >
              <DeleteFamilyForm name={family.name} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
