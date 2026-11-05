import type { Metadata, Viewport } from "next";
import { CONFIG } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: CONFIG.copy.title,
  description:
    "Una invitación personal al cumpleaños de Diego. Una noche fuera del sistema.",
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
