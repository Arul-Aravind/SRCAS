import { useEffect, useRef, useState } from "react";
import { AlignJustify, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp, Focus, Home, Minus, Pause, Play, Plus, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";
import { getReadingEdgeScrollVelocity, getReadingHeadScrollVelocity } from "@/lib/readingEdgeScroll";

const article = [
  "Technology works best when it adapts to people",
  "Most digital tools begin with an assumption: someone will point, click, tap, drag, or type. Those actions feel invisible when they are easy, but the interface can become a barrier when precise hand movement is limited, painful, tiring, or unavailable.",
  "An adaptive interface starts somewhere else. It asks what movement is comfortable, learns the range, and maps that signal to the task. The person does not need to imitate an ideal posture or force a movement that is difficult. The system changes its response instead.",
  "This principle extends beyond accessibility. Captions, voice control, larger type, reduced motion, and clear language often begin as accommodations and become better ways for many people to use technology. A flexible interface creates more paths to the same outcome.",
  "LuminaXR explores that idea through head movement. A webcam estimates orientation, calibration defines a personal neutral position, and motion filtering creates a controlled pointer. Selection happens only after the signal remains stable long enough to communicate intent.",
  "The important shift is not the cursor itself. It is the idea that access can be built around the movement a person controls, with enough feedback to remain understandable and enough forgiveness to recover from mistakes.",
];

export default function ReaderPage() {
  const navigate = useNavigate();
  const { calibration, cursor, mode, paused, preferences, speak, status, telemetry } = useLumina();
  const readingRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(cursor);
  const headScrollRef = useRef({
    pitch: telemetry.pitch,
    neutralPitch: calibration.source === "camera" ? calibration.neutralPose.pitch : 0,
    upRange: calibration.source === "camera" ? calibration.upRange : 18,
    downRange: calibration.source === "camera" ? calibration.downRange : 18,
    invertVertical: preferences.invertVertical,
  });
  const gazeEdgeRef = useRef<"up" | "down" | null>(null);
  const [fontSize, setFontSize] = useState(24);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [focusMode, setFocusMode] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paragraph, setParagraph] = useState(0);
  const [gazeEdge, setGazeEdge] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    headScrollRef.current = {
      pitch: telemetry.pitch,
      neutralPitch: calibration.source === "camera" ? calibration.neutralPose.pitch : 0,
      upRange: calibration.source === "camera" ? calibration.upRange : 18,
      downRange: calibration.source === "camera" ? calibration.downRange : 18,
      invertVertical: preferences.invertVertical,
    };
  }, [calibration.downRange, calibration.neutralPose.pitch, calibration.source, calibration.upRange, preferences.invertVertical, telemetry.pitch]);

  useEffect(() => {
    const gazeScrollEnabled = mode === "camera" && status === "active" && !paused;
    if (!gazeScrollEnabled) {
      gazeEdgeRef.current = null;
      setGazeEdge(null);
      return;
    }

    let animationFrame = 0;
    let previousTime = performance.now();

    const updateScroll = (time: number) => {
      const readingSurface = readingRef.current;
      if (!readingSurface) return;

      const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const readingViewport = readingSurface.getBoundingClientRect();
      const cursorVelocity = getReadingEdgeScrollVelocity(cursorRef.current, readingViewport);
      const cursorIsAcrossBook = cursorRef.current.x >= readingViewport.left
        && cursorRef.current.x <= readingViewport.right;
      const headVelocity = cursorIsAcrossBook
        ? getReadingHeadScrollVelocity(headScrollRef.current)
        : 0;
      const velocity = Math.abs(headVelocity) > Math.abs(cursorVelocity) ? headVelocity : cursorVelocity;
      const canScrollUp = velocity < 0 && readingSurface.scrollTop > 0;
      const canScrollDown = velocity > 0
        && readingSurface.scrollTop < readingSurface.scrollHeight - readingSurface.clientHeight - 1;
      const nextEdge = canScrollUp ? "up" : canScrollDown ? "down" : null;

      if (nextEdge) readingSurface.scrollTop += velocity * elapsedSeconds;
      if (gazeEdgeRef.current !== nextEdge) {
        gazeEdgeRef.current = nextEdge;
        setGazeEdge(nextEdge);
      }
      animationFrame = window.requestAnimationFrame(updateScroll);
    };

    animationFrame = window.requestAnimationFrame(updateScroll);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      gazeEdgeRef.current = null;
    };
  }, [mode, paused, status]);

  useEffect(() => {
    if (!autoScroll) return;
    const timer = window.setInterval(() => {
      if (!gazeEdgeRef.current) readingRef.current?.scrollBy({ top: 1.6, behavior: "auto" });
    }, 24);
    return () => window.clearInterval(timer);
  }, [autoScroll]);

  const readAloud = () => {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    speak(article.slice(1).join(" "), true);
    setSpeaking(true);
  };

  const scroll = (direction: -1 | 1) => readingRef.current?.scrollBy({ top: direction * 280, behavior: "smooth" });
  const moveParagraph = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(article.length - 2, paragraph + direction));
    setParagraph(next);
    readingRef.current?.querySelectorAll("p")[next]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className={`reader-module ${focusMode ? "is-focus" : ""} ${contrast ? "is-contrast" : ""}`}>
      <header className="module-heading module-heading--compact">
        <div><p className="workspace-kicker">ACCESSIBLE READER</p><h1>Read</h1><p>Technology that adapts to people</p></div>
        <div className="module-heading__state"><BookOpen aria-hidden="true" /><span>FOCUS</span><strong>{focusMode ? "ON" : "READY"}</strong></div>
      </header>
      <div className="reader-layout">
        <aside className="reader-controls" aria-label="Reading controls">
          <Control id="reader-home" label="Return to Access Hub" icon={Home} onClick={() => navigate("/hub")} />
          <Control id="reader-up" label="Scroll up" icon={ChevronUp} onClick={() => scroll(-1)} />
          <Control id="reader-down" label="Scroll down" icon={ChevronDown} onClick={() => scroll(1)} />
          <Control id="reader-previous" label="Previous paragraph" icon={ArrowLeft} onClick={() => moveParagraph(-1)} />
          <Control id="reader-next" label="Next paragraph" icon={ArrowRight} onClick={() => moveParagraph(1)} />
          <Control id="reader-larger" label="Increase text size" icon={Plus} onClick={() => setFontSize((size) => Math.min(38, size + 2))} />
          <Control id="reader-smaller" label="Decrease text size" icon={Minus} onClick={() => setFontSize((size) => Math.max(18, size - 2))} />
          <Control id="reader-spacing" label="Change line spacing" icon={AlignJustify} onClick={() => setLineHeight((value) => value >= 2 ? 1.55 : value + 0.2)} />
          <Control id="reader-focus" label="Toggle focus mode" icon={Focus} onClick={() => setFocusMode((value) => !value)} active={focusMode} />
          <Control id="reader-speech" label={speaking ? "Stop reading aloud" : "Read aloud"} icon={speaking ? Pause : Volume2} onClick={readAloud} active={speaking} />
        </aside>
        <section className="reading-surface">
          <div className="reading-surface__tools">
            <span>ARTICLE · 5 MIN</span>
            <button type="button" onClick={() => setContrast((value) => !value)}>Contrast {contrast ? "On" : "Off"}</button>
            <button type="button" onClick={() => setAutoScroll((value) => !value)}>{autoScroll ? <Pause /> : <Play />} Slow scroll</button>
          </div>
          {mode === "camera" && status === "active" && !paused && (
            <>
              <div className={`reading-edge-zone reading-edge-zone--top ${gazeEdge === "up" ? "is-active" : ""}`} aria-hidden="true"><ChevronUp /></div>
              <div className={`reading-edge-zone reading-edge-zone--bottom ${gazeEdge === "down" ? "is-active" : ""}`} aria-hidden="true"><ChevronDown /></div>
            </>
          )}
          <div ref={readingRef} className="reading-copy" style={{ fontSize, lineHeight }}>
            <h2>{article[0]}</h2>
            {article.slice(1).map((copy, index) => (
              <p key={copy} className={paragraph === index ? "is-current" : ""} onClick={() => setParagraph(index)}>{copy}</p>
            ))}
            <footer>End of article · LuminaXR Access demonstration content</footer>
          </div>
          <div className="reader-progress"><span style={{ width: `${((paragraph + 1) / (article.length - 1)) * 100}%` }} /></div>
        </section>
      </div>
    </div>
  );
}

function Control({ id, label, icon: Icon, onClick, active = false }: { id: string; label: string; icon: typeof Home; onClick: () => void; active?: boolean }) {
  return <AssistiveTarget targetId={id} label={label} tone={active ? "cyan" : "neutral"} className={active ? "is-active" : ""} onClick={onClick} dwellMs={900}><Icon aria-hidden="true" /><span>{label}</span></AssistiveTarget>;
}
