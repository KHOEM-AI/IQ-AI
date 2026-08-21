import { useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  Globe2,
  GraduationCap,
  Search,
  Snowflake,
  Smartphone,
  Sparkles,
  Tractor,
  Wrench,
  Zap,
} from "lucide-react";

import { AppShell, SectionLabel } from "./_shared/AppShell";

type Language = "KH" | "EN" | "ZH";
type Course = {
  name: string;
  english: string;
  icon: typeof Cpu;
  color: string;
  lessons: number;
  level: string;
  progress: number;
};

const languages: Array<{ id: Language; label: string }> = [
  { id: "KH", label: "ខ្មែរ" },
  { id: "EN", label: "English" },
  { id: "ZH", label: "中文" },
];

const courses: Course[] = [
  { name: "អេឡិចត្រូនិក និងសៀគ្វី", english: "Electronics & Circuits", icon: Cpu, color: "#f2bd66", lessons: 18, level: "Beginner", progress: 42 },
  { name: "ម៉ូតូ និងមេកានិច", english: "Motorcycle Mechanics", icon: Wrench, color: "#66e2dc", lessons: 22, level: "Practical", progress: 18 },
  { name: "រថយន្ត និងប្រព័ន្ធម៉ាស៊ីន", english: "Automotive Systems", icon: Zap, color: "#9aa9ee", lessons: 24, level: "Intermediate", progress: 8 },
  { name: "ទូរសព្ទ និង Smart Devices", english: "Phones & Smart Devices", icon: Smartphone, color: "#d29feb", lessons: 16, level: "Practical", progress: 31 },
  { name: "ទូទឹកកក និងម៉ាស៊ីនត្រជាក់", english: "Cooling & Air Conditioning", icon: Snowflake, color: "#71c895", lessons: 20, level: "Practical", progress: 0 },
  { name: "កសិកម្ម និងឧបករណ៍", english: "Agriculture & Equipment", icon: Tractor, color: "#e2a783", lessons: 14, level: "Field work", progress: 0 },
];

const copy = {
  KH: {
    title: "មហាវិទ្យាល័យជំនាញជាក់ស្តែង",
    subtitle: "រៀនចាប់ពីមូលដ្ឋាន រហូតដល់ជំនាញដែលអាចយកទៅធ្វើការបាន",
    next: "ជំហានរៀនបន្ទាប់",
    tracks: "ផ្លូវសិក្សា ៦ ផ្នែក",
    certificates: "វិញ្ញាបនបត្ររបស់អ្នក",
    free: "បើករៀនដោយសេរី",
    search: "ស្វែងរកវគ្គសិក្សា ឧបករណ៍ ឬបញ្ហាខូច…",
    begin: "ចាប់ផ្តើមរៀន",
  },
  EN: {
    title: "Practical Skills Academy",
    subtitle: "Learn from first principles to skills you can use for real work",
    next: "Your next step",
    tracks: "Six learning tracks",
    certificates: "Your certificates",
    free: "Open learning",
    search: "Search courses, tools, or repair problems…",
    begin: "Start learning",
  },
  ZH: {
    title: "实用技能学院",
    subtitle: "从基础开始，学习能够应用于真实工作的技能",
    next: "下一步学习",
    tracks: "六个学习方向",
    certificates: "你的证书",
    free: "开放学习",
    search: "搜索课程、工具或故障问题…",
    begin: "开始学习",
  },
} as const;

