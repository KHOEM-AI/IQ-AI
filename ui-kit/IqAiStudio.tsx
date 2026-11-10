// Drop-in IQ-AI panel for the AI UI. Copy to AI/src/components/IqAiStudio.tsx, then add it to the menu (see README).
import { useEffect, useState, type ReactNode } from 'react';
import { iqai, downloadBlob, IqaiError, type Capabilities, type BinaryResult } from '../lib/iqaiClient';

type Tab = 'videoEdit' | 'photo' | 'text' | 'voice' | 'emotion';
const TABS: { id: Tab; label: string; feature: string }[] = [
  { id: 'videoEdit', label: '✂️ កែវីដេអូ', feature: 'videoEdit' },
  { id: 'photo', label: '🖼️ រូប → វីដេអូ', feature: 'videoPhoto' },
  { id: 'text', label: '🔤 អត្ថបទ → វីដេអូ', feature: 'videoText' },
  { id: 'voice', label: '🎙️ ប្តូរសំឡេង', feature: 'audioVoice' },
  { id: 'emotion', label: '🧠 អារម្មណ៍', feature: 'emotion' },
];
const NEEDS: Record<string, string> = {
  ffmpeg: 'pkg install ffmpeg',
  khmerFont: 'ដាក់ NotoSansKhmer-Regular.ttf ហើយកំណត់ KHMER_FONT ក្នុង .env',
};

const box = { padding: 12, borderRadius: 10, border: '1px solid #8884', marginBottom: 10 } as const;
const inp = { padding: 8, borderRadius: 8, border: '1px solid #8886', width: '100%', marginBottom: 6 } as const;
const btn = { padding: '8px 14px', borderRadius: 8, border: 0, background: '#4f46e5', color: '#fff', cursor: 'pointer' } as const;

function useRun() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setErr('');
    try { return await fn(); }
    catch (e) { setErr(e instanceof IqaiError ? `${e.code}: ${e.message}` : String(e)); }
    finally { setBusy(false); }
  };
  return { busy, err, run };
}

const Out = ({ r, kind, name }: { r: BinaryResult | undefined; kind: 'video' | 'audio' | 'image'; name: string }) => !r ? null : (
  <div style={box}>
    {kind === 'video' && <video src={r.url} controls style={{ width: '100%' }} />}
    {kind === 'audio' && <audio src={r.url} controls style={{ width: '100%' }} />}
    {kind === 'image' && <img src={r.url} alt="" style={{ width: '100%' }} />}
    <button style={{ ...btn, marginTop: 6 }} onClick={() => downloadBlob(r, name)}>⬇️ ទាញយក</button>
  </div>
);

function VideoEdit() {
  const { busy, err, run } = useRun();
  const [file, setFile] = useState<File>();
  const [o, setO] = useState({ trimStart: '', trimEnd: '', speed: '1', mute: false });
  const [res, setRes] = useState<{ video?: BinaryResult; thumb?: BinaryResult; audio?: BinaryResult }>({});
  const num = (s: string) => (s === '' ? undefined : Number(s));
  const go = (k: 'video' | 'thumb' | 'audio') => file && run(async () => {
    const r = k === 'video' ? await iqai.videoEdit(file, { trimStart: num(o.trimStart), trimEnd: num(o.trimEnd), speed: num(o.speed), mute: o.mute || undefined })
      : k === 'thumb' ? await iqai.videoThumbnail(file, { at: num(o.trimStart) ?? 0 }) : await iqai.videoAudio(file);
    setRes((p) => ({ ...p, [k]: r }));
  });
  return (<div>
    <input type="file" accept="video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0])} style={inp} />
    <input placeholder="ចាប់ពីវិនាទី (trimStart)" value={o.trimStart} onChange={(e) => setO({ ...o, trimStart: e.target.value })} style={inp} />
    <input placeholder="ដល់វិនាទី (trimEnd)" value={o.trimEnd} onChange={(e) => setO({ ...o, trimEnd: e.target.value })} style={inp} />
    <input placeholder="ល្បឿន (speed)" value={o.speed} onChange={(e) => setO({ ...o, speed: e.target.value })} style={inp} />
    <label><input type="checkbox" checked={o.mute} onChange={(e) => setO({ ...o, mute: e.target.checked })} /> បិទសំឡេង</label>
    <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
      <button style={btn} disabled={!file || busy} onClick={() => go('video')}>កែ</button>
      <button style={btn} disabled={!file || busy} onClick={() => go('thumb')}>Thumbnail</button>
      <button style={btn} disabled={!file || busy} onClick={() => go('audio')}>ដកសំឡេង</button>
    </div>
    {err && <p style={{ color: 'crimson' }}>{err}</p>}
    <Out r={res.video} kind="video" name="edited.mp4" /><Out r={res.thumb} kind="image" name="thumb.jpg" /><Out r={res.audio} kind="audio" name="audio.wav" />
  </div>);
}

