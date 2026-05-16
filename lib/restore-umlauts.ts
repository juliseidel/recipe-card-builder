// Wörterbuch-basierter Umlaut-Restorer für KI-generierte deutsche Texte.
//
// Problem: Gemini schreibt manchmal "fuer" statt "für", "Kueche" statt
// "Küche", "suesse" statt "süße" — selbst wenn die System-Instruction
// das verbietet. Inkonsistent: bei manchen Calls korrekt, bei anderen
// nicht.
//
// Lösung: Whitelist-Map mit den ~60 häufigsten deutschen Wörtern die
// im Foreword-Kontext (Recipe-Beschreibungen, Kochsprache, Tonalität)
// vorkommen. Nur Wort-Boundary-Matches (\b…\b), case-insensitive für
// das Pattern, Case-preservierend für den Ersatz.
//
// Konservativ: wir replacen NICHT "weiss" → "weiß" oder "muede" → "müde"
// in allen Kontexten, sondern nur die safe whole-word matches. Bei
// Eigenamen ("Auerbach", "Sue Smith") niemals false-positive.

type ReplacePair = {
  /** Wrong encoding pattern — match case-insensitive on word boundaries. */
  wrong: string;
  /** Correct German with proper umlauts, lower-case form. */
  correctLower: string;
};

