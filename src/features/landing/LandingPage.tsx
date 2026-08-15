import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Camera,
  CircleCheck,
  Eye,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  MoveUpRight,
  Orbit,
  PlaySquare,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import heroImage from "@/assets/luminax-head-control.jpg";
import { BrandMark } from "@/components/luminax/BrandMark";
import { ReturnToHubTarget } from "@/components/luminax/ReturnToHubTarget";

const thoughtStages = [
  { number: "01", title: "Camera", copy: "An ordinary webcam observes facial landmarks.", icon: Camera },
  { number: "02", title: "Interpret", copy: "Head pose becomes intentional movement.", icon: ScanFace },
  { number: "03", title: "Stabilize", copy: "Noise and involuntary motion are filtered.", icon: Gauge },
  { number: "04", title: "Acquire", copy: "Nearby targets become easier to reach.", icon: Orbit },
  { number: "05", title: "Dwell", copy: "Progress grows only while movement is stable.", icon: Eye },
  { number: "06", title: "Confirm", copy: "Important actions require a second decision.", icon: ShieldCheck },
];

const modules = [
  { title: "Read", copy: "Distraction-free documents", icon: BookOpen, tone: "cyan" },
  { title: "Watch & listen", copy: "Large, dwell-safe media controls", icon: PlaySquare, tone: "mint" },
  { title: "Communicate", copy: "Fast phrases with optional speech", icon: MessageSquareText, tone: "violet" },
];

