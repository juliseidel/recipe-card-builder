import type { CSSProperties } from "react";

export const dynamic = "force-static";

// ─── BILDQUELLEN ──────────────────────────────────────────────────────────
// 1. Christian-Bilder: Cover-Storage in seinem Supabase (gemirrort, kein
//    IG-Rate-Limit). Saubere Sidecar-Karussell-Cover ohne TikTok-Captions.
// 2. Methoden-Visuals: Premium-Stockfotos Pexels CDN, public access.
// 3. Reel-Strip: Original-Reel-Thumbs mit Caption-Overlay (bewusst als
//    "Source"-Proof verwendet, klein gerendert).

const STORAGE = "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/reel-covers/christian";
const AVATAR = "https://gejrjcwuqaspgwtakwho.supabase.co/storage/v1/object/public/brand-avatars/auto/christianwolf-mpchbsgp-6tb03j.jpg";

const IMG = {
  // Cover-Hero — Backstage-Couple, dunkles Setting (s4 in Recherche)
  coverHero: `${STORAGE}/DXUorBmDJie.jpg`,
  // Akt I — Manifest-Portrait (Christian backstage allein-isoliert)
  manifestPortrait: `${STORAGE}/DXYmWsJDMsL.jpg`,
  // Akt IV — Lifestyle/Erfolg (Rolls-Royce-Shot)
  lifestyleSuccess: `${STORAGE}/DXubSlPiGX8.jpg`,
  // Outro — Cowboy-Couple (Lebens-Stoßenergie)
  outroLife: `${STORAGE}/DUbOV2gDA1G.jpg`,
  // Avatar für kleines Sign-Off-Bild
  avatar: AVATAR,
  // Methoden-Visuals — Pexels public CDN
  methodProtein: "https://images.pexels.com/photos/616833/pexels-photo-616833.jpeg?auto=compress&cs=tinysrgb&w=1600",
  methodBowl: "https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=1600",
  methodKitchen: "https://images.pexels.com/photos/3768146/pexels-photo-3768146.jpeg?auto=compress&cs=tinysrgb&w=1600",
  methodScale: "https://images.pexels.com/photos/4226119/pexels-photo-4226119.jpeg?auto=compress&cs=tinysrgb&w=1600",
  methodPhone: "https://images.pexels.com/photos/4498482/pexels-photo-4498482.jpeg?auto=compress&cs=tinysrgb&w=1600",
};

// Reel-Quellen für den Source-Strip auf der Editorial-Note-Seite
const SOURCE_REELS = [
  { code: "DXCoOiJsb2_", views: "599k", caption: "WPF erklärt" },
  { code: "DXESvwmsdbm", views: "725k", caption: "Die ×10-Regel" },
  { code: "DTkwxoKjMd5", views: "238k", caption: "Sattmach-Stack" },
  { code: "DRW13GmjNI7", views: "189k", caption: "Kalorien 60s" },
  { code: "DSuKAFkDM3_", views: "217k", caption: "WPF-App" },
];

const bg = (src: string, position = "center"): CSSProperties => ({
  backgroundImage: `url("${src}")`,
  backgroundSize: "cover",
  backgroundPosition: position,
});

