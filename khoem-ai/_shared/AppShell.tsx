import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, Command, Home, Menu, Settings2, Sparkles, UserRound, X } from "lucide-react";
import "../_group.css";

export type SystemKey = "master" | "ai" | "ki" | "mik" | "eit" | "iqai" | "ioai";

const destinations: Array<{ key: SystemKey; label: string; khmer: string; path: string }> = [
  { key: "master", label: "Master", khmer: "មជ្ឈមណ្ឌល", path: "Master" },
  { key: "ai", label: "AI", khmer: "កូដ", path: "AI" },
  { key: "ki", label: "KI", khmer: "រូបភាព", path: "KI" },
  { key: "mik", label: "MI-K", khmer: "ជួសជុល", path: "MIK" },
  { key: "eit", label: "EI-T", khmer: "បច្ចេកវិទ្យា", path: "EIT" },
  { key: "iqai", label: "IQ-AI", khmer: "សាលារៀន", path: "IQAI" },
  { key: "ioai", label: "IO-AI", khmer: "កន្លែងខ្ញុំ", path: "IOAI" },
];

export function goTo(system: SystemKey) {
  const destination = destinations.find((item) => item.key === system);
  if (destination) window.location.href = `/__mockup/preview/khoem-ai/${destination.path}`;
}

function StatusDot({ tone = "cyan" }: { tone?: "cyan" | "gold" | "red" }) {
  const colors = { cyan: "bg-[#66e2dc]", gold: "bg-[#f2bd66]", red: "bg-[#f18181]" };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[tone]} kh-pulse shadow-[0_0_12px_currentColor]`} />;
}

export function AppShell({ active, title, subtitle, children, eyebrow = "PERSONAL INTELLIGENCE SYSTEM" }: { active: SystemKey; title: string; subtitle?: string; children: ReactNode; eyebrow?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="khoem-root">
      <div className="khoem-shell">
        <header className="sticky top-0 z-30 border-b border-[var(--kh-line)] bg-[#07131d]/90 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="kh-main flex items-center justify-between gap-3">
            <button onClick={() => goTo("master")} className="kh-button flex items-center gap-2 text-left" aria-label="KHOEM-AI home">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#66e2dc]/30 bg-[#66e2dc]/10 text-[#66e2dc]"><Command size={18} /></span>
              <span><span className="block kh-display text-[15px] font-bold tracking-[.16em] text-[#e7f2f1]">KHOEM<span className="text-[#f2bd66]">-AI</span></span><span className="hidden text-[9px] tracking-[.12em] text-[#8caab7] sm:block">LEARN · BUILD · REPAIR</span></span>
            </button>
            <div className="hidden items-center gap-4 md:flex"><span className="flex items-center gap-2 text-[11px] text-[#8caab7]"><StatusDot />Vault synced</span><span className="h-4 w-px bg-[var(--kh-line)]" /><span className="text-[11px] text-[#8caab7]">ថ្ងៃច័ន្ទ · 08:42</span></div>
            <div className="flex items-center gap-1">
              <button className="kh-button grid h-9 w-9 place-items-center rounded-xl text-[#8caab7] hover:bg-white/5"><Bell size={17} /></button>
              <button onClick={() => setMenuOpen((value) => !value)} className="kh-button grid h-9 w-9 place-items-center rounded-xl border border-[var(--kh-line)] bg-[#0d1e2a] text-[#66e2dc] md:hidden">{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
              <button className="hidden h-9 w-9 place-items-center rounded-xl border border-[var(--kh-line)] bg-[#0d1e2a] text-[#8caab7] md:grid"><UserRound size={16} /></button>
            </div>
          </div>
          {menuOpen && <nav className="kh-main mt-3 grid grid-cols-2 gap-2 border-t border-[var(--kh-line)] pt-3 md:hidden">{destinations.map((item) => <button key={item.key} onClick={() => goTo(item.key)} className={`rounded-xl px-3 py-2 text-left text-xs ${active === item.key ? "bg-[#66e2dc]/10 text-[#66e2dc]" : "bg-white/[.03] text-[#8caab7]"}`}><span className="block font-semibold">{item.label}</span><span className="text-[10px] opacity-70">{item.khmer}</span></button>)}</nav>}
        </header>
        <main className="kh-main px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-9">
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="kh-eyebrow mb-2">{eyebrow}</p><h1 className="kh-display text-2xl font-semibold tracking-tight text-[#e7f2f1] md:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-[#8caab7]">{subtitle}</p>}</div><button className="hidden rounded-xl border border-[var(--kh-line)] p-2.5 text-[#8caab7] hover:bg-white/5 md:block"><Settings2 size={17} /></button></div>
          {children}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--kh-line)] bg-[#07131d]/95 px-2 py-2 backdrop-blur-xl md:hidden"><div className="flex items-center justify-around">{destinations.slice(0, 5).map((item) => <button key={item.key} onClick={() => goTo(item.key)} className={`flex min-w-[48px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] ${active === item.key ? "bg-[#66e2dc]/10 text-[#66e2dc]" : "text-[#6f8c98]"}`}><span className="text-xs">{item.key === "master" ? <Home size={16} /> : item.key === "ai" ? <Sparkles size={16} /> : item.key === "ki" ? <span>◎</span> : item.key === "mik" ? <span>⌁</span> : <span>◈</span>}</span>{item.label}</button>)}</div></nav>
      </div>
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-semibold tracking-[.12em] text-[#8caab7]">{children}</h2>{action && <button className="flex items-center gap-1 text-[11px] text-[#66e2dc]">{action}<ChevronRight size={13} /></button>}</div>;
}

export { StatusDot };