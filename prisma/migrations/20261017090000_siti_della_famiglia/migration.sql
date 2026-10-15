-- I siti di «Cosa cucino con…» diventano tutti della famiglia: niente più
-- siti dell'app predefiniti. Una famiglia nuova parte senza siti; quelle che
-- ci sono già tengono i siti che usavano, con lo stesso stato acceso/spento.

-- AlterTable
ALTER TABLE "RecipeSite" ADD COLUMN     "catalogId" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- I siti aggiunti dalla famiglia e spenti restano spenti.
UPDATE "RecipeSite" AS s
SET "enabled" = false
FROM "Family" AS f
WHERE s."familyId" = f."id" AND s."id" = ANY (f."disabledSites");

-- I siti dell'app che la famiglia non aveva tolto diventano suoi, nell'ordine
-- dell'app. La configurazione vera la legge il codice da `KNOWN_SITES` grazie
-- a `catalogId`: qui serve solo a riempire le colonne.
INSERT INTO "RecipeSite" ("id", "familyId", "host", "name", "kind", "searchUrl", "linkSelector", "linkPrefix", "catalogId", "enabled", "createdAt")
SELECT
  gen_random_uuid()::text,
  f."id",
  c.host,
  c.name,
  c.kind::"RecipeSiteKind",
  c.search_url,
  c.link_selector,
  c.link_prefix,
  c.id,
  NOT (c.id = ANY (f."disabledSites")),
  CURRENT_TIMESTAMP - (interval '1 second' * (10 - c.position))
FROM "Family" AS f
CROSS JOIN (
  VALUES
    ('giallozafferano', 'GialloZafferano', 'www.giallozafferano.it', 'HTML', 'https://www.giallozafferano.it/ricerca-ricette/{q+}/', 'article.gz-card .gz-title a', NULL, 1),
    ('ricettedellanonna', 'Ricette della Nonna', 'www.ricettedellanonna.net', 'WORDPRESS', 'https://www.ricettedellanonna.net/wp-json/wp/v2/search?search={q}&per_page=10&type=post', NULL, NULL, 2),
    ('benedetta', 'Fatto in casa da Benedetta', 'www.fattoincasadabenedetta.it', 'WORDPRESS', 'https://www.fattoincasadabenedetta.it/wp-json/wp/v2/search?search={q}&per_page=10&type=post', NULL, '/ricetta/', 3),
    ('misya', 'Misya', 'www.misya.info', 'WORDPRESS', 'https://www.misya.info/wp-json/wp/v2/search?search={q}&per_page=10&type=post', NULL, '/ricetta/', 4),
    ('cucchiaio', 'Il Cucchiaio d''Argento', 'www.cucchiaio.it', 'HTML', 'https://www.cucchiaio.it/ricerca.html?param={q}', '#item-container article h3 a', '/ricetta/', 5),
    ('casapappagallo', 'Casa Pappagallo', 'www.casapappagallo.it', 'HTML', 'https://www.casapappagallo.it/ricette?s={q}', '.research-results-list article h2 a', '/ricette/', 6),
    ('ricetteperbimby', 'Ricette per Bimby', 'www.ricetteperbimby.it', 'HTML', 'https://www.ricetteperbimby.it/ricerca/{q-}', 'section.content article.post a', '/ricette/', 7)
) AS c (id, name, host, kind, search_url, link_selector, link_prefix, position)
WHERE NOT (c.id = ANY (f."hiddenSites"))
ON CONFLICT ("familyId", "host") DO NOTHING;

-- AlterTable
ALTER TABLE "Family" DROP COLUMN "disabledSites",
DROP COLUMN "hiddenSites";
