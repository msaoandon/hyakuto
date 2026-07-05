import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyakutō Studio",
  description: "Content authoring for Hyakutō — dev-only CMS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-edge px-6 py-3">
          <h1 className="text-sm font-semibold tracking-wide text-gold">百灯 · HYAKUTŌ STUDIO</h1>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