export default function WpfManifestPreview() {
  return (
    <main>
      <ScreenBar />

      {/* ─── 1. COVER ──────────────────────────────────────────── */}
      <CoverPage />

      {/* ─── 2. EDITORIAL NOTE / TITELSEITE ──────────────────── */}
      <EditorialNotePage />

      {/* ─── 3. AKT I — DAS VERSPRECHEN ──────────────────────── */}
      <AktOpenerPage
        roman="I"
        eyebrow="Akt 1 · Das Versprechen"
        title={<>Warum&nbsp;<em className="wpf-editorial-italic">700.000</em>&nbsp;es schon geschafft haben.</>}
        image={IMG.manifestPortrait}
        imagePosition="center 20%"
      />

      {/* ─── 4. AKT I — Body ─────────────────────────────────── */}
      <ManifestBodyPage />

      {/* ─── 5. AKT II — DIE METHODE ─────────────────────────── */}
      <DefinitionPage />

      {/* ─── 6. AKT III — HEBEL 1: ×10-REGEL ─────────────────── */}
      <HebelOnePage />

      {/* ─── 7. HEBEL 1 — Diagram-Page ───────────────────────── */}
      <HebelOneDiagramPage />

      {/* ─── 8. HEBEL 2: SATTMACH-STACK ──────────────────────── */}
      <HebelTwoPage />

      {/* ─── 9. HEBEL 2 — Stack-Steps ────────────────────────── */}
      <HebelTwoStackPage />

      {/* ─── 10. HEBEL 3: KALORIEN 60s ───────────────────────── */}
      <HebelThreePage />

      {/* ─── 11. AKT IV — DEIN TAG IN WPF ────────────────────── */}
      <DayInWpfPage />

      {/* ─── 12. AKT V — OUTRO/SIGN-OFF ──────────────────────── */}
      <OutroPage />
    </main>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCREEN-BAR — nur Browser-Ansicht, zeigt Seiten-Index
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScreenBar() {
  return (
    <div className="wpf-screen-bar">
      <span>
        <span className="wpf-screen-bar-dot" />
        WPF · Das Manifest · Preview-Mockup v1
      </span>
      <span>Christian Wolf — 12 Seiten · A4 Hochkant + 4:5 Cover</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 1 — COVER (4:5 portrait)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CoverPage() {
  return (
    <div className="wpf-cover">
      <div
        className="wpf-cover-bg-image"
        style={bg(IMG.coverHero, "center 30%")}
      />
      <div className="wpf-cover-vignette" />
      <div className="wpf-cover-content">
        {/* Top — Stamp + Edition */}
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "rgba(243,236,224,0.7)" }}>
            <span className="wpf-mark-dot" />
            Christian Wolf · Edition № 01
          </div>
          <div
            className="wpf-stamp"
            style={{ color: "rgba(243,236,224,0.55)", fontSize: "10px" }}
          >
            MMXXVI · Druck-Auflage 01
          </div>
        </header>

        {/* Center — Mega-Type */}
        <div style={{ paddingTop: "20px" }}>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "11px",
              color: "var(--wpf-honey)",
              marginBottom: "32px",
            }}
          >
            Das Methoden-Handbuch zum Wolf-Protein-Fasting
          </div>
          <h1
            className="wpf-cover-mega wpf-no-orphan"
            style={{ marginBottom: "-12px" }}
          >
            WPF<span className="wpf-cover-mega-i">.</span>
          </h1>
          <p
            className="wpf-editorial-italic"
            style={{
              fontSize: "56px",
              color: "rgba(243,236,224,0.92)",
              marginTop: "24px",
              maxWidth: "560px",
              lineHeight: "1.05",
              letterSpacing: "-0.025em",
            }}
          >
            Was wirklich funktioniert,<br />
            wenn man weiß <em>wie</em>.
          </p>
        </div>

        {/* Bottom — Author block */}
        <footer className="flex items-end justify-between">
          <div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "rgba(243,236,224,0.5)",
                marginBottom: "8px",
              }}
            >
              Geschrieben von
            </div>
            <div
              className="wpf-editorial"
              style={{ fontSize: "32px", color: "var(--wpf-paper)" }}
            >
              Christian Wolf
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "rgba(243,236,224,0.55)",
                marginTop: "8px",
              }}
            >
              @christianwolf · 1.8M
            </div>
          </div>
          <div className="text-right">
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "rgba(243,236,224,0.5)",
                marginBottom: "8px",
              }}
            >
              Ausgabe
            </div>
            <div
              className="wpf-editorial-italic"
              style={{ fontSize: "32px", color: "var(--wpf-honey)" }}
            >
              N° 01
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 2 — EDITORIAL NOTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EditorialNotePage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header>
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Editorial · S. 02
          </div>
        </header>

        <div style={{ maxWidth: "560px" }}>
          <div
            className="wpf-stamp"
            style={{
              color: "var(--wpf-rust)",
              fontSize: "11px",
              marginBottom: "32px",
            }}
          >
            Ein Wort vorab
          </div>
          <p
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "52px",
              lineHeight: "1.04",
              marginBottom: "32px",
              color: "var(--wpf-ink)",
            }}
          >
            Über 700.000 Menschen haben mit meinen Tipps Fett verloren.{" "}
            <em className="wpf-editorial-italic" style={{ color: "var(--wpf-rust)" }}>
              WPF
            </em>{" "}
            ist das Konzept, das den meisten auch langfristig hilft.
          </p>
          <p
            className="wpf-body"
            style={{
              fontSize: "16px",
              color: "var(--wpf-ink-soft)",
              maxWidth: "440px",
            }}
          >
            Dieses Heft ist kein Diätplan. Es ist ein Manifest gegen alles,
            was dich bisher aufgehalten hat — gegen Verzichts-Rhetorik, gegen
            Marketing-Märchen, gegen das ewige Anfangen-Aufhören. Drei Hebel.
            Ein Konzept. Dein Start.
          </p>
        </div>

        <footer>
          <div
            className="wpf-stamp"
            style={{
              color: "var(--wpf-ink-mute)",
              fontSize: "10px",
              marginBottom: "16px",
            }}
          >
            Basiert auf 5 viralen Reels · gesehen 1.97M Mal
          </div>
          <div className="wpf-reel-strip">
            {SOURCE_REELS.map((r) => (
              <div
                key={r.code}
                className="wpf-reel-thumb"
                style={bg(`${STORAGE}/${r.code}.jpg`)}
                title={`${r.views} views — ${r.caption}`}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: "6px",
                    left: "8px",
                    right: "8px",
                    fontFamily: "var(--font-stamp)",
                    fontSize: "8px",
                    color: "rgba(243,236,224,0.95)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    zIndex: 2,
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  {r.views}
                </div>
              </div>
            ))}
          </div>
          <hr className="wpf-rule-soft" style={{ marginTop: "20px" }} />
          <div
            className="flex justify-between"
            style={{ marginTop: "12px", color: "var(--wpf-ink-mute)" }}
          >
            <span className="wpf-mark">
              <span className="wpf-mark-dot" />
              WPF Manifest
            </span>
            <span className="wpf-stamp" style={{ fontSize: "10px" }}>
              02 / 12
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 3 — AKT-OPENER (gen.) — Akt I Hero
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AktOpenerPage({
  roman,
  eyebrow,
  title,
  image,
  imagePosition = "center",
}: {
  roman: string;
  eyebrow: string;
  title: React.ReactNode;
  image: string;
  imagePosition?: string;
}) {
  return (
    <div
      className="wpf-page wpf-page-night"
      style={{ position: "relative" }}
    >
      {/* BG Image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          ...bg(image, imagePosition),
          filter: "grayscale(0.55) contrast(1.08) brightness(0.5)",
          zIndex: 0,
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(20,16,11,0.55) 0%, rgba(20,16,11,0.25) 40%, rgba(20,16,11,0.85) 100%)",
          zIndex: 1,
        }}
      />
      {/* Mega-Roman watermark */}
      <div
        className="wpf-editorial-italic"
        style={{
          position: "absolute",
          right: "-30px",
          top: "60px",
          fontSize: "440px",
          lineHeight: "0.8",
          color: "rgba(199,147,54,0.18)",
          letterSpacing: "-0.06em",
          zIndex: 1,
          fontStyle: "italic",
        }}
      >
        {roman}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <header>
          <div
            className="wpf-mark"
            style={{ color: "rgba(243,236,224,0.65)" }}
          >
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-honey)" }}
            />
            {eyebrow}
          </div>
        </header>

        <div style={{ maxWidth: "640px", paddingBottom: "80px" }}>
          <h2
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "92px",
              lineHeight: "0.96",
              color: "var(--wpf-paper)",
              letterSpacing: "-0.025em",
            }}
          >
            {title}
          </h2>
          <hr
            className="wpf-rule"
            style={{
              background: "var(--wpf-honey)",
              width: "80px",
              height: "2px",
              marginTop: "40px",
              marginBottom: "0",
            }}
          />
        </div>

        <footer
          className="flex justify-between items-baseline"
          style={{ color: "rgba(243,236,224,0.55)" }}
        >
          <span className="wpf-stamp" style={{ fontSize: "10px" }}>
            WPF Manifest · Christian Wolf
          </span>
          <span className="wpf-stamp" style={{ fontSize: "10px" }}>
            03 / 12
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 4 — MANIFEST BODY (Akt I)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ManifestBodyPage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Akt 1 · Fortgesetzt
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            04 / 12
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: "64px",
            alignItems: "start",
          }}
        >
          <aside>
            <div
              className="wpf-callout-num"
              style={{ fontSize: "120px" }}
            >
              15
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "var(--wpf-ink-mute)",
                marginTop: "8px",
              }}
            >
              Kilo · selbst<br />abgenommen
            </div>

            <div
              className="wpf-callout-num"
              style={{ fontSize: "120px", marginTop: "48px" }}
            >
              700k
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "var(--wpf-ink-mute)",
                marginTop: "8px",
              }}
            >
              Menschen ·<br />denen ich half
            </div>

            <div
              className="wpf-callout-num"
              style={{ fontSize: "120px", marginTop: "48px" }}
            >
              1
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "var(--wpf-ink-mute)",
                marginTop: "8px",
              }}
            >
              Konzept ·<br />das wirkt
            </div>
          </aside>

          <div>
            <h3
              className="wpf-editorial wpf-no-orphan"
              style={{
                fontSize: "36px",
                lineHeight: "1.08",
                color: "var(--wpf-ink)",
                marginBottom: "32px",
              }}
            >
              Der Grund, warum mich viele hassen, ist einfach:{" "}
              <em
                className="wpf-editorial-italic"
                style={{ color: "var(--wpf-rust)" }}
              >
                weil ich rigoros sage, was funktioniert.
              </em>
            </h3>
            <p
              className="wpf-body wpf-drop-cap"
              style={{
                fontSize: "15px",
                lineHeight: "1.65",
                color: "var(--wpf-ink-soft)",
                marginBottom: "24px",
              }}
            >
              Ich habe selbst 15 Kilo verloren. Nicht in einer Crash-Diät, nicht
              durch Verzicht, nicht weil ich plötzlich Sport-Genie wurde. Ich
              habe es geschafft, weil ich ein paar harte Wahrheiten akzeptiert
              habe — und ein Konzept gebaut, das sich um meinen Alltag dreht,
              nicht andersrum.
            </p>
            <p
              className="wpf-body"
              style={{
                fontSize: "15px",
                lineHeight: "1.65",
                color: "var(--wpf-ink-soft)",
                marginBottom: "24px",
              }}
            >
              Genau dieses Konzept teile ich seit Jahren bei Instagram. Über
              700.000 Menschen haben damit erfolgreich Fett verloren. Was du
              gleich liest, ist kein neuer Marketing-Spin. Es ist die
              Essenz — destilliert auf die drei Hebel, die wirklich etwas
              verändern.
            </p>
            <p
              className="wpf-editorial-italic"
              style={{
                fontSize: "22px",
                lineHeight: "1.3",
                color: "var(--wpf-rust)",
                marginTop: "32px",
                maxWidth: "440px",
              }}
            >
              Wenn du dieses Heft zu Ende liest, weißt du, was ich in zehn
              Jahren herausgefunden habe.
            </p>
          </div>
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span className="wpf-mark">
            <span className="wpf-mark-dot" />
            WPF Manifest
          </span>
          <span
            className="wpf-stamp"
            style={{ fontSize: "10px", fontStyle: "italic" }}
          >
            Christian Wolf
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 5 — DEFINITION (Akt II)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DefinitionPage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Akt 2 · Die Methode
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            05 / 12
          </div>
        </header>

        <div style={{ maxWidth: "600px" }}>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "11px",
              color: "var(--wpf-rust)",
              marginBottom: "32px",
            }}
          >
            WPF — Was es ist
          </div>
          <h2
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "84px",
              lineHeight: "0.96",
              letterSpacing: "-0.03em",
              color: "var(--wpf-ink)",
              marginBottom: "40px",
            }}
          >
            <em className="wpf-editorial-italic">Wolf</em>{" "}
            Protein Fasting.
          </h2>
          <p
            className="wpf-body"
            style={{
              fontSize: "18px",
              lineHeight: "1.55",
              color: "var(--wpf-ink-soft)",
              maxWidth: "520px",
            }}
          >
            Ein pragmatisches Konzept aus drei Hebeln: Du isst protein-zentriert
            statt kalorien-zentriert. Du baust Sättigung über Volumen, nicht
            über Disziplin. Und du trackst nur das, was wirklich zählt — in
            unter 60 Sekunden pro Mahlzeit.
          </p>
        </div>

        <div>
          <hr className="wpf-rule" style={{ marginBottom: "32px" }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "40px",
            }}
          >
            {[
              {
                num: "01",
                title: "Die ×10-Regel",
                desc: "Erkenne High-Protein-Lebensmittel auf einen Blick.",
              },
              {
                num: "02",
                title: "Der Sattmach-Stack",
                desc: "Fünf Schritte, mit denen Heißhunger keine Chance hat.",
              },
              {
                num: "03",
                title: "60 Sekunden",
                desc: "Die einfachste Kalorien-Methode, die ich kenne.",
              },
            ].map((h) => (
              <div key={h.num}>
                <div
                  className="wpf-editorial-italic"
                  style={{
                    fontSize: "48px",
                    color: "var(--wpf-rust)",
                    lineHeight: "0.9",
                  }}
                >
                  {h.num}
                </div>
                <div
                  className="wpf-editorial"
                  style={{
                    fontSize: "26px",
                    color: "var(--wpf-ink)",
                    marginTop: "12px",
                    lineHeight: "1.05",
                  }}
                >
                  {h.title}
                </div>
                <div
                  className="wpf-body"
                  style={{
                    fontSize: "13px",
                    color: "var(--wpf-ink-mute)",
                    marginTop: "8px",
                    lineHeight: "1.5",
                  }}
                >
                  {h.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span className="wpf-mark">
            <span className="wpf-mark-dot" />
            WPF Manifest
          </span>
          <span
            className="wpf-stamp"
            style={{ fontSize: "10px", fontStyle: "italic" }}
          >
            Christian Wolf
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 6 — HEBEL 1 HERO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HebelOnePage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div
        style={{
          height: "60%",
          position: "relative",
          overflow: "hidden",
          ...bg(IMG.methodProtein, "center"),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(20,16,11,0.05) 0%, rgba(20,16,11,0.0) 50%, rgba(243,236,224,0.95) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "56px",
            top: "56px",
            color: "rgba(243,236,224,0.85)",
          }}
        >
          <div className="wpf-mark">
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-honey)" }}
            />
            Hebel 01
          </div>
        </div>
        <div
          className="wpf-editorial-italic"
          style={{
            position: "absolute",
            left: "56px",
            bottom: "100px",
            fontSize: "200px",
            lineHeight: "0.85",
            color: "var(--wpf-paper)",
            letterSpacing: "-0.04em",
            textShadow: "0 4px 24px rgba(20,16,11,0.4)",
          }}
        >
          ×10
        </div>
      </div>
      <div
        style={{
          height: "40%",
          padding: "56px 80px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ maxWidth: "560px" }}>
          <h3
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "48px",
              lineHeight: "1.02",
              color: "var(--wpf-ink)",
              letterSpacing: "-0.02em",
              marginBottom: "20px",
            }}
          >
            Die <em className="wpf-editorial-italic">×10-Regel</em>.
          </h3>
          <p
            className="wpf-body"
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              color: "var(--wpf-ink-soft)",
              maxWidth: "480px",
            }}
          >
            Nimm die Gramm Eiweiß pro 100 g und häng eine Null hinten ran.
            Ist die Zahl größer als die Kalorien pro 100 g — High Protein.
            Ist sie kleiner — kein High Protein. So einfach.
          </p>
        </div>
        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span className="wpf-mark">
            <span className="wpf-mark-dot" />
            WPF Manifest
          </span>
          <span className="wpf-stamp" style={{ fontSize: "10px" }}>
            06 / 12
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 7 — HEBEL 1 DIAGRAM (Live-Beispiele)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HebelOneDiagramPage() {
  const examples = [
    {
      name: "Magerquark",
      protein: 12,
      kcal: 67,
      verdict: "yes",
      caption: "12g × 10 = 120 → 120 > 67",
    },
    {
      name: "Hähnchenbrust",
      protein: 23,
      kcal: 110,
      verdict: "yes",
      caption: "23g × 10 = 230 → 230 > 110",
    },
    {
      name: "Skyr Natur",
      protein: 11,
      kcal: 63,
      verdict: "yes",
      caption: "11g × 10 = 110 → 110 > 63",
    },
    {
      name: "Vollmilch",
      protein: 3.4,
      kcal: 64,
      verdict: "no",
      caption: "3.4g × 10 = 34 → 34 < 64",
    },
    {
      name: "Avocado",
      protein: 2,
      kcal: 160,
      verdict: "no",
      caption: "2g × 10 = 20 → 20 < 160",
    },
    {
      name: "Whey-Protein",
      protein: 82,
      kcal: 380,
      verdict: "yes",
      caption: "82g × 10 = 820 → 820 > 380",
    },
  ];

  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Hebel 01 · Anwendung
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            07 / 12
          </div>
        </header>

        <div>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "11px",
              color: "var(--wpf-rust)",
              marginBottom: "20px",
            }}
          >
            Sechs Beispiele · ein Test
          </div>
          <h3
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "48px",
              lineHeight: "1.02",
              color: "var(--wpf-ink)",
              maxWidth: "560px",
              marginBottom: "40px",
            }}
          >
            Was steckt wirklich drin, wenn{" "}
            <em className="wpf-editorial-italic">„High Protein"</em> draufsteht?
          </h3>

          <hr className="wpf-rule" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 0.6fr 2fr",
              fontFamily: "var(--font-stamp)",
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--wpf-ink-mute)",
              padding: "12px 0",
              borderBottom: "1px solid var(--wpf-paper-mute)",
            }}
          >
            <div>Lebensmittel</div>
            <div style={{ textAlign: "right" }}>Eiweiß / 100g</div>
            <div style={{ textAlign: "right" }}>Kcal / 100g</div>
            <div style={{ textAlign: "right" }}>Test</div>
            <div style={{ textAlign: "right" }}>Rechnung</div>
          </div>

          {examples.map((e) => (
            <div
              key={e.name}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 0.6fr 2fr",
                alignItems: "baseline",
                padding: "16px 0",
                borderBottom: "1px solid var(--wpf-paper-mute)",
              }}
            >
              <div
                className="wpf-editorial"
                style={{ fontSize: "26px", color: "var(--wpf-ink)" }}
              >
                {e.name}
              </div>
              <div
                className="wpf-tabular wpf-body"
                style={{
                  textAlign: "right",
                  fontSize: "20px",
                  color: "var(--wpf-ink)",
                  fontWeight: 500,
                }}
              >
                {e.protein}&thinsp;g
              </div>
              <div
                className="wpf-tabular wpf-body"
                style={{
                  textAlign: "right",
                  fontSize: "20px",
                  color: "var(--wpf-ink-soft)",
                }}
              >
                {e.kcal}
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className="wpf-editorial-italic"
                  style={{
                    fontSize: "22px",
                    color:
                      e.verdict === "yes"
                        ? "var(--wpf-rust)"
                        : "var(--wpf-ink-mute)",
                  }}
                >
                  {e.verdict === "yes" ? "Ja" : "Nein"}
                </span>
              </div>
              <div
                className="wpf-stamp wpf-tabular"
                style={{
                  fontSize: "10px",
                  color: "var(--wpf-ink-mute)",
                  textAlign: "right",
                }}
              >
                {e.caption}
              </div>
            </div>
          ))}
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span className="wpf-editorial-italic" style={{ fontSize: "16px" }}>
            „Sobald die Zahl größer als die Kalorien ist — hat es einen hohen
            Eiweiß-Anteil."
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 8 — HEBEL 2 HERO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HebelTwoPage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          height: "100%",
        }}
      >
        {/* Left — Editorial */}
        <div
          style={{
            padding: "72px 64px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "var(--wpf-paper)",
          }}
        >
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Hebel 02
          </div>
          <div>
            <div
              className="wpf-editorial-italic"
              style={{
                fontSize: "32px",
                color: "var(--wpf-rust)",
                marginBottom: "16px",
              }}
            >
              02 / 03
            </div>
            <h3
              className="wpf-editorial wpf-no-orphan"
              style={{
                fontSize: "82px",
                lineHeight: "0.94",
                color: "var(--wpf-ink)",
                letterSpacing: "-0.03em",
                marginBottom: "32px",
              }}
            >
              Der{" "}
              <em
                className="wpf-editorial-italic"
                style={{ color: "var(--wpf-rust)" }}
              >
                Sattmach
              </em>
              -Stack.
            </h3>
            <p
              className="wpf-body"
              style={{
                fontSize: "16px",
                lineHeight: "1.6",
                color: "var(--wpf-ink-soft)",
                maxWidth: "380px",
              }}
            >
              Hunger ist kein Charakter-Test. Es ist ein Volumen-Problem. Diese
              fünf Schritte stapeln Sättigung — Schicht für Schicht — bevor du
              überhaupt anfängst zu essen.
            </p>
          </div>
          <footer
            className="flex justify-between"
            style={{ color: "var(--wpf-ink-mute)" }}
          >
            <span className="wpf-mark">
              <span className="wpf-mark-dot" />
              WPF
            </span>
            <span className="wpf-stamp" style={{ fontSize: "10px" }}>
              08 / 12
            </span>
          </footer>
        </div>
        {/* Right — Image */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            ...bg(IMG.methodBowl, "center"),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(105deg, rgba(243,236,224,0.85) 0%, rgba(243,236,224,0.0) 35%, rgba(243,236,224,0) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "32px",
              right: "32px",
              color: "rgba(243,236,224,0.85)",
              textAlign: "right",
              fontFamily: "var(--font-stamp)",
              fontSize: "9px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(20,16,11,0.5)",
            }}
          >
            Beispiel-Frühstück<br />
            Protein-Porridge · Beeren · Flohsamen
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 9 — HEBEL 2 STEP-STACK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HebelTwoStackPage() {
  const steps = [
    {
      title: "Zwei Gläser Wasser",
      time: "0–2 min",
      body: "Vor jeder Mahlzeit. Dehnt den Magen, drosselt das Hungersignal. Kein Trick — pure Mechanik.",
    },
    {
      title: "Proteinquelle zuerst",
      time: "Bei Christian: Porridge",
      body: "Bestimme, was diese Mahlzeit zur Mahlzeit macht. Sättigt langanhaltend und liefert Bausubstanz.",
    },
    {
      title: "Zuckerfrei süßen",
      time: "Optional",
      body: "Chunky Flavour, Zerup, Stevia — Geschmack ohne Kalorien-Hypothek.",
    },
    {
      title: "Beeren hinzu",
      time: "+ 100 g",
      body: "Ballaststoffe, Pflanzenstoffe, Volumen, Süße — alles in einem. Heidelbeeren oder Himbeeren bevorzugt.",
    },
    {
      title: "Flohsamenschalen",
      time: "1 EL",
      body: "Trinken mit. Quillt im Magen auf das 10-Fache. Stille Sättigungs-Maschine.",
    },
  ];

  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Hebel 02 · Anleitung
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            09 / 12
          </div>
        </header>

        <div>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "11px",
              color: "var(--wpf-rust)",
              marginBottom: "20px",
            }}
          >
            Fünf Schritte · in dieser Reihenfolge
          </div>
          <h3
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "48px",
              lineHeight: "1.02",
              color: "var(--wpf-ink)",
              marginBottom: "32px",
              maxWidth: "560px",
            }}
          >
            So baust du Sättigung,{" "}
            <em className="wpf-editorial-italic">bevor</em> du isst.
          </h3>

          <hr className="wpf-rule" />
          {steps.map((s, i) => (
            <div key={s.title} className="wpf-stack-row">
              <div className="wpf-stack-num">{`0${i + 1}`}</div>
              <div>
                <div className="flex justify-between items-baseline">
                  <div
                    className="wpf-editorial"
                    style={{ fontSize: "28px", color: "var(--wpf-ink)" }}
                  >
                    {s.title}
                  </div>
                  <div
                    className="wpf-stamp"
                    style={{
                      fontSize: "10px",
                      color: "var(--wpf-ink-mute)",
                    }}
                  >
                    {s.time}
                  </div>
                </div>
                <p
                  className="wpf-body"
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.55",
                    color: "var(--wpf-ink-soft)",
                    marginTop: "6px",
                    maxWidth: "540px",
                  }}
                >
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span
            className="wpf-editorial-italic"
            style={{ fontSize: "15px" }}
          >
            „Für alle, die immer Hunger haben — hier eine genaue Anleitung."
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 10 — HEBEL 3 60-SEC METHODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HebelThreePage() {
  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Hebel 03 · Tracking
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            10 / 12
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "start",
          }}
        >
          <div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "11px",
                color: "var(--wpf-rust)",
                marginBottom: "20px",
              }}
            >
              Hebel 03 / 03
            </div>
            <h3
              className="wpf-editorial wpf-no-orphan"
              style={{
                fontSize: "76px",
                lineHeight: "0.96",
                color: "var(--wpf-ink)",
                letterSpacing: "-0.03em",
                marginBottom: "32px",
              }}
            >
              Kalorien in{" "}
              <em
                className="wpf-editorial-italic"
                style={{ color: "var(--wpf-rust)" }}
              >
                60 Sekunden
              </em>
              .
            </h3>
            <p
              className="wpf-body"
              style={{
                fontSize: "16px",
                lineHeight: "1.6",
                color: "var(--wpf-ink-soft)",
                marginBottom: "24px",
              }}
            >
              Vergiss komplette Apps mit endlosen Datenbanken. Drei Werte pro
              Mahlzeit reichen. Tracken ist Mittel zum Zweck — nicht Hobby.
            </p>
            <hr className="wpf-rule-soft" />
            <div
              className="wpf-editorial-italic"
              style={{
                fontSize: "20px",
                color: "var(--wpf-ink-soft)",
                lineHeight: "1.4",
                marginTop: "20px",
              }}
            >
              „Mit über 700.000 Menschen, denen ich beim Abnehmen geholfen
              habe, weiß ich: das hier reicht."
            </div>
          </div>

          {/* Right — 3-step timer-visual */}
          <div>
            <div
              style={{
                background: "var(--wpf-night)",
                color: "var(--wpf-paper)",
                padding: "40px 36px",
                borderRadius: "2px",
              }}
            >
              <div
                className="wpf-stamp"
                style={{
                  fontSize: "10px",
                  color: "var(--wpf-honey)",
                  marginBottom: "20px",
                }}
              >
                Pro Mahlzeit · 60 Sekunden
              </div>
              {[
                {
                  s: "20s",
                  title: "Protein",
                  desc: "Wie viel Eiweiß? (Hauptzutat zählen)",
                },
                {
                  s: "20s",
                  title: "Kalorien",
                  desc: "Beilagen + Fett-Quelle grob schätzen",
                },
                {
                  s: "20s",
                  title: "Ist-Stand",
                  desc: "Tageskonto: dazu? darunter? darüber?",
                },
              ].map((row, i) => (
                <div
                  key={row.title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
                    gap: "24px",
                    padding: "20px 0",
                    borderTop:
                      i === 0
                        ? "1px solid rgba(243,236,224,0.2)"
                        : "1px solid rgba(243,236,224,0.1)",
                  }}
                >
                  <div
                    className="wpf-editorial-italic"
                    style={{
                      fontSize: "32px",
                      color: "var(--wpf-honey)",
                      lineHeight: "0.95",
                    }}
                  >
                    {row.s}
                  </div>
                  <div>
                    <div
                      className="wpf-editorial"
                      style={{ fontSize: "24px", color: "var(--wpf-paper)" }}
                    >
                      {row.title}
                    </div>
                    <div
                      className="wpf-body"
                      style={{
                        fontSize: "13px",
                        color: "rgba(243,236,224,0.65)",
                        marginTop: "4px",
                      }}
                    >
                      {row.desc}
                    </div>
                  </div>
                </div>
              ))}
              <hr className="wpf-rule-thin-paper" style={{ marginTop: "16px" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: "16px",
                }}
              >
                <span
                  className="wpf-stamp"
                  style={{
                    fontSize: "10px",
                    color: "rgba(243,236,224,0.55)",
                  }}
                >
                  Summe
                </span>
                <span
                  className="wpf-editorial-italic"
                  style={{
                    fontSize: "48px",
                    color: "var(--wpf-honey)",
                    lineHeight: "1",
                  }}
                >
                  60s
                </span>
              </div>
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "var(--wpf-ink-mute)",
                marginTop: "16px",
                textAlign: "right",
              }}
            >
              Quelle: Reel · 189k views · Nov. 2025
            </div>
          </div>
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span className="wpf-mark">
            <span className="wpf-mark-dot" />
            WPF Manifest
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 11 — DEIN TAG IN WPF (Akt IV)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DayInWpfPage() {
  const slots = [
    {
      time: "07:00",
      meal: "Protein-Porridge",
      detail: "Magerquark · Beeren · Flohsamen",
      protein: "42 g",
      kcal: "380",
    },
    {
      time: "12:30",
      meal: "Hähnchen-Bowl",
      detail: "200 g Brust · Reis · Gemüse",
      protein: "52 g",
      kcal: "560",
    },
    {
      time: "16:00",
      meal: "Skyr-Snack",
      detail: "Skyr · Whey · Zimt",
      protein: "38 g",
      kcal: "240",
    },
    {
      time: "19:30",
      meal: "Wraps mit Hüttenkäse",
      detail: "Putenstreifen · Hüttenkäse · Salat",
      protein: "48 g",
      kcal: "490",
    },
  ];

  return (
    <div className="wpf-page wpf-page-cream">
      <div className="wpf-note-page">
        <header className="flex justify-between items-start">
          <div className="wpf-mark" style={{ color: "var(--wpf-ink-mute)" }}>
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-rust)" }}
            />
            Akt 4 · Ein Tag in WPF
          </div>
          <div
            className="wpf-stamp"
            style={{ fontSize: "10px", color: "var(--wpf-ink-mute)" }}
          >
            11 / 12
          </div>
        </header>

        <div>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "11px",
              color: "var(--wpf-rust)",
              marginBottom: "20px",
            }}
          >
            Beispiel · Ein Werktag
          </div>
          <h3
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "56px",
              lineHeight: "1",
              color: "var(--wpf-ink)",
              maxWidth: "600px",
              marginBottom: "32px",
            }}
          >
            So fühlt sich{" "}
            <em className="wpf-editorial-italic">WPF</em> im Alltag an.
          </h3>

          <hr className="wpf-rule" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 2fr 2fr 1fr 1fr",
              fontFamily: "var(--font-stamp)",
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--wpf-ink-mute)",
              padding: "12px 0",
              borderBottom: "1px solid var(--wpf-paper-mute)",
            }}
          >
            <div>Uhrzeit</div>
            <div>Mahlzeit</div>
            <div>Was drauf kommt</div>
            <div style={{ textAlign: "right" }}>Eiweiß</div>
            <div style={{ textAlign: "right" }}>Kcal</div>
          </div>

          {slots.map((s) => (
            <div
              key={s.time}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 2fr 2fr 1fr 1fr",
                alignItems: "baseline",
                padding: "20px 0",
                borderBottom: "1px solid var(--wpf-paper-mute)",
              }}
            >
              <div
                className="wpf-editorial-italic"
                style={{
                  fontSize: "30px",
                  color: "var(--wpf-rust)",
                }}
              >
                {s.time}
              </div>
              <div
                className="wpf-editorial"
                style={{ fontSize: "26px", color: "var(--wpf-ink)" }}
              >
                {s.meal}
              </div>
              <div
                className="wpf-body"
                style={{ fontSize: "14px", color: "var(--wpf-ink-soft)" }}
              >
                {s.detail}
              </div>
              <div
                className="wpf-tabular wpf-body"
                style={{
                  textAlign: "right",
                  fontSize: "18px",
                  fontWeight: 500,
                  color: "var(--wpf-ink)",
                }}
              >
                {s.protein}
              </div>
              <div
                className="wpf-tabular wpf-body"
                style={{
                  textAlign: "right",
                  fontSize: "18px",
                  color: "var(--wpf-ink-soft)",
                }}
              >
                {s.kcal}
              </div>
            </div>
          ))}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 2fr 2fr 1fr 1fr",
              alignItems: "baseline",
              padding: "24px 16px",
              marginTop: "8px",
              marginLeft: "-16px",
              marginRight: "-16px",
              background: "var(--wpf-paper-deep)",
            }}
          >
            <div
              className="wpf-stamp"
              style={{ fontSize: "11px", color: "var(--wpf-rust)" }}
            >
              Summe
            </div>
            <div />
            <div
              className="wpf-body"
              style={{ fontSize: "13px", color: "var(--wpf-ink-mute)" }}
            >
              ≈ 1.8&thinsp;g Eiweiß / kg Körpergewicht
            </div>
            <div
              className="wpf-editorial-italic wpf-tabular"
              style={{
                textAlign: "right",
                fontSize: "26px",
                color: "var(--wpf-rust)",
              }}
            >
              180 g
            </div>
            <div
              className="wpf-editorial-italic wpf-tabular"
              style={{
                textAlign: "right",
                fontSize: "26px",
                color: "var(--wpf-rust)",
              }}
            >
              1670
            </div>
          </div>
        </div>

        <footer
          className="flex justify-between"
          style={{ color: "var(--wpf-ink-mute)" }}
        >
          <span
            className="wpf-editorial-italic"
            style={{ fontSize: "15px", maxWidth: "440px" }}
          >
            „Es geht darum, clever zu sein — nicht kompliziert."
          </span>
        </footer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEITE 12 — OUTRO (Akt V) — Sign-Off
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OutroPage() {
  return (
    <div className="wpf-page wpf-page-night" style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          ...bg(IMG.outroLife, "center 25%"),
          filter: "grayscale(0.5) contrast(1.05) brightness(0.5)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(20,16,11,0.85) 0%, rgba(20,16,11,0.55) 45%, rgba(20,16,11,0.95) 100%)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "80px 80px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <header>
          <div
            className="wpf-mark"
            style={{ color: "rgba(243,236,224,0.65)" }}
          >
            <span
              className="wpf-mark-dot"
              style={{ background: "var(--wpf-honey)" }}
            />
            Akt 5 · Der nächste Schritt
          </div>
        </header>

        <div style={{ maxWidth: "640px" }}>
          <div
            className="wpf-stamp"
            style={{
              color: "var(--wpf-honey)",
              fontSize: "11px",
              marginBottom: "32px",
            }}
          >
            Wenn du willst, ich bin da
          </div>
          <h2
            className="wpf-editorial wpf-no-orphan"
            style={{
              fontSize: "84px",
              lineHeight: "0.94",
              color: "var(--wpf-paper)",
              letterSpacing: "-0.025em",
              marginBottom: "32px",
            }}
          >
            Drei Hebel. Ein Konzept.{" "}
            <em
              className="wpf-editorial-italic"
              style={{ color: "var(--wpf-honey)" }}
            >
              Dein
            </em>{" "}
            Start.
          </h2>
          <p
            className="wpf-body"
            style={{
              fontSize: "16px",
              lineHeight: "1.6",
              color: "rgba(243,236,224,0.78)",
              maxWidth: "520px",
            }}
          >
            Wenn dieses Heft dich an einem Punkt erwischt hat — und du wirklich
            anfangen willst — dann brauchst du keine weitere Erklärung mehr. Du
            brauchst einen Anfang. Die WPF-App, in der ich alles gebündelt
            habe, ist eine Möglichkeit. Aber sie ist nicht die einzige. Das
            Wichtigste ist: heute, nicht morgen.
          </p>
        </div>

        <footer
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "32px",
            alignItems: "end",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              ...bg(IMG.avatar, "center"),
              border: "1px solid rgba(243,236,224,0.3)",
            }}
          />
          <div>
            <div
              className="wpf-editorial-italic"
              style={{
                fontSize: "44px",
                color: "var(--wpf-honey)",
                lineHeight: "1",
                marginBottom: "8px",
              }}
            >
              Dein Christian.
            </div>
            <div
              className="wpf-stamp"
              style={{
                fontSize: "10px",
                color: "rgba(243,236,224,0.55)",
              }}
            >
              @christianwolf · Edition № 01
            </div>
          </div>
          <div
            className="wpf-stamp"
            style={{
              fontSize: "10px",
              color: "rgba(243,236,224,0.55)",
              textAlign: "right",
            }}
          >
            12 / 12<br />
            <span style={{ fontStyle: "italic" }}>— Fin —</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
