import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Centro",
  description: "Tareas, proyectos, presupuesto y gastos en un solo lugar.",
  applicationName: "Mi Centro",
  appleWebApp: { capable: true, title: "Mi Centro", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
