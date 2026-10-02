import type { ComponentProps, ReactNode } from "react";
import { NavLink } from "@/components/NavLink";

/**
 * Il riquadro delle liste raggruppate di iOS: il titolo sta fuori, in piccolo e
 * in grigio, e il contenuto dentro un rettangolo arrotondato. `flush` toglie il
 * margine interno alle card che contengono un elenco, così le righe e i loro
 * separatori arrivano fino al bordo come nelle impostazioni di sistema.
 */
export function Card({
  title,
  description,
  actions,
  flush = false,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // `flex-col` più `flex-1` sul riquadro: nelle griglie le card affiancate
    // finiscono alla stessa altezza anche con testi di lunghezza diversa.
    <section className={`flex h-full flex-col ${className}`}>
      {(title || actions) && (
        <header className="mb-2 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-[13px] text-label-secondary">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div
        className={`flex-1 overflow-hidden rounded-card bg-surface ${flush ? "" : "p-4 sm:p-5"}`}
      >
        {children}
      </div>
    </section>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100";

/*
 * I pulsanti di iOS non cambiano colore quando li premi: si schiariscono. Da
 * qui l'opacità al posto di una seconda tinta per gli stati.
 */
const buttonVariants = {
  primary: "bg-tint text-white hover:opacity-90 active:opacity-80",
  secondary: "bg-fill text-tint hover:bg-fill-strong",
  ghost: "text-tint hover:bg-fill",
  danger: "text-negative hover:bg-negative/10",
} as const;

const buttonSizes = {
  /* 44 px di altezza: il bersaglio minimo per un dito, secondo Apple. */
  md: "min-h-11 px-4 py-2.5 text-[15px]",
  sm: "px-3 py-1.5 text-[13px]",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "primary", extra = "", size: ButtonSize = "md") {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${extra}`;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof NavLink> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <NavLink className={buttonClass(variant, className, size)} {...props} />;
}

export type SegmentedItem = { href: string; label: string; active: boolean };

/**
 * Il controllo segmentato di iOS: una pista grigia con dentro una pastiglia
 * chiara che indica la scelta. Le voci sono link, così la scelta sta
 * nell'indirizzo. `scroll` passa ai link: `false` quando cambiare voce non deve
 * riportare la pagina in cima.
 */
export function SegmentedLinks({
  items,
  className = "",
  scroll,
}: {
  items: SegmentedItem[];
  className?: string;
  scroll?: boolean;
}) {
  return (
    <ul className={`flex gap-0.5 rounded-control bg-fill p-0.5 ${className}`}>
      {items.map((item) => (
        <li key={item.href} className="flex-1">
          <NavLink
            href={item.href}
            scroll={scroll}
            aria-current={item.active ? "page" : undefined}
            className={`block rounded-[7px] px-4 py-1.5 text-center text-[13px] font-semibold whitespace-nowrap transition ${
              item.active ? "bg-raised text-label shadow-sm" : "text-label-secondary hover:text-label"
            }`}
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-label-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-label-secondary">{hint}</span>}
    </label>
  );
}

/*
 * I campi di iOS non hanno un bordo: hanno un fondo grigio appena accennato.
 * Il bordo trasparente serve solo a non far ballare il campo quando il fuoco
 * lo colora. 16 px di testo perché sotto, su iPhone, Safari ingrandisce la
 * pagina al primo tocco.
 */
export const inputClass =
  "w-full rounded-control border border-transparent bg-fill px-3.5 py-2.5 text-base text-label outline-none placeholder:text-label-tertiary focus:border-tint focus:ring-2 focus:ring-tint/25";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

/**
 * Casella di spunta con la sua etichetta: stanno nella stessa `label`, così
 * si spunta anche toccando il testo — su un telefono il quadratino da solo è
 * un bersaglio minuscolo. Quel che le si passa dentro resta figlio della
 * riga, non impacchettato: chi vuole più pezzi affiancati li separa il
 * `gap`.
 */
export function Checkbox({
  children,
  className = "",
  ...props
}: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label className={`flex items-center gap-2.5 text-[15px] ${className}`}>
      <input type="checkbox" {...props} className="size-[18px] shrink-0 accent-tint" />
      {children}
    </label>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "bg-negative/10 text-negative",
    success: "bg-positive/10 text-positive",
    info: "bg-fill text-label-secondary",
  } as const;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-control px-3.5 py-2.5 text-[13px] font-medium ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-[15px] text-label-secondary">{children}</p>
  );
}

/**
 * Il rettangolo grigio che tiene il posto di un dato mentre il server lo
 * prepara: stessa forma e stessa altezza del testo che sostituirà, così quando
 * il contenuto arriva la pagina non salta. Pulsa piano per dire che sta
 * lavorando, e sta fermo per chi ha chiesto meno animazioni.
 *
 * È decorativo: l'attesa la annuncia `SkeletonPage`, non i singoli blocchi.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-md bg-fill motion-reduce:animate-none ${className}`}
    />
  );
}

/** Il segno «›» che su iOS chiude ogni riga che porta da qualche parte. */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`size-3.5 shrink-0 text-label-tertiary ${className}`}
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/**
 * Una voce di `Menu`: link o pulsante a tutta larghezza, alto quanto un dito.
 * Sta qui e non accanto al menu perché quello è un componente client, e da un
 * modulo client anche una costante arriva ai componenti server come
 * riferimento, non come testo.
 */
export const menuItemClass =
  "flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] text-label transition hover:bg-fill";

/** I tre puntini del pulsante «Altre azioni». */
export function MoreIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`size-5 ${className}`}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/**
 * L'iniziale di una persona in un cerchio neutro. È decorativa: il nome sta
 * sempre accanto, e il cerchio serve solo a trovarlo prima con l'occhio.
 * `tint` lo colora di blu quando il cerchio è esso stesso un pulsante.
 */
export function Avatar({
  name,
  tone = "neutral",
  className = "",
}: {
  name: string;
  tone?: "neutral" | "tint";
  className?: string;
}) {
  const tones = {
    neutral: "bg-fill-strong text-label-secondary",
    tint: "bg-tint/15 text-tint",
  } as const;

  return (
    <span
      aria-hidden
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${tones[tone]} ${className}`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Il simbolo dell'app: una pentola che fuma. Il tratto è `currentColor`, così
 * prende il colore di chi lo contiene ed è giusto sia in chiaro sia in scuro.
 * Il riquadro arrotondato per la scheda del browser è in `src/app/icon.svg`.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-6 shrink-0 ${className}`}
    >
      <path d="M13 31h38v12a11 11 0 0 1-11 11H24a11 11 0 0 1-11-11Z" />
      <path d="M6 31h52" />
      <path d="M25 22c0-4 4-5 4-9M37 22c0-4 4-5 4-9" />
    </svg>
  );
}

/** Un'etichetta piccola e neutra: categoria, tag, tempo. */
export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-medium text-label-secondary ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Il sito da cui arriva una foto importata, in basso sopra la foto: una
 * fascia che sfuma nel velo scuro, come le didascalie di iOS. Va dentro un
 * contenitore `relative`. Per chi usa un lettore di schermo la fonte è già
 * nella scheda «Fonte» della ricetta.
 */
export function PhotoCredit({ credit, className = "" }: { credit: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-scrim to-transparent px-3 pt-6 pb-1.5 text-right text-[11px] font-medium text-on-scrim ${className}`}
    >
      {credit}
    </span>
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} min-h-24 ${props.className ?? ""}`} />;
}
