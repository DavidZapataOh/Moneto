import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

// Persistimos solo la preferencia del user. Default "system" → respeta el OS
// hasta que el user elige manualmente.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (p) => set({ preference: p }),
    }),
    {
      name: "moneto.theme",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