function Photo({ caps }: { caps: Capabilities }) {
  const { busy, err, run } = useRun();
  const [file, setFile] = useState<File>();
  const [effect, setEffect] = useState('zoom-in');
  const [dur, setDur] = useState('5');
  const [sfx, setSfx] = useState('');
  const [res, setRes] = useState<BinaryResult>();
  return (<div>
    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} style={inp} />
    <select value={effect} onChange={(e) => setEffect(e.target.value)} style={inp}>{caps.options.photoEffects.map((x) => <option key={x}>{x}</option>)}</select>
    <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="វិនាទី" style={inp} />
    <select value={sfx} onChange={(e) => setSfx(e.target.value)} style={inp}><option value="">គ្មាន sfx</option>{caps.options.sfxTypes.map((x) => <option key={x}>{x}</option>)}</select>
    <button style={btn} disabled={!file || busy} onClick={() => file && run(async () => setRes(await iqai.videoFromPhoto(file, { effect, durationSec: Number(dur), sfx: sfx || undefined })))}>បង្កើត</button>
    {err && <p style={{ color: 'crimson' }}>{err}</p>}<Out r={res} kind="video" name="photo.mp4" />
  </div>);
}

function TextVideo() {
  const { busy, err, run } = useRun();
  const [text, setText] = useState('សួស្តី ពិភពលោក');
  const [res, setRes] = useState<BinaryResult>();
  return (<div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={inp} />
    <button style={btn} disabled={!text || busy} onClick={() => run(async () => setRes(await iqai.videoFromText({ text, durationSec: 5 })))}>បង្កើត</button>
    {err && <p style={{ color: 'crimson' }}>{err}</p>}<Out r={res} kind="video" name="text.mp4" />
  </div>);
}

function Voice({ caps }: { caps: Capabilities }) {
  const { busy, err, run } = useRun();
  const [file, setFile] = useState<File>();
  const [preset, setPreset] = useState('male');
  const [res, setRes] = useState<BinaryResult>();
  return (<div>
    <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0])} style={inp} />
    <select value={preset} onChange={(e) => setPreset(e.target.value)} style={inp}>{caps.options.voicePresets.map((x) => <option key={x}>{x}</option>)}</select>
    <button style={btn} disabled={!file || busy} onClick={() => file && run(async () => setRes(await iqai.changeVoice(file, { preset })))}>ប្តូរសំឡេង</button>
    {err && <p style={{ color: 'crimson' }}>{err}</p>}<Out r={res} kind="audio" name="voice.wav" />
  </div>);
}

function EmotionTab() {
  const { busy, err, run } = useRun();
  const [text, setText] = useState('');
  const [res, setRes] = useState<unknown>();
  return (<div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="វាយអត្ថបទខ្មែរ..." style={inp} />
    <button style={btn} disabled={!text || busy} onClick={() => run(async () => setRes(await iqai.emotion(text)))}>វិភាគ</button>
    {err && <p style={{ color: 'crimson' }}>{err}</p>}
    {res !== undefined && <pre style={box}>{JSON.stringify(res, null, 2)}</pre>}
  </div>);
}

export default function IqAiStudio(): ReactNode {
  const [caps, setCaps] = useState<Capabilities>();
  const [tab, setTab] = useState<Tab>('videoEdit');
  const [error, setError] = useState('');
  useEffect(() => { iqai.capabilities().then(setCaps).catch((e) => setError(e instanceof IqaiError ? `${e.code}: ${e.message}` : 'IQ-AI មិនឆ្លើយតប (ពិនិត្យ ./ai.sh status)')); }, []);
  if (error) return <div style={box}>⚠️ {error}</div>;
  if (!caps) return <div style={box}>កំពុងភ្ជាប់ IQ-AI…</div>;
  const f = caps.features[TABS.find((t) => t.id === tab)!.feature];
  return (<div style={{ maxWidth: 720, margin: '0 auto' }}>
    <h2>🎧 IQ-AI Studio</h2>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} style={{ ...btn, opacity: tab === t.id ? 1 : 0.55 }}>{t.label}</button>)}
    </div>
    {!f.ready ? <div style={box}>មុខងារនេះត្រូវការ៖ {f.needs.map((n) => NEEDS[n] ?? n).join(' · ')}</div> : <>
      {tab === 'videoEdit' && <VideoEdit />}
      {tab === 'photo' && <Photo caps={caps} />}
      {tab === 'text' && <TextVideo />}
      {tab === 'voice' && <Voice caps={caps} />}
      {tab === 'emotion' && <EmotionTab />}
    </>}
  </div>);
}
