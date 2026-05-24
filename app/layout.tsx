import type { Metadata } from "next";
import {
  Fraunces,
  Inter,
  Inter_Tight,
  Cormorant_Garamond,
  Libre_Baskerville,
  Calistoga,
  Caveat,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const baskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const calistoga = Calistoga({
  variable: "--font-calistoga",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const caveat = Caveat({
  variable: "--font-script",
  subsets: ["latin"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const fontVariables = [
  fraunces.variable,
  inter.variable,
  interTight.variable,
  cormorant.variable,
  baskerville.variable,
  calistoga.variable,
  caveat.variable,
  mono.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Recipe Card Builder · Bienenfee",
  description:
    "Wunderschöne Recipe-Cards in fünf typografischen Welten — gebaut für @bienesfitlife, Wolf Family Office.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