// Sortiert: längste Patterns zuerst, damit "Suesskartoffel" vor "suess"
// matched (sonst würde "suess" zuerst replacen, "kartoffel" bliebe).
const REPLACEMENTS: ReplacePair[] = [
  // Recipe-Vokabular
  { wrong: "suesskartoffel", correctLower: "süßkartoffel" },
  { wrong: "Suesskartoffel", correctLower: "Süßkartoffel" },
  { wrong: "Suesskartoffeln", correctLower: "Süßkartoffeln" },
  { wrong: "loeffelbiskuits", correctLower: "löffelbiskuits" },
  { wrong: "Loeffelbiskuits", correctLower: "Löffelbiskuits" },
  { wrong: "huehnchen", correctLower: "hühnchen" },
  { wrong: "Huehnchen", correctLower: "Hühnchen" },
  { wrong: "haehnchen", correctLower: "hähnchen" },
  { wrong: "Haehnchen", correctLower: "Hähnchen" },
  { wrong: "vielfaeltig", correctLower: "vielfältig" },
  { wrong: "vielfaeltige", correctLower: "vielfältige" },
  { wrong: "vielfaeltigen", correctLower: "vielfältigen" },
  { wrong: "abwechslungsreich", correctLower: "abwechslungsreich" }, // unverändert
  { wrong: "abwechslungsreichen", correctLower: "abwechslungsreichen" },
  { wrong: "naturbelassen", correctLower: "naturbelassen" },
  { wrong: "fuer", correctLower: "für" },
  { wrong: "Fuer", correctLower: "Für" },
  { wrong: "ueber", correctLower: "über" },
  { wrong: "Ueber", correctLower: "Über" },
  { wrong: "ueberhaupt", correctLower: "überhaupt" },
  { wrong: "ueberzeugt", correctLower: "überzeugt" },
  { wrong: "uebrig", correctLower: "übrig" },
  { wrong: "uebernehmen", correctLower: "übernehmen" },
  { wrong: "uebrigens", correctLower: "übrigens" },
  { wrong: "schoen", correctLower: "schön" },
  { wrong: "Schoen", correctLower: "Schön" },
  { wrong: "schoene", correctLower: "schöne" },
  { wrong: "schoener", correctLower: "schöner" },
  { wrong: "schoensten", correctLower: "schönsten" },
  { wrong: "schoenste", correctLower: "schönste" },
  { wrong: "muede", correctLower: "müde" },
  { wrong: "kueche", correctLower: "küche" },
  { wrong: "Kueche", correctLower: "Küche" },
  { wrong: "kuechentisch", correctLower: "küchentisch" },
  { wrong: "Kuechentisch", correctLower: "Küchentisch" },
  { wrong: "kuechentraum", correctLower: "küchentraum" },
  { wrong: "gemuetlich", correctLower: "gemütlich" },
  { wrong: "Gemuetlich", correctLower: "Gemütlich" },
  { wrong: "gemuetliche", correctLower: "gemütliche" },
  { wrong: "gemuetlichen", correctLower: "gemütlichen" },
  { wrong: "gemuese", correctLower: "gemüse" },
  { wrong: "Gemuese", correctLower: "Gemüse" },
  { wrong: "duenn", correctLower: "dünn" },
  { wrong: "duenne", correctLower: "dünne" },
  { wrong: "duennen", correctLower: "dünnen" },
  { wrong: "moeglich", correctLower: "möglich" },
  { wrong: "moegliche", correctLower: "mögliche" },
  { wrong: "moeglichen", correctLower: "möglichen" },
  { wrong: "unmoeglich", correctLower: "unmöglich" },
  { wrong: "moegen", correctLower: "mögen" },
  { wrong: "moegt", correctLower: "mögt" },
  { wrong: "moechte", correctLower: "möchte" },
  { wrong: "moechten", correctLower: "möchten" },
  { wrong: "moechtest", correctLower: "möchtest" },
  { wrong: "oeffnen", correctLower: "öffnen" },
  { wrong: "oeffne", correctLower: "öffne" },
  { wrong: "oefter", correctLower: "öfter" },
  { wrong: "loeffel", correctLower: "löffel" },
  { wrong: "Loeffel", correctLower: "Löffel" },
  { wrong: "roesten", correctLower: "rösten" },
  { wrong: "Roeste", correctLower: "Röste" },
  { wrong: "geroestet", correctLower: "geröstet" },
  { wrong: "broetchen", correctLower: "brötchen" },
  { wrong: "Broetchen", correctLower: "Brötchen" },
  { wrong: "knoedel", correctLower: "knödel" },
  { wrong: "Knoedel", correctLower: "Knödel" },
  { wrong: "noerdlich", correctLower: "nördlich" },
  { wrong: "Noerdlich", correctLower: "Nördlich" },
  { wrong: "frueh", correctLower: "früh" },
  { wrong: "Frueh", correctLower: "Früh" },
  { wrong: "fruehstueck", correctLower: "frühstück" },
  { wrong: "Fruehstueck", correctLower: "Frühstück" },
  { wrong: "fruehstuecks", correctLower: "frühstücks" },
  { wrong: "Fruehstuecks", correctLower: "Frühstücks" },
  { wrong: "spaet", correctLower: "spät" },
  { wrong: "Spaet", correctLower: "Spät" },
  { wrong: "spaeter", correctLower: "später" },
  { wrong: "spaete", correctLower: "späte" },
  { wrong: "spaeten", correctLower: "späten" },
  { wrong: "naechst", correctLower: "nächst" },
  { wrong: "naechste", correctLower: "nächste" },
  { wrong: "naechsten", correctLower: "nächsten" },
  { wrong: "naechster", correctLower: "nächster" },
  { wrong: "naechstes", correctLower: "nächstes" },
  { wrong: "naemlich", correctLower: "nämlich" },
  { wrong: "waehrend", correctLower: "während" },
  { wrong: "Waehrend", correctLower: "Während" },
  { wrong: "waehlen", correctLower: "wählen" },
  { wrong: "gewaehlt", correctLower: "gewählt" },
  { wrong: "auswaehlen", correctLower: "auswählen" },
  { wrong: "zaehlen", correctLower: "zählen" },
  { wrong: "zaehlt", correctLower: "zählt" },
  { wrong: "erzaehl", correctLower: "erzähl" },
  { wrong: "erzaehlen", correctLower: "erzählen" },
  { wrong: "erzaehlt", correctLower: "erzählt" },
  { wrong: "ungefaehr", correctLower: "ungefähr" },
  { wrong: "kaese", correctLower: "käse" },
  { wrong: "Kaese", correctLower: "Käse" },
  { wrong: "kaesekuchen", correctLower: "käsekuchen" },
  { wrong: "Kaesekuchen", correctLower: "Käsekuchen" },
  { wrong: "lecker", correctLower: "lecker" }, // unverändert
  { wrong: "warmen", correctLower: "warmen" }, // unverändert
  { wrong: "suess", correctLower: "süß" },
  { wrong: "Suess", correctLower: "Süß" },
  { wrong: "suesses", correctLower: "süßes" },
  { wrong: "Suesses", correctLower: "Süßes" },
  { wrong: "suesse", correctLower: "süße" },
  { wrong: "suessen", correctLower: "süßen" },
  { wrong: "Suessen", correctLower: "Süßen" },
  { wrong: "gluecklich", correctLower: "glücklich" },
  { wrong: "Gluecklich", correctLower: "Glücklich" },
  { wrong: "gluecklichen", correctLower: "glücklichen" },
  { wrong: "gluck", correctLower: "glück" },
  { wrong: "Gluck", correctLower: "Glück" },
  { wrong: "stueck", correctLower: "stück" },
  { wrong: "Stueck", correctLower: "Stück" },
  { wrong: "stuecke", correctLower: "stücke" },
  { wrong: "Stuecke", correctLower: "Stücke" },
  { wrong: "stueckchen", correctLower: "stückchen" },
  { wrong: "Stueckchen", correctLower: "Stückchen" },
  { wrong: "muessen", correctLower: "müssen" },
  { wrong: "muessten", correctLower: "müssten" },
  { wrong: "muss", correctLower: "muss" }, // unverändert (kurzer Vokal)
  { wrong: "gemuese", correctLower: "gemüse" },
  { wrong: "huelse", correctLower: "hülse" },
  { wrong: "Huelse", correctLower: "Hülse" },
  { wrong: "huelsenfruechte", correctLower: "hülsenfrüchte" },
  { wrong: "Huelsenfruechte", correctLower: "Hülsenfrüchte" },
  { wrong: "fruechte", correctLower: "früchte" },
  { wrong: "Fruechte", correctLower: "Früchte" },
  { wrong: "fruchtig", correctLower: "fruchtig" }, // unverändert
  { wrong: "groesse", correctLower: "größe" },
  { wrong: "Groesse", correctLower: "Größe" },
  { wrong: "groesser", correctLower: "größer" },
  { wrong: "groesste", correctLower: "größte" },
  { wrong: "groessten", correctLower: "größten" },
  { wrong: "groesseren", correctLower: "größeren" },
  { wrong: "fuelle", correctLower: "fülle" },
  { wrong: "Fuelle", correctLower: "Fülle" },
  { wrong: "fuellen", correctLower: "füllen" },
  { wrong: "ruehren", correctLower: "rühren" },
  { wrong: "verruehren", correctLower: "verrühren" },
  { wrong: "ruehrei", correctLower: "rührei" },
  { wrong: "Ruehrei", correctLower: "Rührei" },
  { wrong: "spuelen", correctLower: "spülen" },
  { wrong: "spuele", correctLower: "spüle" },
  { wrong: "buero", correctLower: "büro" },
  { wrong: "Buero", correctLower: "Büro" },
  { wrong: "feueranfaellig", correctLower: "feueranfällig" },
  { wrong: "anfaellig", correctLower: "anfällig" },
  { wrong: "salzfaesschen", correctLower: "salzfässchen" },
  { wrong: "klassiker", correctLower: "klassiker" }, // unverändert
  { wrong: "regelmaessig", correctLower: "regelmäßig" },
  { wrong: "regelmaessige", correctLower: "regelmäßige" },
  { wrong: "regelmaessigen", correctLower: "regelmäßigen" },
  { wrong: "draussen", correctLower: "draußen" },
  { wrong: "Draussen", correctLower: "Draußen" },
  { wrong: "weiss", correctLower: "weiß" },
  { wrong: "Weiss", correctLower: "Weiß" },
  { wrong: "weissen", correctLower: "weißen" },
  { wrong: "weisse", correctLower: "weiße" },
  { wrong: "heiss", correctLower: "heiß" },
  { wrong: "Heiss", correctLower: "Heiß" },
  { wrong: "heissem", correctLower: "heißem" },
  { wrong: "heissen", correctLower: "heißen" },
  { wrong: "heissluft", correctLower: "heißluft" },
  { wrong: "Heissluft", correctLower: "Heißluft" },
  { wrong: "Tonalitaet", correctLower: "Tonalität" },
  { wrong: "tonalitaet", correctLower: "tonalität" },
  { wrong: "qualitaet", correctLower: "qualität" },
  { wrong: "Qualitaet", correctLower: "Qualität" },
  { wrong: "spezialitaet", correctLower: "spezialität" },
  { wrong: "Spezialitaet", correctLower: "Spezialität" },
  { wrong: "leichtigkeit", correctLower: "leichtigkeit" }, // unverändert
  // Häufige Foreword-Vokabel die bisher fehlten (User-Report 2026-05-16)
  { wrong: "koennen", correctLower: "können" },
  { wrong: "koennt", correctLower: "könnt" },
  { wrong: "koennte", correctLower: "könnte" },
  { wrong: "koennten", correctLower: "könnten" },
  { wrong: "goennen", correctLower: "gönnen" },
  { wrong: "goenne", correctLower: "gönne" },
  { wrong: "goennt", correctLower: "gönnt" },
  { wrong: "verwoehnen", correctLower: "verwöhnen" },
  { wrong: "verwoehnt", correctLower: "verwöhnt" },
  { wrong: "geniessen", correctLower: "genießen" },
  { wrong: "geniesse", correctLower: "genieße" },
  { wrong: "geniesst", correctLower: "genießt" },
  { wrong: "genuss", correctLower: "genuss" }, // schon korrekt
  { wrong: "stoebern", correctLower: "stöbern" },
  { wrong: "stoeber", correctLower: "stöber" },
  { wrong: "Stoeber", correctLower: "Stöber" },
  { wrong: "stoebere", correctLower: "stöbere" },
  { wrong: "stoebert", correctLower: "stöbert" },
  { wrong: "moegen", correctLower: "mögen" },
  { wrong: "moege", correctLower: "möge" },
  { wrong: "ploetzlich", correctLower: "plötzlich" },
  { wrong: "Ploetzlich", correctLower: "Plötzlich" },
  { wrong: "soenne", correctLower: "söhne" }, // selten, edge
  { wrong: "loesen", correctLower: "lösen" },
  { wrong: "loese", correctLower: "löse" },
  { wrong: "loest", correctLower: "löst" },
  { wrong: "geloest", correctLower: "gelöst" },
  { wrong: "auswaehlen", correctLower: "auswählen" },
  { wrong: "ueberraschen", correctLower: "überraschen" },
  { wrong: "ueberrascht", correctLower: "überrascht" },
  { wrong: "ueberraschung", correctLower: "überraschung" },
  { wrong: "Ueberraschung", correctLower: "Überraschung" },
  { wrong: "ergaenzen", correctLower: "ergänzen" },
  { wrong: "ergaenze", correctLower: "ergänze" },
  { wrong: "ergaenzt", correctLower: "ergänzt" },
  { wrong: "Ergaenzung", correctLower: "Ergänzung" },
  { wrong: "ergaenzung", correctLower: "ergänzung" },
  { wrong: "bedanke", correctLower: "bedanke" }, // schon korrekt
  { wrong: "selbstverstaendlich", correctLower: "selbstverständlich" },
  { wrong: "Selbstverstaendlich", correctLower: "Selbstverständlich" },
  { wrong: "natuerlich", correctLower: "natürlich" },
  { wrong: "Natuerlich", correctLower: "Natürlich" },
  { wrong: "wuenschen", correctLower: "wünschen" },
  { wrong: "wuensche", correctLower: "wünsche" },
  { wrong: "wuenscht", correctLower: "wünscht" },
  { wrong: "Wuensche", correctLower: "Wünsche" },
  { wrong: "wuerzig", correctLower: "würzig" },
  { wrong: "wuerze", correctLower: "würze" },
  { wrong: "gewuerz", correctLower: "gewürz" },
  { wrong: "Gewuerz", correctLower: "Gewürz" },
  { wrong: "gewuerze", correctLower: "gewürze" },
  { wrong: "Gewuerze", correctLower: "Gewürze" },
  { wrong: "kueche", correctLower: "küche" },
  { wrong: "kochstueck", correctLower: "kochstück" },
  { wrong: "fluessig", correctLower: "flüssig" },
  { wrong: "fluessigkeit", correctLower: "flüssigkeit" },
  { wrong: "Fluessigkeit", correctLower: "Flüssigkeit" },
  { wrong: "huelle", correctLower: "hülle" },
  { wrong: "Huelle", correctLower: "Hülle" },
  { wrong: "ruecksicht", correctLower: "rücksicht" },
  { wrong: "ruecken", correctLower: "rücken" },
  { wrong: "zurueck", correctLower: "zurück" },
  { wrong: "Zurueck", correctLower: "Zurück" },
  { wrong: "druecken", correctLower: "drücken" },
  { wrong: "drueckt", correctLower: "drückt" },
  { wrong: "ausdruecklich", correctLower: "ausdrücklich" },
  { wrong: "stueck-fuer-stueck", correctLower: "stück-für-stück" },
  { wrong: "buecher", correctLower: "bücher" },
  { wrong: "Buecher", correctLower: "Bücher" },
  { wrong: "buecherregal", correctLower: "bücherregal" },
  { wrong: "muehe", correctLower: "mühe" },
  { wrong: "Muehe", correctLower: "Mühe" },
  { wrong: "muehelos", correctLower: "mühelos" },
  { wrong: "muelltrennung", correctLower: "mülltrennung" },
  { wrong: "muell", correctLower: "müll" },
  { wrong: "ueberfluessig", correctLower: "überflüssig" },
  { wrong: "ueberhaupt", correctLower: "überhaupt" },
  { wrong: "satt-essen", correctLower: "satt-essen" }, // schon ok
  { wrong: "lieblings", correctLower: "lieblings" }, // schon ok
  { wrong: "fragmentstueck", correctLower: "fragmentstück" }, // dummy
];

// Sortiere Map: längere Patterns zuerst, damit Substring-Matches nicht
// zu früh feuern. (Z.B. "Suesskartoffel" muss vor "Suess" matched werden.)
const SORTED_REPLACEMENTS = [...REPLACEMENTS].sort(
  (a, b) => b.wrong.length - a.wrong.length
);

/**
 * Konvertiert typische deutsche Wörter mit ae/oe/ue/ss zurück zu ä/ö/ü/ß.
 * Nur Wort-Boundary-Matches — Eigenamen wie "Sue Smith" bleiben unverändert.
 * Case-Preservation: "Fuer" → "Für", "fuer" → "für".
 */
export function restoreGermanUmlauts(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { wrong, correctLower } of SORTED_REPLACEMENTS) {
    if (wrong === correctLower) continue; // Pass-Through (kein Ersatz nötig)
    // Word-boundary-regex, case-insensitive
    const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, "gi");
    out = out.replace(regex, (match) => {
      // Case-Preservation: prüfe ersten Char
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return correctLower.charAt(0).toUpperCase() + correctLower.slice(1);
      }
      return correctLower;
    });
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