export default function LandingPage() {
  const [demoPhase, setDemoPhase] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setDemoPhase((phase) => (phase + 1) % 5), 1150);
    return () => window.clearInterval(timer);
  }, []);

  const moveDemo = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = demoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / rect.width;
    setDemoPhase(x < 0.3 ? 0 : x < 0.5 ? 1 : x < 0.7 ? 2 : x < 0.88 ? 3 : 4);
  };

  return (
    <div className="landing-page">
      <header className="public-nav">
        <BrandMark />
        <nav aria-label="Main navigation">
          <a href="#thinking">How it works</a>
          <a href="#dwell">Intent engine</a>
          <Link to="/privacy">Privacy</Link>
          <Link to="/admin">Admin Login</Link>
        </nav>
        <div className="public-nav__actions">
          <ReturnToHubTarget />
          <Link className="public-nav__start" to="/access">
            Start LuminaXR <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <img src={heroImage} alt="A person using a laptop through head-controlled interaction" />
          <div className="landing-hero__veil" />
          <div className="landing-hero__content">
            <div className="hero-status"><span /> DESIGNED FOR LOCAL PROCESSING</div>
            <h1>Move naturally.<br /><em>Access everything.</em></h1>
            <p>Control digital experiences using comfortable head movement and an ordinary webcam.</p>
            <div className="landing-hero__actions">
              <Link className="primary-command" to="/access">Start LuminaXR <ArrowRight aria-hidden="true" /></Link>
              <a className="text-command" href="#thinking">See how it works <ArrowDown aria-hidden="true" /></a>
            </div>
            <div className="landing-hero__proof">
              <span><Camera aria-hidden="true" /> No specialized hardware</span>
              <span><LockKeyhole aria-hidden="true" /> Camera frames stay in your browser</span>
            </div>
          </div>

          <div
            ref={demoRef}
            className={`hero-signal-demo phase-${demoPhase}`}
            onPointerMove={moveDemo}
            aria-label="Interactive demonstration of head movement becoming a dwell action"
          >
            <div className="hero-signal-demo__labels">
              <span>CALIBRATED</span><span>STABLE</span><span>LOCAL</span>
            </div>
            <div className="signal-face" aria-hidden="true">
              <span className="signal-face__axis" />
              <span className="signal-face__eye signal-face__eye--left" />
              <span className="signal-face__eye signal-face__eye--right" />
              <span className="signal-face__center" />
            </div>
            <div className="signal-trajectory" aria-hidden="true"><span /><span /><span /></div>
            <div className="signal-cursor" aria-hidden="true"><span /></div>
            <div className="signal-target" aria-hidden="true">
              <div className="signal-target__ring" />
              <strong>{demoPhase < 2 ? "ACQUIRE" : demoPhase < 4 ? "DWELL" : "OPEN"}</strong>
              <span>{demoPhase < 2 ? "Approach target" : demoPhase < 4 ? "Stable intent" : "Action ready"}</span>
            </div>
            <div className="hero-signal-demo__pipeline">
              {[
                ["HEAD", "Movement"],
                ["INTENT", "Estimated"],
                ["STABLE", "Qualified"],
                ["DWELL", "Accumulates"],
                ["ACTION", "Confirmed"],
              ].map(([title, copy], index) => (
                <div key={title} className={index <= demoPhase ? "is-active" : ""}>
                  <span>{title}</span><strong>{copy}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="core-promise" aria-label="LuminaXR core promise">
          <p>DIGITAL INTERFACES ASSUME</p>
          <div><span>POINT</span><span>CLICK</span><span>TAP</span><span>DRAG</span><span>TYPE</span></div>
          <ArrowDown aria-hidden="true" />
          <p>LUMINAX ADDS</p>
          <div className="core-promise__access"><span>MOVE</span><span>STABILIZE</span><span>DWELL</span><span>CONFIRM</span><span>ACCESS</span></div>
        </section>

        <section id="thinking" className="thinking-section">
          <div className="section-heading">
            <span>THE INTERACTION PIPELINE</span>
            <h2>How LuminaXR thinks</h2>
            <p>The cursor is the visible result of six quiet decisions happening together.</p>
          </div>
          <div className="thought-track">
            {thoughtStages.map(({ number, title, copy, icon: Icon }) => (
              <article key={title}>
                <div><span>{number}</span><Icon aria-hidden="true" /></div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="dwell" className="dwell-story">
          <div className="section-heading">
            <span>THE CORE INNOVATION</span>
            <h2>Stable intent becomes the click.</h2>
            <p>LuminaXR does not reward a cursor for merely lingering somewhere.</p>
          </div>
          <div className="dwell-comparison">
            <article className="dwell-comparison__conventional">
              <header><span>CONVENTIONAL DWELL</span><strong>Timer first</strong></header>
              <div className="comparison-timeline">
                <span className="is-risk">Cursor enters</span><MoveUpRight aria-hidden="true" />
                <span className="is-risk">Timer begins</span><MoveUpRight aria-hidden="true" />
                <span className="is-risk">Accidental click possible</span>
              </div>
            </article>
            <article className="dwell-comparison__luminax">
              <header><span>LUMINAX DWELL</span><strong>Intent first</strong></header>
              <div className="comparison-signal">
                <div><ScanFace aria-hidden="true" /><span>Target</span><strong>ACQUIRED</strong></div>
                <div><Gauge aria-hidden="true" /><span>Stability</span><strong>94%</strong></div>
                <div><Orbit aria-hidden="true" /><span>Dwell</span><strong>QUALIFIED</strong></div>
                <div><CircleCheck aria-hidden="true" /><span>Action</span><strong>READY</strong></div>
              </div>
              <p>Instability pauses or decays progress. Consequential actions add a deliberate second stage.</p>
            </article>
          </div>
        </section>

        <section className="module-story">
          <div className="section-heading">
            <span>ONE ACCESS LAYER</span>
            <h2>From movement to participation</h2>
            <p>Large, predictable experiences for the digital tasks that matter every day.</p>
          </div>
          <div className="landing-modules">
            {modules.map(({ title, copy, icon: Icon, tone }, index) => (
              <article key={title} data-tone={tone}>
                <div className="landing-modules__index">0{index + 1}</div>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="privacy-architecture">
          <div>
            <span>PRIVACY BY DESIGN</span>
            <h2>Your camera stays visible to you.</h2>
            <p>Camera frames are designed to remain inside the browser processing pipeline. LuminaXR stores interaction preferences, not images.</p>
            <Link to="/privacy">Explore privacy design <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="privacy-flow" aria-label="Camera privacy processing flow">
            {[
              [Camera, "CAMERA"],
              [ScanFace, "LOCAL VISION"],
              [Gauge, "MOVEMENT SIGNAL"],
              [Sparkles, "POINTER"],
            ].map(([Icon, label], index) => {
              const FlowIcon = Icon as typeof Camera;
              return <div key={String(label)}><FlowIcon aria-hidden="true" /><span>{String(label)}</span>{index < 3 && <ArrowRight aria-hidden="true" />}</div>;
            })}
          </div>
        </section>

        <section className="impact-band">
          <div><span>PRIMARY ALIGNMENT</span><strong>SDG 10</strong><p>Reduced Inequalities</p></div>
          <p>Digital access should not depend on hand movement. LuminaXR supports autonomy across learning, wellbeing, communication, and inclusive institutions.</p>
          <div className="impact-band__secondary"><span>SDG 3</span><span>SDG 4</span><span>SDG 16</span></div>
        </section>

        <section className="final-cta">
          <BrandMark />
          <h2>Your movement becomes the interface.</h2>
          <p>One webcam. A comfortable range. Digital access.</p>
          <Link className="primary-command" to="/access">Begin setup <ArrowRight aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="public-footer">
        <span>LuminaXR Access</span>
        <span>Move naturally. Access everything.</span>
        <nav><a href="#thinking">Accessibility</a><Link to="/privacy">Privacy</Link><Link to="/control-lab">Technology</Link><Link to="/admin">Admin Login</Link></nav>
      </footer>
    </div>
  );
}
