import { useEffect, useRef, useState } from "react";
import { Captions, Home, Maximize, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

export default function MediaPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { await video.play(); setPlaying(true); } else { video.pause(); setPlaying(false); }
  };
  const seek = (seconds: number) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 99, videoRef.current.currentTime + seconds)); };
  const fullScreen = () => void playerRef.current?.requestFullscreen?.();

  return (
    <div className="media-module">
      <header className="module-heading module-heading--compact"><div><p className="workspace-kicker">WATCH & LISTEN</p><h1>Media</h1><p>Large controls. No precision timeline dragging.</p></div><div className="module-heading__state"><Captions aria-hidden="true" /><span>CAPTIONS</span><strong>{captions ? "ON" : "OFF"}</strong></div></header>
      <section ref={playerRef} className="media-stage">
        <div className="media-screen">
          <video ref={videoRef} src="/demo/flower.mp4" playsInline loop onTimeUpdate={(event) => { const video = event.currentTarget; setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0); }} onEnded={() => setPlaying(false)} />
          <div className="media-screen__shade" />
          <div className="media-screen__title"><span>CALM NATURE · DEMO MEDIA</span><h2>A quiet moment in motion</h2></div>
          {captions && <div className="media-caption">A flower moves gently in the light.</div>}
          {!playing && <button type="button" className="media-center-play" onClick={togglePlay} aria-label="Play video"><Play aria-hidden="true" /></button>}
          <div className="media-progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="media-controls" aria-label="Media controls">
          <MediaControl id="media-home" label="Access Hub" icon={Home} onClick={() => navigate("/hub")} />
          <MediaControl id="media-back-10" label="Back 10 seconds" icon={SkipBack} onClick={() => seek(-10)} />
          <MediaControl id="media-back-30" label="Back 30 seconds" icon={SkipBack} onClick={() => seek(-30)} />
          <MediaControl id="media-play" label={playing ? "Pause" : "Play"} icon={playing ? Pause : Play} onClick={togglePlay} primary />
          <MediaControl id="media-forward-10" label="Forward 10 seconds" icon={SkipForward} onClick={() => seek(10)} />
          <MediaControl id="media-forward-30" label="Forward 30 seconds" icon={SkipForward} onClick={() => seek(30)} />
          <MediaControl id="media-restart" label="Restart" icon={RotateCcw} onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} />
          <MediaControl id="media-volume-down" label="Volume down" icon={Volume1} onClick={() => setVolume((value) => Math.max(0, value - 0.1))} />
          <MediaControl id="media-volume-up" label="Volume up" icon={Volume2} onClick={() => setVolume((value) => Math.min(1, value + 0.1))} />
          <MediaControl id="media-mute" label={muted ? "Unmute" : "Mute"} icon={muted ? VolumeX : Volume2} onClick={() => setMuted((value) => !value)} active={muted} />
          <MediaControl id="media-captions" label="Toggle captions" icon={Captions} onClick={() => setCaptions((value) => !value)} active={captions} />
          <MediaControl id="media-fullscreen" label="Full screen" icon={Maximize} onClick={fullScreen} />
        </div>
        <div className="media-volume"><Volume1 aria-hidden="true" /><span><i style={{ width: `${muted ? 0 : volume * 100}%` }} /></span><Volume2 aria-hidden="true" /></div>
      </section>
    </div>
  );
}

function MediaControl({ id, label, icon: Icon, onClick, primary = false, active = false }: { id: string; label: string; icon: typeof Play; onClick: () => void | Promise<void>; primary?: boolean; active?: boolean }) {
  return <AssistiveTarget targetId={id} label={label} tone={primary ? "cyan" : active ? "mint" : "neutral"} className={`${primary ? "is-primary" : ""} ${active ? "is-active" : ""}`} onClick={onClick} dwellMs={primary ? 850 : 1050}><Icon aria-hidden="true" /><span>{label}</span></AssistiveTarget>;
}
