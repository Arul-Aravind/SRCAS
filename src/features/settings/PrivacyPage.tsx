import { ArrowRight, Camera, Database, Gauge, LockKeyhole, MousePointer2, ScanFace, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/luminax/BrandMark";
import { ReturnToHubTarget } from "@/components/luminax/ReturnToHubTarget";

const flow = [
  { title: "Camera", copy: "A live frame exists inside your browser.", icon: Camera },
  { title: "Local vision", copy: "Facial landmarks are interpreted on-device when supported.", icon: ScanFace },
  { title: "Movement signal", copy: "Only pose values enter the control pipeline.", icon: Gauge },
  { title: "Pointer", copy: "The signal becomes coordinates, dwell and action.", icon: MousePointer2 },
];

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <header><BrandMark /><ReturnToHubTarget /></header>
      <main>
        <section className="privacy-hero">
          <div className="privacy-hero__icon"><LockKeyhole aria-hidden="true" /><span /></div>
          <p>PRIVACY DESIGN</p>
          <h1>Your movement should become a signal, not a surveillance stream.</h1>
          <p>LuminaXR is designed for local browser processing. Camera frames are not uploaded or saved by this frontend.</p>
        </section>
        <section className="privacy-pipeline">
          {flow.map(({ title, copy, icon: Icon }, index) => (
            <article key={title}><span>0{index + 1}</span><Icon aria-hidden="true" /><h2>{title}</h2><p>{copy}</p>{index < flow.length - 1 && <ArrowRight aria-hidden="true" />}</article>
          ))}
        </section>
        <section className="privacy-details">
          <article><ShieldCheck aria-hidden="true" /><div><h2>Designed for local processing</h2><p>MediaPipe runs in the browser when the vision model is available. The app does not include a webcam-upload backend.</p></div></article>
          <article><Database aria-hidden="true" /><div><h2>What is stored</h2><p>Interaction settings, calibration offsets, routines and custom communication phrases may be stored in localStorage on this browser.</p></div></article>
          <article><Camera aria-hidden="true" /><div><h2>Clear camera state</h2><p>Whenever camera mode is active, the workspace shows a visible status. Demo Mode is clearly labelled and never claims that computer vision is running.</p></div></article>
        </section>
        <section className="privacy-boundary">
          <span>RESPONSIBLE BOUNDARY</span>
          <h2>Privacy depends on the whole environment.</h2>
          <p>LuminaXR minimizes unnecessary camera-data exposure by design, but browser, device and network security still matter. This interface avoids unsupported absolute security claims.</p>
          <Link className="primary-command" to="/access">Start with Demo Mode <ArrowRight aria-hidden="true" /></Link>
        </section>
      </main>
    </div>
  );
}
