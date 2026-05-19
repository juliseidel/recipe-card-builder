import type { Metadata } from "next";
import {
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
  Fraunces,
} from "next/font/google";
import "./manifest.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const interTight = Inter_Tight({
  variable: "--font-body-tight",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-stamp",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces-accent",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "WPF — Das Manifest · Christian Wolf",
  description:
    "Editorial-Méthode-Buch zum Wolf-Protein-Fasting-Konzept. Preview-Mockup.",
};

export default function WpfManifestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${instrumentSerif.variable} ${interTight.variable} ${jetbrainsMono.variable} ${fraunces.variable} wpf-root`}
    >
      {children}
    </div>
  );
}
