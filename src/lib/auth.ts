import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { credentialsSchema } from "@/lib/validation";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email e password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Il login con Google si attiva da solo se le credenziali sono configurate.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// I cookie del browser distinguono l'host ma non la porta: Ricette (3001) e
// finanze (3000) raggiunte dallo stesso indirizzo leggono gli stessi cookie.
// Con i nomi predefiniti di Auth.js (`authjs.session-token`…) il login su
// un'app sovrascriverebbe la sessione dell'altra, che non riesce a leggerla
// (la chiave è diversa) e manda al login. Un prefisso proprio le separa.
//
// Il nome è fisso, quindi senza i prefissi `__Secure-`/`__Host-` che Auth.js
// aggiunge solo in https: l'app si raggiunge sia in http sulla LAN sia in https
// dal tunnel. Il flag `Secure` resta quello predefinito, deciso dal protocollo
// di ogni richiesta, perché Auth.js unisce queste voci alle sue.
const COOKIES: NextAuthConfig["cookies"] = {
  sessionToken: { name: "ricette.session-token" },
  callbackUrl: { name: "ricette.callback-url" },
  csrfToken: { name: "ricette.csrf-token" },
  pkceCodeVerifier: { name: "ricette.pkce.code_verifier" },
  state: { name: "ricette.state" },
  nonce: { name: "ricette.nonce" },
  webauthnChallenge: { name: "ricette.challenge" },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // L'host arriva negli header inoltrati dal proxy che sta davanti all'app:
  // senza questo Auth.js rifiuta ogni richiesta con UntrustedHost, e login e
  // registrazione falliscono. Così vale per ogni indirizzo da cui l'app è
  // raggiunta — l'IP sulla LAN, il dominio pubblico dietro il tunnel — senza
  // doverli elencare uno per uno.
  trustHost: true,
  cookies: COOKIES,
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});

/** Utente della richiesta corrente, oppure `null` se non autenticato. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
