import type { Metadata } from "next";
import Countdown from "./Countdown";

export const metadata: Metadata = {
  title: "Cuenta regresiva | Diego Salazar",
  description: "La cuenta está corriendo. Nos vemos el 28 de noviembre a las 7:00 p. m., hora de Lima.",
};

export default function CountdownPage() {
  return <Countdown />;
}
