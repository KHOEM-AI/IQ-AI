import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity,
  AlertCircle,
  Check,
  CircleHelp,
  Expand,
  Info,
  Maximize2,
  MonitorPlay,
  Pause,
  Play,
  Radio,
  RotateCw,
  Satellite,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type HlsLike = {
  loadSource: (source: string) => void;
  attachMedia: (media: HTMLVideoElement) => void;
  destroy: () => void;
  on: (event: string, callback: (event: string, data?: { fatal?: boolean }) => void) => void;
};

type HlsConstructor = {
  new (config?: Record<string, unknown>): HlsLike;
  isSupported: () => boolean;
  Events: { MANIFEST_PARSED: string; ERROR: string };
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
  }
}

type ChannelId = 'cnn' | 'bbc' | 'france24' | 'nhk' | 'explore';
type StatusKey = 'offline' | 'connecting' | 'buffering' | 'live' | 'blocked' | 'reconnecting' | 'error';

type SavedState = {
  channel: ChannelId | '';
  volume: number;
  brightness: number;
  rotation: number;
};

type Channel = {
  id: ChannelId;
  short: string;
  name: string;
  origin: string;
  region: string;
  /** Official YouTube channel ID for a broadcaster that streams live 24/7
   *  and allows embedding. When set, we show their official YouTube
   *  embedded player instead of pulling any stream URL ourselves. */
  youtubeChannelId?: string;
  /** True when this channel has no verified official live source yet and
   *  is only wired to a public HLS test/demo stream. The UI must make this
   *  obvious so nobody mistakes the demo feed for the real broadcaster. */
  isTest?: boolean;
};

