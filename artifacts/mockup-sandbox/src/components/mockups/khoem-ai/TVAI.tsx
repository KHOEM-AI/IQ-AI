import { useMemo, useState, type FormEvent } from "react";
import {
  BellRing,
  Check,
  ChevronRight,
  CircleHelp,
  Fullscreen,
  Headphones,
  MapPin,
  MonitorCog,
  Play,
  Plus,
  RefreshCw,
  Rotate3D,
  Search,
  Send,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  SunMedium,
  Tv2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import "./_group.css";

type ChannelCategory = "national" | "province";
type Filter = "all" | ChannelCategory;

type Channel = {
  id: string;
  short: string;
  khmer: string;
  english: string;
  province: string;
  category: ChannelCategory;
  status: "unverified" | "preparing";
};

const initialChannels: Channel[] = [
  { id: "tvk", short: "TVK", khmer: "ទូរទស្សន៍ជាតិកម្ពុជា", english: "National Television of Cambodia", province: "ជាតិ", category: "national", status: "unverified" },
  { id: "cnc", short: "CNC", khmer: "Cambodia News Channel", english: "Cambodia News Channel", province: "ជាតិ", category: "national", status: "unverified" },
  { id: "pnn", short: "PNN", khmer: "PNN Cambodia", english: "PNN Cambodia", province: "ជាតិ", category: "national", status: "unverified" },
  { id: "bayon", short: "Bayon TV", khmer: "បាយ័ន TV", english: "Bayon Television", province: "ជាតិ", category: "national", status: "preparing" },
  { id: "hang-meas", short: "Hang Meas", khmer: "ហង្សមាស HDTV", english: "Hang Meas HDTV", province: "ជាតិ", category: "national", status: "preparing" },
  { id: "btv", short: "BTV", khmer: "Battambang TV", english: "Battambang TV", province: "បាត់ដំបង", category: "province", status: "preparing" },
  { id: "sr-tv", short: "SR TV", khmer: "Siem Reap TV", english: "Siem Reap TV", province: "សៀមរាប", category: "province", status: "unverified" },
  { id: "kpt-tv", short: "KPT TV", khmer: "Kampong Thom TV", english: "Kampong Thom TV", province: "កំពង់ធំ", category: "province", status: "preparing" },
  { id: "kpc-tv", short: "KPC TV", khmer: "Kampong Cham TV", english: "Kampong Cham TV", province: "កំពង់ចាម", category: "province", status: "preparing" },
  { id: "kps-tv", short: "KPS TV", khmer: "Kampong Speu TV", english: "Kampong Speu TV", province: "កំពង់ស្ពឺ", category: "province", status: "preparing" },
  { id: "krt-tv", short: "KRT TV", khmer: "Kratie TV", english: "Kratie TV", province: "ក្រចេះ", category: "province", status: "unverified" },
  { id: "kkg-tv", short: "KKG TV", khmer: "Koh Kong TV", english: "Koh Kong TV", province: "កោះកុង", category: "province", status: "preparing" },
  { id: "kpt-tv2", short: "KPT TV2", khmer: "Kampot TV", english: "Kampot TV", province: "កំពត", category: "province", status: "unverified" },
  { id: "srk-tv", short: "SRK TV", khmer: "Preah Sihanouk TV", english: "Preah Sihanouk TV", province: "ព្រះសីហនុ", category: "province", status: "preparing" },
];

const statusCopy: Record<Channel["status"], string> = {
  unverified: "តំណភ្ជាប់មិនទាន់បានបញ្ជាក់",
  preparing: "កំពុងរៀបចំ",
};

function ChannelMark({ short, selected }: { short: string; selected: boolean }) {
  return (
    <span className={`kh-channel-mark ${selected ? "is-selected" : ""}`}>
      <span className="kh-mark-orbit" />
      <span>{short.slice(0, 3)}</span>
    </span>
  );
}

function Meter({
  icon: Icon,
  label,
  value,
  muted,
  onClick,
}: {
  icon: typeof Volume2;
  label: string;
  value: number;
  muted: boolean;
  onClick: () => void;
}) {
  return (
    <button className="kh-meter kh-button" type="button" onClick={onClick} aria-label={`${label}: ${value}%`}>
      <span className="kh-meter-icon">{muted ? <VolumeX size={16} /> : <Icon size={16} />}</span>
      <span className="kh-meter-copy">
        <span className="kh-meter-label">{label}</span>
        <span className="kh-meter-track"><span style={{ width: `${muted ? 0 : value}%` }} /></span>
      </span>
      <strong>{muted ? "OFF" : `${value}%`}</strong>
    </button>
  );
}

export function TVAI() {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [selectedId, setSelectedId] = useState("tvk");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(62);
  const [brightness, setBrightness] = useState(78);
  const [isRotated, setIsRotated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [notice, setNotice] = useState("ប្រភពផ្លូវការនឹងត្រូវបានភ្ជាប់នៅពេលក្រោយ");
  const [newChannel, setNewChannel] = useState({ short: "", khmer: "", english: "", province: "" });

  const selected = channels.find((channel) => channel.id === selectedId) ?? channels[0];

  const visibleChannels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesFilter = filter === "all" || channel.category === filter;
      const matchesQuery =
        !normalized ||
        [channel.short, channel.khmer, channel.english, channel.province]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [channels, filter, query]);

  const chooseChannel = (id: string) => {
    setSelectedId(id);
    setIsPreviewing(false);
    setNotice("ប្រភពផ្លូវការនឹងត្រូវបានភ្ជាប់នៅពេលក្រោយ");
  };

  const handleReconnect = () => {
    setIsReconnecting(true);
    setNotice("កំពុងពិនិត្យស្ថានភាពប្រភព…");
    window.setTimeout(() => {
      setIsReconnecting(false);
      setNotice("មិនទាន់មានប្រភពដែលបានបញ្ជាក់ទេ — អាចភ្ជាប់នៅពេលក្រោយ");
    }, 900);
  };

  const handleAddChannel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const short = newChannel.short.trim().toUpperCase();
    const khmer = newChannel.khmer.trim();
    const english = newChannel.english.trim();
    const province = newChannel.province.trim();
    if (!short || !khmer || !english || !province) return;
    const id = `${short.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const added: Channel = { id, short, khmer, english, province, category: "province", status: "preparing" };
    setChannels((current) => [...current, added]);
    setSelectedId(id);
    setFilter("all");
    setQuery("");
    setNewChannel({ short: "", khmer: "", english: "", province: "" });
    setShowAdd(false);
    setNotice("ប៉ុស្តិ៍ថ្មីត្រូវបានបន្ថែមក្នុងបញ្ជីរៀបចំ");
  };

  return (
    <main className={`khoem-root khoem-shell ${isFullscreen ? "kh-fullscreen" : ""}`}>
      <div className="kh-main kh-page">
        <header className="kh-topbar">
          <div className="kh-brand">
            <div className="kh-brand-seal"><Tv2 size={20} strokeWidth={1.8} /><span /></div>
            <div>
              <div className="kh-brand-name kh-display">KHOEM-AI</div>
              <div className="kh-brand-sub">TV desk · Khmer-first family media</div>
            </div>
          </div>
          <div className="kh-top-actions">
            <span className="kh-time">ភ្នំពេញ · 20:48</span>
            <button className="kh-icon-button kh-button" type="button" aria-label="ជំនួយ"><CircleHelp size={18} /></button>
            <button className="kh-icon-button kh-button" type="button" aria-label="ការជូនដំណឹង"><BellRing size={18} /></button>
          </div>
        </header>

        <section className="kh-intro">
          <div>
            <div className="kh-eyebrow">BROADCAST CONTROL ROOM / 01</div>
            <h1>មើលព័ត៌មានពី<br /><span>គ្រប់ខេត្តកម្ពុជា</span></h1>
            <p>បញ្ជីប៉ុស្តិ៍ដែលបានរៀបចំសម្រាប់គ្រួសារ។ ប្រភពទាំងនេះមិនទាន់បើកជាវីដេអូបន្តផ្ទាល់នៅឡើយទេ។</p>
          </div>
          <div className="kh-roster-count"><strong>{channels.length}</strong><span>ប៉ុស្តិ៍<br />ក្នុងបញ្ជី</span></div>
        </section>

        <section className="kh-player-layout">
          <div className={`kh-player kh-card ${isRotated ? "is-rotated" : ""}`}>
            <div className="kh-player-head">
              <div className="kh-player-channel">
                <ChannelMark short={selected.short} selected />
                <div>
                  <span className="kh-player-kicker">SELECTED CHANNEL · {selected.province}</span>
                  <h2>{selected.khmer}</h2>
                  <p>{selected.english}</p>
                </div>
              </div>
              <div className="kh-ready-pill"><i /> READY <span>ត្រៀម</span></div>
            </div>
            <div className="kh-screen kh-grid">
              <div className="kh-screen-corner kh-screen-corner-tl" />
              <div className="kh-screen-corner kh-screen-corner-br" />
              <div className="kh-scanline" />
              <div className="kh-screen-center">
                <div className="kh-signal-disc"><Signal size={28} /><span /><span /><span /></div>
                <span className="kh-screen-overline">SOURCE SLOT · {selected.short}</span>
                <strong>ប្រភពត្រូវការការបញ្ជាក់</strong>
                <p>{isPreviewing ? "នេះជាស៊ុមត្រៀម មិនមែនជាវីដេអូបន្តផ្ទាល់ទេ" : notice}</p>
                <button className="kh-play-button kh-button" type="button" onClick={() => { setIsPreviewing(true); setNotice("ស៊ុមត្រៀមរួច — រង់ចាំប្រភពដែលបានបញ្ជាក់"); }}>
                  <Play size={17} fill="currentColor" /> {isPreviewing ? "READY FRAME" : "បើកស៊ុមត្រៀម"}
                </button>
              </div>
              <div className="kh-screen-foot"><span><span className="kh-dot" /> {isPreviewing ? "READY / LOCAL PREVIEW" : "STANDBY / NO FEED"}</span><span>16:9 · HD</span></div>
            </div>
            <div className="kh-player-note"><ShieldCheck size={15} /><span>យើងនឹងបង្ហាញតែប្រភពដែលអាចផ្ទៀងផ្ទាត់បាន</span><span className="kh-note-line" /></div>
          </div>

          <aside className="kh-control-stack">
            <div className="kh-control-head"><span className="kh-eyebrow">DESK CONTROLS</span><MonitorCog size={17} /></div>
            <Meter icon={Volume2} label="សំឡេង / Volume" value={volume} muted={isMuted} onClick={() => { if (isMuted) setIsMuted(false); else setIsMuted(true); }} />
            <Meter icon={SunMedium} label="ពន្លឺ / Brightness" value={brightness} muted={false} onClick={() => setBrightness((current) => current > 40 ? 28 : 78)} />
            <div className="kh-control-row">
              <button className={`kh-control-button kh-button ${isRotated ? "is-on" : ""}`} type="button" onClick={() => setIsRotated((current) => !current)}><Rotate3D size={17} /><span>បង្វិល</span><small>{isRotated ? "ON" : "OFF"}</small></button>
              <button className={`kh-control-button kh-button ${isFullscreen ? "is-on" : ""}`} type="button" onClick={() => setIsFullscreen((current) => !current)}><Fullscreen size={17} /><span>ពេញអេក្រង់</span><small>{isFullscreen ? "ON" : "OFF"}</small></button>
            </div>
            <button className="kh-reconnect kh-button" type="button" onClick={handleReconnect} disabled={isReconnecting}>
              <RefreshCw size={16} className={isReconnecting ? "kh-spin" : ""} /> {isReconnecting ? "កំពុងពិនិត្យ…" : "ពិនិត្យការតភ្ជាប់ឡើងវិញ"}
            </button>
            <div className="kh-control-caption"><span className="kh-live-dot" /> local controls only <span>·</span> no external stream</div>
          </aside>
        </section>

        <section className="kh-roster-section">
          <div className="kh-section-head">
            <div>
              <div className="kh-eyebrow">CHANNEL ROSTER / {String(channels.length).padStart(2, "0")}</div>
              <h2>ជ្រើសរើសប៉ុស្តិ៍</h2>
              <p>ជាតិ និងខេត្ត នៅកន្លែងតែមួយ</p>
            </div>
            <button className="kh-add-button kh-button" type="button" onClick={() => setShowAdd((current) => !current)}>
              {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "បិទ" : "បន្ថែមប៉ុស្តិ៍ខេត្ត"}
            </button>
          </div>

          {showAdd && (
            <form className="kh-add-panel kh-card-soft" onSubmit={handleAddChannel}>
              <div className="kh-add-title"><Plus size={16} /><div><strong>បន្ថែមប៉ុស្តិ៍ខេត្ត</strong><span>រក្សាទុកជាប្រភពដែលកំពុងរៀបចំ</span></div></div>
              <div className="kh-form-grid">
                <label><span>កូដ</span><input value={newChannel.short} onChange={(event) => setNewChannel({ ...newChannel, short: event.target.value })} placeholder="ឧ. KDL TV" /></label>
                <label><span>ខេត្ត</span><input value={newChannel.province} onChange={(event) => setNewChannel({ ...newChannel, province: event.target.value })} placeholder="ឧ. កណ្តាល" /></label>
                <label><span>ឈ្មោះខ្មែរ</span><input value={newChannel.khmer} onChange={(event) => setNewChannel({ ...newChannel, khmer: event.target.value })} placeholder="ឈ្មោះប៉ុស្តិ៍" /></label>
                <label><span>English name</span><input value={newChannel.english} onChange={(event) => setNewChannel({ ...newChannel, english: event.target.value })} placeholder="Provincial TV" /></label>
              </div>
              <button className="kh-save-channel kh-button" type="submit"><Check size={15} /> បន្ថែមទៅក្នុងបញ្ជី</button>
            </form>
          )}

          <div className="kh-roster-tools">
            <div className="kh-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ស្វែងរកប៉ុស្តិ៍ ឬ ខេត្ត…" /><kbd>⌘ K</kbd></div>
            <div className="kh-filters">
              {(["all", "national", "province"] as Filter[]).map((item) => (
                <button key={item} className={`kh-filter-button kh-button ${filter === item ? "is-active" : ""}`} type="button" onClick={() => setFilter(item)}>
                  {item === "all" ? "ទាំងអស់" : item === "national" ? "ជាតិ" : "ខេត្ត"}
                  <span>{channels.filter((channel) => item === "all" || channel.category === item).length}</span>
                </button>
              ))}
              <SlidersHorizontal size={16} className="kh-filter-icon" />
            </div>
          </div>

          {visibleChannels.length > 0 ? (
            <div className="kh-channel-grid">
              {visibleChannels.map((channel, index) => {
                const isSelected = channel.id === selectedId;
                return (
                  <button key={channel.id} className={`kh-channel-card kh-button ${isSelected ? "is-selected" : ""}`} type="button" onClick={() => chooseChannel(channel.id)}>
                    <span className="kh-channel-index">{String(index + 1).padStart(2, "0")}</span>
                    <ChannelMark short={channel.short} selected={isSelected} />
                    <span className="kh-channel-info"><strong>{channel.khmer}</strong><span>{channel.english}</span><em><MapPin size={11} /> {channel.province}</em></span>
                    <span className={`kh-channel-status ${channel.status}`}><i />{statusCopy[channel.status]}</span>
                    <ChevronRight size={15} className="kh-card-arrow" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="kh-empty-state kh-card-soft"><Search size={22} /><strong>រកមិនឃើញប៉ុស្តិ៍</strong><span>សាកល្បងស្វែងរកដោយប្រើឈ្មោះប៉ុស្តិ៍ ឬ ខេត្តផ្សេងទៀត។</span><button className="kh-clear-button kh-button" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>សម្អាតតម្រង</button></div>
          )}
        </section>

        <section className="kh-support kh-card-soft">
          <div className="kh-support-icon"><Headphones size={20} /></div>
          <div className="kh-support-copy"><span className="kh-eyebrow">KEEP THE SIGNAL KIND</span><h2>ជួយឲ្យបញ្ជីនេះកាន់តែមានប្រយោជន៍</h2><p>ស្គាល់ប៉ុស្តិ៍ខេត្តដែលគួរបន្ថែម? ផ្ញើព័ត៌មានមកក្រុម KHOEM-AI ដើម្បីពិនិត្យប្រភព។</p></div>
          <button className="kh-support-action kh-button" type="button" onClick={() => setNotice("អរគុណ — ក្រុមការងារនឹងទាក់ទងតាមព័ត៌មានដែលបានផ្ញើ")}><Send size={16} /> ផ្ញើព័ត៌មាន <ChevronRight size={15} /></button>
        </section>

        <footer className="kh-footer"><span><span className="kh-footer-mark" /> KHOEM-AI / TV desk</span><span>ប្រភពដែលទុកចិត្តបាន សម្រាប់គ្រួសារ</span><span className="kh-footer-links">Support <span>·</span> Partnership <span>·</span> v0.8</span></footer>
      </div>
    </main>
  );
}
