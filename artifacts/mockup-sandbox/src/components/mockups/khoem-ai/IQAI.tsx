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
  id: string;
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
  { id: "electronics", icon: Cpu, color: "#f2bd66", lessons: 18, level: "Beginner", progress: 42 },
  { id: "motorcycle", icon: Wrench, color: "#66e2dc", lessons: 22, level: "Practical", progress: 18 },
  { id: "automotive", icon: Zap, color: "#9aa9ee", lessons: 24, level: "Intermediate", progress: 8 },
  { id: "phones", icon: Smartphone, color: "#d29feb", lessons: 16, level: "Practical", progress: 31 },
  { id: "cooling", icon: Snowflake, color: "#71c895", lessons: 20, level: "Practical", progress: 0 },
  { id: "agriculture", icon: Tractor, color: "#e2a783", lessons: 14, level: "Field work", progress: 0 },
];

const courseNames: Record<string, Record<Language, string>> = {
  electronics: { KH: "អេឡិចត្រូនិក និងសៀគ្វី", EN: "Electronics & Circuits", ZH: "电子与电路" },
  motorcycle: { KH: "ម៉ូតូ និងមេកានិច", EN: "Motorcycle Mechanics", ZH: "摩托车机械" },
  automotive: { KH: "រថយន្ត និងប្រព័ន្ធម៉ាស៊ីន", EN: "Automotive Systems", ZH: "汽车系统" },
  phones: { KH: "ទូរសព្ទ និង Smart Devices", EN: "Phones & Smart Devices", ZH: "手机与智能设备" },
  cooling: { KH: "ទូទឹកកក និងម៉ាស៊ីនត្រជាក់", EN: "Cooling & Air Conditioning", ZH: "制冷与空调" },
  agriculture: { KH: "កសិកម្ម និងឧបករណ៍", EN: "Agriculture & Equipment", ZH: "农业与设备" },
};

const copy = {
  KH: {
    title: "មហាវិទ្យាល័យជំនាញជាក់ស្តែង",
    subtitle: "រៀនចាប់ពីមូលដ្ឋាន រហូតដល់ជំនាញដែលអាចយកទៅធ្វើការបាន",
    next: "ជំហានរៀនបន្ទាប់",
    tracks: "ផ្លូវសិក្សា ៦ ផ្នែក",
    certificates: "វិញ្ញាបនបត្ររបស់អ្នក",
    free: "បើករៀនដោយសេរី",
    freeSub: "រៀនតាមទូរសព្ទ · Khmer-first · offline-friendly",
    search: "ស្វែងរកវគ្គសិក្សា ឧបករណ៍ ឬបញ្ហាខូច…",
    begin: "ចាប់ផ្តើមរៀន",
    learning: "កំពុងរៀន",
    pathLabel: "YOUR LEARNING PATH / 2026",
    heroLine1: "ជំនាញសម្រាប់",
    heroLine2: "ជីវិតពិត និងការងារពិត",
    heroBody: "ពីសៀគ្វីតូចមួយ រហូតដល់ម៉ាស៊ីនធំមួយ។ រៀនដោយមើល ធ្វើ និងយល់ជាមួយគ្រូ AI។",
    totalProgress: "សរុបការរៀន",
    nextLesson: "អានតម្លៃ Resistance និង Voltage",
    minutes: "18 នាទី · 1 lesson",
    selectedPath: "SELECTED PATH",
    selectedDesc: "វគ្គសិក្សាដែលសមនឹងជំហានបន្ទាប់របស់អ្នក",
    seeAll: "មើលទាំងអស់",
    openLibrary: "បើកឃ្លាំង",
    footer: "មេរៀនត្រូវបានរៀបចំសម្រាប់សិស្សគ្រប់ទីកន្លែង និងអាចបន្ថែមភាសា/ជំនាញថ្មីបាននៅពេលក្រោយ។",
  },
  EN: {
    title: "Practical Skills Academy",
    subtitle: "Learn from first principles to skills you can use for real work",
    next: "Your next step",
    tracks: "Six learning tracks",
    certificates: "Your certificates",
    free: "Open learning",
    freeSub: "Learn on your phone · Khmer-first · offline-friendly",
    search: "Search courses, tools, or repair problems…",
    begin: "Start learning",
    learning: "In progress",
    pathLabel: "YOUR LEARNING PATH / 2026",
    heroLine1: "Skills for",
    heroLine2: "real life and real work",
    heroBody: "From a small circuit to a big machine. Learn by watching, doing, and understanding with an AI tutor.",
    totalProgress: "Total progress",
    nextLesson: "Read about Resistance and Voltage",
    minutes: "18 min · 1 lesson",
    selectedPath: "SELECTED PATH",
    selectedDesc: "A course that fits your next step",
    seeAll: "See all",
    openLibrary: "Open library",
    footer: "Lessons are designed for learners everywhere, with more languages and skills added later.",
  },
  ZH: {
    title: "实用技能学院",
    subtitle: "从基础开始，学习能够应用于真实工作的技能",
    next: "下一步学习",
    tracks: "六个学习方向",
    certificates: "你的证书",
    free: "开放学习",
    freeSub: "手机学习 · 高棉语优先 · 支持离线",
    search: "搜索课程、工具或故障问题…",
    begin: "开始学习",
    learning: "学习中",
    pathLabel: "你的学习路径 / 2026",
    heroLine1: "面向",
    heroLine2: "真实生活与真实工作的技能",
    heroBody: "从一个小电路到一台大机器。通过观看、动手实践和AI导师讲解来学习。",
    totalProgress: "总进度",
    nextLesson: "阅读电阻与电压",
    minutes: "18 分钟 · 1 节课",
    selectedPath: "已选路径",
    selectedDesc: "适合你下一步学习的课程",
    seeAll: "查看全部",
    openLibrary: "打开证书库",
    footer: "课程为各地学习者设计，未来会加入更多语言和技能。",
  },
} as const;

