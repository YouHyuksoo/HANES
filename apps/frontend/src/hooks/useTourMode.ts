"use client";
import { createContext, useContext } from 'react';
export interface TourModeContextValue { enabled: boolean; setEnabled: (enabled: boolean) => void; toggle: () => void; }
export const TourModeContext = createContext<TourModeContextValue | null>(null);
export function useTourMode() {
  return useContext(TourModeContext) ?? { enabled: false, setEnabled: () => undefined, toggle: () => undefined };
}
