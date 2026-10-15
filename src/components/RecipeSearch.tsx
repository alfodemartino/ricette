"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLoadingWhile } from "@/components/LoadingOverlay";
import { NavLink } from "@/components/NavLink";
import { inputClass } from "@/components/ui";
import { filtersHref, type RecipeFilters } from "@/lib/recipe-search";

/**
 * La casella di ricerca: filtra mentre si scrive, aggiornando l'indirizzo
 * (così la ricerca resta anche tornando indietro). Aspetta che si smetta di
 * battere per un attimo, per non chiedere una pagina a ogni lettera.
 */
export function RecipeSearch({ filters }: { filters: RecipeFilters }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.q);
  const [pending, startTransition] = useTransition();
  const latest = useRef(filters);
  latest.current = filters;
  // L'ultima ricerca mandata all'indirizzo: se l'indirizzo cambia per un'altra
  // ragione («azzera i filtri», il tasto indietro) la casella si riallinea.
  const pushed = useRef(filters.q);

  useLoadingWhile(pending);

  useEffect(() => {
    if (filters.q !== pushed.current) {
      pushed.current = filters.q;
      setQuery(filters.q);
    }
  }, [filters.q]);

  function push(text: string) {
    pushed.current = text;
    startTransition(() => router.replace(filtersHref({ ...latest.current, q: text }), { scroll: false }));
  }

  useEffect(() => {
    const text = query.trim();
    if (text === pushed.current) return;
    const timer = setTimeout(() => push(text), 300);
    return () => clearTimeout(timer);
    // `push` legge tutto da ref: non cambia niente se si rigenera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Chi scrive un elenco separato da virgole («zucchine, ricotta») sta
  // cercando cosa cucinare con quello che ha: glielo si propone.
  const ingredients = query.includes(",") ? query.trim().replace(/,\s*$/, "") : "";

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        push(query.trim());
      }}
      className="space-y-2"
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca per nome, ingrediente o tag"
        aria-label="Cerca fra le ricette"
        className={inputClass}
      />
      {ingredients && (
        <p className="px-1 text-[13px]">
          <NavLink
            href={`/ricette/cosa-cucino?${new URLSearchParams({ ingredienti: ingredients })}`}
            className="font-medium text-tint hover:underline"
          >
            Cerca le ricette con questi ingredienti ›
          </NavLink>
        </p>
      )}
    </form>
  );
}
