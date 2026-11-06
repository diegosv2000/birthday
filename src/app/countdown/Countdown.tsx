"use client";

import { Fragment, useEffect, useState } from "react";
import { CONFIG } from "@/lib/constants";
import styles from "./countdown.module.css";

const deadline = Date.parse(CONFIG.fechaHoraISO);
const units = [
  { label: "DÍAS", seconds: 86400, modulo: Infinity, code: "DD" },
  { label: "HORAS", seconds: 3600, modulo: 24, code: "HH" },
  { label: "MINUTOS", seconds: 60, modulo: 60, code: "MM" },
  { label: "SEGUNDOS", seconds: 1, modulo: 60, code: "SS" },
];

export default function Countdown() {
  // A stable first render avoids a stale prerendered clock and hydration differences.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) clearInterval(interval);
      return seconds;
    };

    const synchronize = () => {
      clearInterval(interval);
      if (!document.hidden && tick() > 0) {
        interval = setInterval(tick, 1000);
      }
    };

    synchronize();
    document.addEventListener("visibilitychange", synchronize);
    window.addEventListener("pageshow", synchronize);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", synchronize);
      window.removeEventListener("pageshow", synchronize);
    };
  }, []);

  const values = units.map((unit) => (
    remaining === null
      ? "--"
      : String(Math.floor(remaining / unit.seconds) % unit.modulo).padStart(2, "0")
  ));
  const timerLabel = remaining === null
    ? "Sincronizando cuenta regresiva"
    : `Tiempo restante: ${values.map((value, index) => `${value} ${units[index].label.toLowerCase()}`).join(", ")}`;

  return (
    <main className={styles.page}>
      <div
        className={styles.timer}
        role="timer"
        aria-live="off"
        aria-label={timerLabel}
        aria-busy={remaining === null}
      >
        {units.map((unit, index) => (
          <Fragment key={unit.code}>
            {index > 0 && <span className={styles.separator} aria-hidden="true">:</span>}
            <span className={styles.unit} aria-hidden="true">
              <span className={styles.frame} />
              <span className={styles.number}>
                {values[index]}
                <span className={styles.ghostCyan}>{values[index]}</span>
                <span className={styles.ghostPink}>{values[index]}</span>
              </span>
            </span>
          </Fragment>
        ))}
      </div>
    </main>
  );
}
