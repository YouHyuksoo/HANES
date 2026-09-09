"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { TourModeContext } from "@/hooks/useTourMode";

function storageKey(email: string, company: string, plant: string) {
  return `hanes:tour-mode:${email}:${company}:${plant}`;
}

export default function TourModeProvider({ children }: { children: ReactNode }) {
  const { user, selectedCompany, selectedPlant } = useAuthStore();
  const [enabled, setEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const email = user?.email ?? "";
  const key = email && selectedCompany && selectedPlant ? storageKey(email, selectedCompany, selectedPlant) : null;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!key) {
      setEnabledState(false);
      return;
    }
    setEnabledState(window.localStorage.getItem(key) === "1");
  }, [key]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    if (key) window.localStorage.setItem(key, next ? "1" : "0");
  }, [key]);
  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);
  const value = useMemo(() => ({ enabled: hydrated && enabled, setEnabled, toggle }), [enabled, hydrated, setEnabled, toggle]);

  return <TourModeContext.Provider value={value}>{children}</TourModeContext.Provider>;
}