export function IQAI() {
  const [language, setLanguage] = useState<Language>("KH");
  const [selectedCourse, setSelectedCourse] = useState(courses[0].id);
  const [query, setQuery] = useState("");
  const [started, setStarted] = useState(false);
  const t = copy[language];
  const selected = courses.find((course) => course.id === selectedCourse) ?? courses[0];
  const visibleCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => {
      const names = courseNames[course.id];
      return `${names.KH} ${names.EN} ${names.ZH}`.toLowerCase().includes(normalized);
    });
  }, [query]);

  return (
    <AppShell active="iqai" title={t.title} subtitle={t.subtitle} eyebrow="IQ-AI · GLOBAL TECHNICAL ACADEMY">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#66e2dc]/15 bg-[#0d1e2a]/80 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#66e2dc]/10 text-[#66e2dc]"><GraduationCap size={20} /></span>
          <div><p className="text-xs font-semibold text-[#e7f2f1]">{t.free}</p><p className="text-[10px] text-[#8caab7]">{t.freeSub}</p></div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#8caab7]/15 bg-[#07131d] p-1">
          {languages.map((item) => <button key={item.id} onClick={() => setLanguage(item.id)} className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${language === item.id ? "bg-[#66e2dc] font-semibold text-[#07131d]" : "text-[#8caab7] hover:bg-white/5"}`}>{item.label}</button>)}
        </div>
      </div>

      <section className="kh-card kh-grid p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="kh-eyebrow mb-3">{t.pathLabel}</p><h2 className="kh-display max-w-xl text-2xl font-semibold tracking-tight text-[#e7f2f1] md:text-4xl">{t.heroLine1}<br /><span className="text-[#66e2dc]">{t.heroLine2}</span></h2><p className="mt-3 max-w-lg text-xs leading-6 text-[#8caab7]">{t.heroBody}</p></div>
          <div className="min-w-[110px] text-right"><p className="text-3xl font-semibold text-[#f2bd66]">27%</p><p className="text-[10px] text-[#7897a2]">{t.totalProgress}</p></div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#183442]"><div className="h-full w-[27%] rounded-full bg-gradient-to-r from-[#66e2dc] to-[#f2bd66]" /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7897a2]"><span>{t.next}: {t.nextLesson}</span><span>{t.minutes}</span></div>
      </section>

      <section className="mt-7">
        <SectionLabel action={t.seeAll}>{t.tracks}</SectionLabel>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#8caab7]/15 bg-[#0d1e2a]/70 px-3"><Search size={16} className="text-[#66e2dc]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent py-3 text-xs text-[#e7f2f1] outline-none placeholder:text-[#62838a]" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map(({ id, icon: Icon, color, lessons, level, progress }) => {
            const names = courseNames[id];
            return (
              <button key={id} onClick={() => { setSelectedCourse(id); setStarted(false); }} className={`kh-button kh-card-soft group p-4 text-left ${selectedCourse === id ? "border-[#66e2dc]/50 bg-[#66e2dc]/[.07]" : "hover:border-white/20"}`}>
                <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ color, backgroundColor: `${color}16` }}><Icon size={20} /></span><span className="text-[10px] text-[#7897a2]">{progress}%</span></div>
                <span className="mt-4 block text-xs font-semibold text-[#d9e8e7]">{names[language]}</span>
                {language !== "EN" && <span className="mt-1 block text-[10px] text-[#7897a2]">{names.EN}</span>}
                <div className="mt-4 flex items-center justify-between text-[9px] text-[#6f8f98]"><span>{lessons} lessons</span><span>{level}</span></div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#183442]"><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} /></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kh-card-soft mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f2bd66]/10 text-[#f2bd66]"><BookOpen size={21} /></div>
        <div className="flex-1"><p className="text-[10px] uppercase tracking-[.14em] text-[#f2bd66]">{t.selectedPath}</p><h3 className="mt-1 text-sm font-semibold text-[#e7f2f1]">{courseNames[selected.id][language]}</h3><p className="mt-1 text-[10px] text-[#7897a2]">{courseNames[selected.id].EN} · {t.selectedDesc}</p></div>
        <button onClick={() => setStarted(true)} className="kh-button flex items-center justify-center gap-2 rounded-xl bg-[#66e2dc] px-4 py-2.5 text-[11px] font-semibold text-[#07131d]">{started ? <><Check size={14} /> {t.learning}</> : <>{t.begin} <ArrowRight size={14} /></>}</button>
      </section>

      <section className="mt-7">
        <SectionLabel action={t.openLibrary}>{t.certificates}</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ label: "Web Development", value: "12 / 18" }, { label: "AI Foundations", value: "8 / 12" }, { label: "Electronics", value: "6 / 14" }, { label: "Coming next", value: "29 certificates" }].map((item, index) => <div key={item.label} className="kh-card-soft p-3"><div className="mb-3 flex items-center justify-between"><Award size={17} className={index === 3 ? "text-[#7897a2]" : "text-[#f2bd66]"} /><ChevronRight size={13} className="text-[#5c7d85]" /></div><p className="text-[10px] font-semibold text-[#d9e8e7]">{item.label}</p><p className="mt-1 text-[10px] text-[#7897a2]">{item.value}</p></div>)}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 border-t border-[#8caab7]/10 pt-4 text-[10px] leading-5 text-[#7897a2]"><Globe2 size={14} className="shrink-0 text-[#66e2dc]" /> {t.footer}</div>
    </AppShell>
  );
}
