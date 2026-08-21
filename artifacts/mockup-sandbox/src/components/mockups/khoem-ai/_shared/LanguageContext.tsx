import { createContext, useContext, useState, type ReactNode } from "react";

export type Language = "KH" | "EN" | "ZH";

const order: Language[] = ["KH", "EN", "ZH"];
const labels: Record<Language, string> = { KH: "ខ្មែរ", EN: "EN", ZH: "中文" };

const LanguageContext = createContext<{
  language: Language;
  cycle: () => void;
  label: string;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("KH");
  const cycle = () => setLanguage((current) => order[(order.indexOf(current) + 1) % order.length]);
  return (
    <LanguageContext.Provider value={{ language, cycle, label: labels[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