const STREAM_URL = 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';
const STORAGE_KEY = 'tvai_state';
const DEFAULT_STATE: SavedState = { channel: 'cnn', volume: 50, brightness: 80, rotation: 0 };
const CHANNELS: Channel[] = [
  { id: 'cnn', short: 'CNN', name: 'CNN International', origin: 'United States', region: 'US', isTest: true },
  { id: 'bbc', short: 'BBC', name: 'BBC News', origin: 'United Kingdom', region: 'UK', isTest: true },
  { id: 'france24', short: 'F24', name: 'France 24', origin: 'France', region: 'FR', youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { id: 'nhk', short: 'NHK', name: 'NHK World', origin: 'Japan', region: 'JP', youtubeChannelId: 'UCSPEjw8F2nQDtmUKPFNF7_A' },
  { id: 'explore', short: 'NAT', name: 'Explore Live Nature Cams', origin: 'Explore.org (non-profit)', region: 'US', youtubeChannelId: 'UC-2KSeUU5SMCX6XLRD-AEvw' },
];

type PartnerType = 'strategic' | 'sponsor' | 'technology' | 'media' | 'community';
type PartnerStatus = 'draft' | 'pending' | 'active' | 'paused' | 'expired' | 'archived';

type Partner = {
  id: string;
  type: PartnerType;
  label: string;
  icon: string;
  description: string;
  /** null means no live link yet — the UI must show "Coming soon", never a dead "#" link. */
  link: string | null;
  status: PartnerStatus;
};

// Data-driven partnership desk. Nothing here is a real partner yet — every
// entry is a reserved, clearly-labelled placeholder. When a real partner
// signs on, only this array needs to change (description/link/status),
// never the rendering logic below.
const PARTNERS: Partner[] = [
  { id: 'strategic-1', type: 'strategic', label: 'Strategic Partner', icon: '🤝', description: 'For organizations and companies who want to collaborate.', link: null, status: 'draft' },
  { id: 'sponsor-1', type: 'sponsor', label: 'Official Sponsor', icon: '⭐', description: 'A reserved space for future sponsors.', link: null, status: 'draft' },
  { id: 'technology-1', type: 'technology', label: 'Technology Partner', icon: '💡', description: 'AI, cloud, and streaming technology collaboration.', link: null, status: 'draft' },
  { id: 'media-1', type: 'media', label: 'Media Partner', icon: '🌍', description: 'Collaboration on news and content.', link: null, status: 'draft' },
  { id: 'community-1', type: 'community', label: 'Community Supporter', icon: '❤️', description: 'For everyone who believes in this project.', link: null, status: 'draft' },
];

const TICKER_TEXT =
  'Thank you for watching KHOEM_AI TV International • Voluntary support is warmly welcomed, any amount helps us grow • Wishing you and your family peace, health and happiness • Happy New Year • Happy Lunar New Year • Enjoy your weekend and safe travels wherever you go';

const STATUS_COPY: Record<StatusKey, { label: string; tone: string; title: string; detail: string }> = {
  offline: { label: 'Offline', tone: 'status-offline', title: 'Ready when you are', detail: 'Select a channel to open the live window.' },
  connecting: { label: 'Connecting', tone: 'status-connecting', title: 'Finding the signal', detail: 'The broadcast desk is opening a secure stream.' },
  buffering: { label: 'Buffering', tone: 'status-buffering', title: 'A moment for the signal', detail: 'We are gathering enough stream to play smoothly.' },
  live: { label: 'Live', tone: 'status-live', title: '', detail: '' },
  blocked: { label: 'Play needed', tone: 'status-blocked', title: 'Your browser paused autoplay', detail: 'Press play to start this broadcast. This is normal on many phones.' },
  reconnecting: { label: 'Reconnecting', tone: 'status-reconnecting', title: 'The signal slipped away', detail: 'Trying to reconnect automatically.' },
  error: { label: 'Unavailable', tone: 'status-error', title: 'This signal is unavailable', detail: 'Try reconnecting, or choose another international channel.' },
};

function readSavedState(): SavedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<SavedState>;
    const channel = CHANNELS.some((item) => item.id === parsed.channel) ? parsed.channel as ChannelId : DEFAULT_STATE.channel;
    return {
      channel,
      volume: typeof parsed.volume === 'number' ? Math.min(100, Math.max(0, parsed.volume)) : DEFAULT_STATE.volume,
      brightness: typeof parsed.brightness === 'number' ? Math.min(100, Math.max(0, parsed.brightness)) : DEFAULT_STATE.brightness,
      rotation: typeof parsed.rotation === 'number' ? ((parsed.rotation % 360) + 360) % 360 : DEFAULT_STATE.rotation,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function loadHls(): Promise<HlsConstructor | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);
  const existing = document.querySelector<HTMLScriptElement>('script[data-tvai-hls]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(window.Hls ?? null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.async = true;
    script.dataset.tvaiHls = 'true';
    script.onload = () => resolve(window.Hls ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function AppButton({
  children,
  className = '',
  onClick,
  testId,
  title,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
  testId: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tv-btn ${className}`}
      onClick={onClick}
      data-testid={testId}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Home() {
  const [saved, setSaved] = useState<SavedState>(() => readSavedState());
  const [status, setStatus] = useState<StatusKey>(saved.channel ? 'connecting' : 'offline');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sponsorSlotHidden, setSponsorSlotHidden] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('tvai_sponsor_hidden') === '1'
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  const channel = useMemo(() => CHANNELS.find((item) => item.id === saved.channel), [saved.channel]);
  const statusMeta = STATUS_COPY[status];

  const saveState = useCallback((next: SavedState) => {
    setSaved(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !saved.channel) return;
    video.play()
      .then(() => setIsPlaying(true))
      .catch(() => setStatus('blocked'));
  }, [saved.channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadStart = () => setStatus('connecting');
    const onWaiting = () => setStatus('buffering');
    const onPlaying = () => {
      setStatus('live');
      setIsPlaying(true);
      reconnectAttempts.current = 0;
    };
    const onPause = () => setIsPlaying(false);
    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = saved.volume / 100;
    video.muted = saved.volume === 0;
    screenRef.current?.style.setProperty('--tv-brightness', `${saved.brightness}%`);
  }, [saved.volume, saved.brightness]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  // Phase 2 — TV remote / keyboard navigation across the channel list.
  // Arrow keys move native focus between channel cards, Enter/OK activates
  // the focused channel, and Escape/Back clears focus so the remote's
  // "back" button feels natural on a TV.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.tv-channel-card'));
      if (cards.length === 0) return;
      const activeIndex = cards.findIndex((card) => card === document.activeElement);

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        const nextIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % cards.length;
        cards[nextIndex].focus();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const prevIndex = activeIndex === -1 ? 0 : (activeIndex - 1 + cards.length) % cards.length;
        cards[prevIndex].focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (activeIndex !== -1) {
          event.preventDefault();
          cards[activeIndex].click();
        }
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: HlsLike | null = null;
    let timer: number | undefined;
    let cancelled = false;

    const reconnect = () => {
      if (cancelled) return;
      if (reconnectAttempts.current < 3) {
        reconnectAttempts.current += 1;
        setStatus('reconnecting');
        timer = window.setTimeout(() => {
          setReconnectNonce((value) => value + 1);
        }, 2600);
      } else {
        setStatus('error');
      }
    };

    const connect = async () => {
      if (!saved.channel || channel?.youtubeChannelId) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        setIsPlaying(false);
        setStatus('offline');
        return;
      }
      setStatus('connecting');
      setIsPlaying(false);
      video.pause();
      video.removeAttribute('src');
      video.load();

      const Hls = await loadHls();
      if (cancelled) return;
      if (Hls?.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) attemptPlay();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) reconnect();
        });
        hls.loadSource(STREAM_URL);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        const onMetadata = () => {
          if (!cancelled) attemptPlay();
        };
        video.addEventListener('loadedmetadata', onMetadata, { once: true });
        video.src = STREAM_URL;
        video.load();
      } else {
        setStatus('error');
      }
    };

    const onVideoError = () => reconnect();
    video.addEventListener('error', onVideoError);
    void connect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      video.removeEventListener('error', onVideoError);
      hls?.destroy();
    };
  }, [attemptPlay, reconnectNonce, saved.channel, channel?.youtubeChannelId]);

  const updateSaved = (patch: Partial<SavedState>) => saveState({ ...saved, ...patch });
  const togglePlayback = () => {
    if (!videoRef.current || !saved.channel) return;
    if (videoRef.current.paused) attemptPlay();
    else videoRef.current.pause();
  };
  const rotate = () => updateSaved({ rotation: (saved.rotation + 90) % 360 });
  const toggleFullscreen = async () => {
    if (!screenRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await screenRef.current.requestFullscreen?.();
  };
  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSaved({ ...DEFAULT_STATE, channel: '' });
    reconnectAttempts.current = 0;
    setStatus('offline');
    if (document.fullscreenElement) void document.exitFullscreen?.();
  };
  const chooseChannel = (id: ChannelId) => {
    reconnectAttempts.current = 0;
    updateSaved({ channel: id });
  };
  const rotationClass = saved.rotation === 90 ? 'is-rotated' : saved.rotation === 180 ? 'is-rotated-180' : saved.rotation === 270 ? 'is-rotated-270' : '';
  const volumeIcon = saved.volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />;

  return (
    <main className="tv-app">
      <div className="tv-shell">
        <header className="tv-header">
          <div className="tv-brand" data-testid="display-brand">
            <div className="tv-brand-mark" aria-hidden="true"><Radio size={18} strokeWidth={1.7} /></div>
            <div>
              <div className="tv-brand-name">TV AI KHOEM-Ai</div>
              <div className="tv-brand-sub">ស្ថានីយ៍ព័ត៌មានសម្រាប់គ្រួសារ · FAMILY NEWS DESK</div>
            </div>
          </div>
          <div className="tv-header-right">
            <div className="tv-clock" data-testid="display-clock">
              <strong>{new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</strong>
              Phnom Penh / local time
            </div>
            <div className="tv-live-pill"><span className="tv-live-dot" /> Desk online</div>
          </div>
        </header>

        <div className="tv-ticker" data-testid="display-ticker" aria-label="Announcements">
          <div className="tv-ticker-track">
            <span>{TICKER_TEXT}</span>
            <span aria-hidden="true">{TICKER_TEXT}</span>
          </div>
        </div>

        <section className="tv-intro">
          <div>
            <div className="tv-eyebrow">A quiet window to the world · ព័ត៌មានពីពិភពលោក</div>
            <h1>International news,<br /><em>without the noise.</em></h1>
            <p>សូមស្វាគមន៍ — ជ្រើសរើសស្ថានីយ៍មួយ ដើម្បីមើលព័ត៌មានផ្សាយផ្ទាល់ ពីកន្លែងតែមួយដែលងាយស្រួលសម្រាប់គ្រួសារ។</p>
          </div>
          <div className="tv-intro-note" data-testid="display-note">
            <strong>One desk. Four signals.</strong>
            A calm, simple way to keep the world in view.
          </div>
        </section>

        <section className="tv-layout" aria-label="Live television control room">
          <div className="tv-panel tv-monitor-panel">
            <div className="tv-monitor-top">
              <div className="tv-monitor-title"><MonitorPlay size={16} color="hsl(var(--primary))" /> Live window <small>{channel?.region ?? 'STANDBY'} / 01</small></div>
              <div className={`tv-status-pill ${statusMeta.tone}`} data-testid="status-connection"><span className="tv-live-dot" /> {statusMeta.label}</div>
            </div>
            <div
              className={`tv-screen ${status === 'connecting' || status === 'buffering' || status === 'reconnecting' ? 'is-loading' : ''}`}
              ref={screenRef}
              data-testid="display-live-screen"
            >
              {channel?.youtubeChannelId ? (
                <iframe
                  className={`tv-video tv-youtube-embed ${rotationClass}`}
                  src={`https://www.youtube.com/embed/live_stream?channel=${channel.youtubeChannelId}&autoplay=1&mute=${saved.volume === 0 ? 1 : 0}`}
                  title={`${channel.name} — official live stream`}
                  data-testid="video-player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder={0}
                />
              ) : (
                <video
                  ref={videoRef}
                  className={`tv-video ${rotationClass}`}
                  playsInline
                  muted={saved.volume === 0}
                  aria-label={channel ? `${channel.name} live video` : 'Live video standby'}
                  data-testid="video-player"
                />
              )}
              {!channel?.youtubeChannelId && (
                <div className="tv-screen-status">
                  <span className={`tv-status-pill ${statusMeta.tone}`}><span className="tv-live-dot" /> {statusMeta.label}</span>
                </div>
              )}
              {!channel?.youtubeChannelId && status !== 'live' && (
                <div className="tv-screen-center" data-testid="display-stream-message">
                  <div className="tv-signal-icon">
                    {status === 'error' ? <AlertCircle size={22} /> : status === 'offline' ? <Satellite size={22} /> : status === 'blocked' ? <Play size={21} fill="currentColor" /> : <Activity size={22} />}
                  </div>
                  <h2>{status === 'offline' ? statusMeta.title : channel ? `${channel.name}` : statusMeta.title}</h2>
                  <p>{status === 'offline' ? statusMeta.detail : statusMeta.detail}</p>
                  {status === 'blocked' && <AppButton className="primary" onClick={attemptPlay} testId="button-play-stream"><Play size={14} fill="currentColor" /> Play broadcast</AppButton>}
                  {status === 'error' && <AppButton className="primary" onClick={() => { reconnectAttempts.current = 0; setReconnectNonce((value) => value + 1); }} testId="button-reconnect-inline"><RotateCw size={14} /> Try again</AppButton>}
                </div>
              )}
              {!channel?.youtubeChannelId && status === 'live' && (
                <button className="tv-sr-only" onClick={togglePlayback} data-testid="button-video-toggle" aria-label={isPlaying ? 'Pause broadcast' : 'Play broadcast'}>{isPlaying ? 'Pause' : 'Play'}</button>
              )}
              {channel?.youtubeChannelId && (
                <div className="tv-screen-status">
                  <span className="tv-status-pill status-live"><span className="tv-live-dot" /> Official YouTube live</span>
                </div>
              )}
            </div>
            <div className="tv-screen-actions">
              <AppButton className="primary" onClick={togglePlayback} testId="button-play-toggle" title={isPlaying ? 'Pause broadcast' : 'Play broadcast'} disabled={Boolean(channel?.youtubeChannelId)}>
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />} {channel?.youtubeChannelId ? 'Use player controls' : isPlaying ? 'Pause' : 'Play'}
              </AppButton>
              <AppButton onClick={rotate} testId="button-rotate" title="Rotate video 90 degrees"><RotateCw size={14} /> Rotate</AppButton>
              <AppButton onClick={toggleFullscreen} testId="button-fullscreen" title={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}>
                {isFullscreen ? <X size={14} /> : <Maximize2 size={14} />} {isFullscreen ? 'Exit' : 'Fullscreen'}
              </AppButton>
              <div className="tv-actions-spacer" />
              <AppButton onClick={() => { reconnectAttempts.current = 0; setReconnectNonce((value) => value + 1); }} testId="button-reconnect" title="Reconnect to the current stream"><Wifi size={14} /> Reconnect</AppButton>
            </div>
            <div className="tv-monitor-foot" data-testid="display-stream-footnote">
              <Check size={13} />{' '}
              {channel
                ? `${channel.name} · ${channel.origin}`
                : 'Choose a channel to begin'}{' '}
              <span>•</span>{' '}
              {channel?.youtubeChannelId
                ? 'Official YouTube live embed — all rights with the broadcaster'
                : channel?.isTest
                  ? 'Demo/test signal — not an official live feed from this broadcaster'
                  : 'HLS adaptive stream'}
            </div>
          </div>

          <aside className="tv-side">
            <div className="tv-panel tv-side-panel">
              <div className="tv-side-heading">
                <h2>Choose a channel</h2>
                <span>{CHANNELS.length} AVAILABLE</span>
              </div>
              <label className="tv-sr-only" htmlFor="channelSelect">Choose an international channel</label>
              <select
                id="channelSelect"
                className="tv-channel-select"
                value={saved.channel}
                onChange={(event) => { if (event.target.value) chooseChannel(event.target.value as ChannelId); }}
                data-testid="select-channel"
              >
                <option value="">Select a channel...</option>
                {CHANNELS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.region}</option>)}
              </select>
              <div className="tv-channel-list">
                {CHANNELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`tv-channel-card ${saved.channel === item.id ? 'active' : ''}`}
                    onClick={() => chooseChannel(item.id)}
                    aria-pressed={saved.channel === item.id}
                    data-testid={`button-channel-${item.id}`}
                  >
                    <span className="tv-channel-mark">{item.short}</span>
                    <span className="tv-channel-copy">
                      <strong>
                        {item.name}
                        {item.isTest ? <em className="tv-test-badge">TEST</em> : null}
                        {item.youtubeChannelId ? <em className="tv-trust-badge">OFFICIAL</em> : null}
                      </strong>
                      <span>{item.isTest ? `${item.origin} · demo signal, not the live broadcast` : item.origin}</span>
                    </span>
                    <span className={`tv-channel-live ${saved.channel === item.id ? '' : 'off'}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="tv-panel tv-utility-panel">
              <div className="tv-side-heading"><h2>Picture & sound</h2><Settings2 size={15} color="hsl(var(--muted-foreground))" /></div>
              <div className="tv-control-block">
                <div className="tv-control-label"><span>{volumeIcon} <span style={{ marginLeft: 7 }}>Volume</span></span><output data-testid="value-volume">{saved.volume}%</output></div>
                <input className="tv-range" style={{ '--range': `${saved.volume}%` } as CSSProperties} type="range" min="0" max="100" value={saved.volume} onChange={(event) => updateSaved({ volume: Number(event.target.value) })} aria-label="Volume" data-testid="input-volume" />
              </div>
              <div className="tv-control-block">
                <div className="tv-control-label"><span><SlidersHorizontal size={14} /> <span style={{ marginLeft: 7 }}>Brightness</span></span><output data-testid="value-brightness">{saved.brightness}%</output></div>
                <input className="tv-range" style={{ '--range': `${saved.brightness}%` } as CSSProperties} type="range" min="20" max="100" value={saved.brightness} onChange={(event) => updateSaved({ brightness: Number(event.target.value) })} aria-label="Brightness" data-testid="input-brightness" />
              </div>
              <div className="tv-utility-divider" />
              <div className="tv-secondary-actions">
                <AppButton onClick={rotate} testId="button-rotate-secondary"><RotateCw size={13} /> Rotate</AppButton>
                <AppButton onClick={toggleFullscreen} testId="button-expand"><Expand size={13} /> Expand</AppButton>
              </div>
              <AppButton className="tv-reset danger" onClick={reset} testId="button-reset"><RotateCw size={13} /> Reset settings</AppButton>
            </div>

            <div className="tv-help" data-testid="display-help">
              <CircleHelp size={15} />
              <span><strong>Need a hand?</strong><br />If a stream pauses, tap Reconnect. Some phones ask you to press Play once before sound begins.</span>
            </div>
          </aside>
        </section>

        <footer className="tv-footer">
          <span>TV AI KHOEM-Ai / BROADCAST DESK 01</span>
          <span><Info size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Streams use the supplied HLS test signal · Player falls back to native Safari HLS</span>
        </footer>

        {!sponsorSlotHidden && (
          <section className="tv-partnership-desk" aria-label="Partnership and support desk" data-testid="display-sponsor-slot">
            <div className="tv-partnership-head">
              <div>
                <div className="tv-partnership-eyebrow">SUPPORT &amp; PARTNERSHIP</div>
                <h2>Help us build a better international family media platform.</h2>
              </div>
              <AppButton
                testId="button-sponsor-hide"
                onClick={() => {
                  setSponsorSlotHidden(true);
                  window.localStorage.setItem('tvai_sponsor_hidden', '1');
                }}
              >
                Hide
              </AppButton>
            </div>

            <div className="tv-partnership-grid">
              {PARTNERS.map((partner) => (
                <div key={partner.id} className="tv-partnership-card" data-testid={`card-partner-${partner.id}`}>
                  <span className="tv-partnership-icon" aria-hidden="true">{partner.icon}</span>
                  <strong>{partner.label}</strong>
                  <span>{partner.description}</span>
                  <span className="tv-partnership-status">{partner.link ? <a href={partner.link}>Visit</a> : 'Coming soon'}</span>
                </div>
              ))}
            </div>

            <div className="tv-partnership-foot">
              <span>Interested in supporting KHOEM_AI TV?</span>
              <div className="tv-partnership-actions">
                <Link href="/partner">
                  <AppButton testId="button-become-partner" onClick={() => {}}>Become a Partner</AppButton>
                </Link>
                <AppButton testId="button-contact-us" onClick={() => {}} disabled>Contact</AppButton>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PartnerPage() {
  return (
    <main className="tv-app">
      <div className="tv-shell">
        <header className="tv-header">
          <div className="tv-brand" data-testid="display-brand">
            <div className="tv-brand-mark" aria-hidden="true"><Radio size={18} strokeWidth={1.7} /></div>
            <div>
              <div className="tv-brand-name">TV AI KHOEM-Ai</div>
              <div className="tv-brand-sub">Partnership &amp; Support</div>
            </div>
          </div>
          <Link href="/">
            <AppButton testId="button-back-to-tv" onClick={() => {}}><X size={14} /> Back to TV</AppButton>
          </Link>
        </header>

        <section className="tv-partner-page">
          <div className="tv-eyebrow">SUPPORT &amp; PARTNERSHIP</div>
          <h1>Why partner with KHOEM_AI TV?</h1>
          <p>
            KHOEM_AI TV is an independent, family-run international news desk. We only use official,
            openly embeddable sources and we never claim ownership of a broadcaster&rsquo;s content. If your
            organization shares that spirit, we&rsquo;d welcome the conversation.
          </p>

          <div className="tv-partner-types">
            {PARTNERS.map((partner) => (
              <div key={partner.id} className="tv-partner-type-card">
                <span className="tv-partnership-icon" aria-hidden="true">{partner.icon}</span>
                <strong>{partner.label}</strong>
                <span>{partner.description}</span>
              </div>
            ))}
          </div>

          <div className="tv-partner-contact">
            <h2>Get in touch</h2>
            <p>This project does not yet have a public contact channel configured. Check back soon.</p>
          </div>
        </section>

        <footer className="tv-footer">
          <span>TV AI KHOEM-Ai / BROADCAST DESK 01</span>
        </footer>
      </div>
    </main>
  );
}

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/partner" component={PartnerPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
