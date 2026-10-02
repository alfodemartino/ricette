import type { Metadata, Viewport } from "next";
import { LoadingProvider } from "@/components/LoadingOverlay";
import { NavLink } from "@/components/NavLink";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu } from "@/components/Menu";
import { Avatar, Logo, menuItemClass } from "@/components/ui";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ricette",
  description: "Il ricettario di famiglia: ingredienti, procedimento e foto, anche importati da un link.",
};

/* Sotto la barra di stato dell'iPhone si vede lo sfondo della pagina, non una striscia bianca. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Applica il tema salvato prima del primo paint, per evitare il lampeggio. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        {/* Ogni navigazione e ogni invio di form che avviene qui dentro accende
            lo spinner globale: il clic ha sempre una risposta immediata. */}
        <LoadingProvider>
          {/* La barra di navigazione di iOS: resta in alto, è traslucida e sotto
              di lei il contenuto scorre sfocato. */}
          <header className="sticky top-0 z-40 border-b border-separator bg-surface/75 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <NavLink href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                <Logo className="text-tint" />
                <span>
                  Ricette
                  <span className="ml-1.5 hidden font-normal text-label-secondary sm:inline">· ricettario di famiglia</span>
                </span>
              </NavLink>

              <nav className="flex items-center gap-1">
                {user ? (
                  <>
                    <NavLink
                      href="/ricette"
                      className="rounded-control px-3 py-1.5 text-[15px] text-tint transition hover:bg-fill"
                    >
                      Ricette
                    </NavLink>
                    {/* Famiglia, tema e uscita si usano di rado: stanno nel menu
                        dell'account, così su un telefono la barra resta su una
                        riga sola. */}
                    <Menu
                      label="Account, famiglia e tema"
                      trigger={<Avatar name={user.name ?? user.email ?? "?"} tone="tint" />}
                      triggerClassName="flex size-11 items-center justify-center rounded-full transition hover:bg-fill"
                    >
                      <p className="border-b border-separator px-4 py-3 text-[13px] text-label-secondary">
                        Accesso come{" "}
                        <span className="block truncate text-[15px] font-medium text-label">
                          {user.name ?? user.email}
                        </span>
                      </p>
                      <NavLink href="/famiglia" className={`${menuItemClass} border-b border-separator`}>
                        La mia famiglia
                      </NavLink>
                      <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-2.5 text-[15px]">
                        Tema
                        <ThemeToggle />
                      </div>
                      <form action={logoutAction} className="p-2">
                        <SubmitButton variant="danger" className="w-full" pendingLabel="Esco…">
                          Esci
                        </SubmitButton>
                      </form>
                    </Menu>
                  </>
                ) : (
                  <>
                    <ThemeToggle />
                    <NavLink
                      href="/login"
                      className="rounded-control px-3 py-1.5 text-[15px] text-tint transition hover:bg-fill"
                    >
                      Accedi
                    </NavLink>
                    <NavLink
                      href="/registrati"
                      className="rounded-control bg-tint px-3 py-1.5 text-[15px] font-semibold text-white transition hover:opacity-90 active:opacity-80"
                    >
                      Crea un account
                    </NavLink>
                  </>
                )}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>
        </LoadingProvider>
      </body>
    </html>
  );
}
