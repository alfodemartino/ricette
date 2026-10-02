/**
 * Tema dell'interfaccia: "system" segue le preferenze del sistema operativo,
 * "light" e "dark" sono scelte esplicite dell'utente e vengono ricordate.
 */
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "ricette-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Legge il valore salvato: qualsiasi cosa non riconosciuta vale "system". */
export function parseStoredTheme(value: string | null): Theme {
  return isTheme(value) ? value : "system";
}

/**
 * Script eseguito prima del primo paint: applica il tema salvato all'elemento
 * <html>, così la pagina non lampeggia in chiaro prima di diventare scura.
 * Il tema "system" non scrive nulla: ci pensa `prefers-color-scheme`.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
