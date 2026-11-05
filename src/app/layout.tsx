import type { Metadata, Viewport } from "next";
import { CONFIG } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: CONFIG.copy.title,
  description:
    "Algo ha pasado. Entra al enlace y descúbrelo.",
};

export const viewport: Viewport = {
  themeColor: "#04141a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body data-stage="boot">{children}</body>
    </html>
  );
}
