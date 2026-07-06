import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyakutō Studio",
  description: "Content authoring for Hyakutō games — dev-only CMS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="flex items-center gap-6 border-b border-edge px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-wide text-gold">
            百灯 · HYAKUTŌ STUDIO
          </Link>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
