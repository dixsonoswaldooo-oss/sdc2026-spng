import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbyte Plug-in",
  description: "Fitur plug-in untuk Orbyte (SDC Hackathon 2026, Domain 2)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
