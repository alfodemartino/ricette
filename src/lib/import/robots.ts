/**
 * Lettura del robots.txt di un sito, per decidere se la sua ricerca si può
 * usare da «Cosa cucino con…». L'app si presenta come un browser, quindi
 * valgono le regole del gruppo `User-agent: *`.
 *
 * Le regole sono quelle di Google, ormai lo standard (RFC 9309): vince la
 * regola più lunga che corrisponde al percorso, a parità vince `Allow`; `*`
 * vale qualsiasi sequenza di caratteri e `$` la fine dell'indirizzo; un
 * `Disallow:` vuoto non vieta niente.
 */

type Rule = { allow: boolean; pattern: string };

/** Le regole che valgono per `User-agent: *`. */
export function robotsRules(text: string): Rule[] {
  const rules: Rule[] = [];
  let agents: string[] = [];
  let collectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === "user-agent") {
      // Più righe `User-agent` di seguito formano un gruppo solo.
      if (!collectingAgents) agents = [];
      agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if ((field === "allow" || field === "disallow") && agents.includes("*") && value) {
      rules.push({ allow: field === "allow", pattern: value });
    }
  }
  return rules;
}

function patternRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Se il robots.txt permette di scaricare il percorso (con i parametri: `/?s=pasta`). */
export function robotsAllows(text: string, pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const rule of robotsRules(text)) {
    if (!patternRegExp(rule.pattern).test(pathAndQuery)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule;
    }
  }
  return best?.allow ?? true;
}
