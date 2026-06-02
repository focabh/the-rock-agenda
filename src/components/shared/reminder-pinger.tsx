"use client";

import { useEffect } from "react";

/** Dispara a verificação de cobranças de presença 1x por sessão (oportunista). */
export function ReminderPinger() {
  useEffect(() => {
    if (sessionStorage.getItem("rem-ping") === "1") return;
    sessionStorage.setItem("rem-ping", "1");
    fetch("/api/reminders/run", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