export function IQAI() {
  const [language, setLanguage] = useState<Language>("KH");
  const [selectedCourse, setSelectedCourse] = useState(courses[0].name);
  const [query, setQuery] = useState("");
  const [started, setStarted] = useState(false);
  const t = copy[language];
  const selected = courses.find((course) => course.name === selectedCourse) ?? courses[0];
  const visibleCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => `${course.name} ${course.english}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <AppShell active="iqai" title={t.title} subtitle={t.subtitle} eyebrow="IQ-AI · GLOBAL TECHNICAL ACADEMY">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#66e2dc]/15 bg-[#0d1e2a]/80 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#66e2dc]/10 text-[#66e2dc]"><GraduationCap size={20} /></span>
          <div><p className="text-xs font-semibold text-[#e7f2f1]">{t.free}</p><p className="text-[10px] text-[#8caab7]">រៀនតាមទូរសព្ទ · Khmer-first · offline-friendly</p></div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#8caab7]/15 bg-[#07131d] p-1">
          {languages.map((item) => <button key={item.id} onClick={() => setLanguage(item.id)} className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${language === item.id ? "bg-[#66e2dc] font-semibold text-[#07131d]" : "text-[#8caab7] hover:bg-white/5"}`}>{item.label}</button>)}
        </div>
      </div>

      <section className="kh-card kh-grid p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="kh-eyebrow mb-3">YOUR LEARNING PATH / 2026</p><h2 className="kh-display max-w-xl text-2xl font-semibold tracking-tight text-[#e7f2f1] md:text-4xl">ជំនាញសម្រាប់<br /><span className="text-[#66e2dc]">ជីវិតពិត និងការងារពិត</span></h2><p className="mt-3 max-w-lg text-xs leading-6 text-[#8caab7]">ពីសៀគ្វីតូចមួយ រហូតដល់ម៉ាស៊ីនធំមួយ។ រៀនដោយមើល ធ្វើ និងយល់ជាមួយគ្រូ AI។</p></div>
          <div className="min-w-[110px] text-right"><p className="text-3xl font-semibold text-[#f2bd66]">27%</p><p className="text-[10px] text-[#7897a2]">សរុបការរៀន</p></div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#183442]"><div className="h-full w-[27%] rounded-full bg-gradient-to-r from-[#66e2dc] to-[#f2bd66]" /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7897a2]"><span>{t.next}: អានតម្លៃ Resistance និង Voltage</span><span>18 នាទី · 1 lesson</span></div>
      </section>

      <section className="mt-7">
        <SectionLabel action="មើលទាំងអស់">{t.tracks}</SectionLabel>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#8caab7]/15 bg-[#0d1e2a]/70 px-3"><Search size={16} className="text-[#66e2dc]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent py-3 text-xs text-[#e7f2f1] outline-none placeholder:text-[#62838a]" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map(({ name, english, icon: Icon, color, lessons, level, progress }) => (
            <button key={name} onClick={() => { setSelectedCourse(name); setStarted(false); }} className={`kh-button kh-card-soft group p-4 text-left ${selectedCourse === name ? "border-[#66e2dc]/50 bg-[#66e2dc]/[.07]" : "hover:border-white/20"}`}>
              <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ color, backgroundColor: `${color}16` }}><Icon size={20} /></span><span className="text-[10px] text-[#7897a2]">{progress}%</span></div>
              <span className="mt-4 block text-xs font-semibold text-[#d9e8e7]">{name}</span><span className="mt-1 block text-[10px] text-[#7897a2]">{english}</span>
              <div className="mt-4 flex items-center justify-between text-[9px] text-[#6f8f98]"><span>{lessons} lessons</span><span>{level}</span></div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#183442]"><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} /></div>
            </button>
          ))}
        </div>
      </section>

      <section className="kh-card-soft mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f2bd66]/10 text-[#f2bd66]"><BookOpen size={21} /></div>
        <div className="flex-1"><p className="text-[10px] uppercase tracking-[.14em] text-[#f2bd66]">SELECTED PATH</p><h3 className="mt-1 text-sm font-semibold text-[#e7f2f1]">{selected.name}</h3><p className="mt-1 text-[10px] text-[#7897a2]">{selected.english} · វគ្គសិក្សាដែលសមនឹងជំហានបន្ទាប់របស់អ្នក</p></div>
        <button onClick={() => setStarted(true)} className="kh-button flex items-center justify-center gap-2 rounded-xl bg-[#66e2dc] px-4 py-2.5 text-[11px] font-semibold text-[#07131d]">{started ? <><Check size={14} /> កំពុងរៀន</> : <>{t.begin} <ArrowRight size={14} /></>}</button>
      </section>

      <section className="mt-7">
        <SectionLabel action="បើកឃ្លាំង">{t.certificates}</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ label: "Web Development", value: "12 / 18" }, { label: "AI Foundations", value: "8 / 12" }, { label: "Electronics", value: "6 / 14" }, { label: "Coming next", value: "29 certificates" }].map((item, index) => <div key={item.label} className="kh-card-soft p-3"><div className="mb-3 flex items-center justify-between"><Award size={17} className={index === 3 ? "text-[#7897a2]" : "text-[#f2bd66]"} /><ChevronRight size={13} className="text-[#5c7d85]" /></div><p className="text-[10px] font-semibold text-[#d9e8e7]">{item.label}</p><p className="mt-1 text-[10px] text-[#7897a2]">{item.value}</p></div>)}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 border-t border-[#8caab7]/10 pt-4 text-[10px] leading-5 text-[#7897a2]"><Globe2 size={14} className="shrink-0 text-[#66e2dc]" /> មេរៀនត្រូវបានរៀបចំសម្រាប់សិស្សគ្រប់ទីកន្លែង និងអាចបន្ថែមភាសា/ជំនាញថ្មីបាននៅពេលក្រោយ។</div>
    </AppShell>
  );
}