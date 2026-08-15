import { useState } from "react";
import { ArrowRight, HeartPulse, Home, MessageSquareText, PhoneCall } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

const feelings = [
  { id: "good", face: "Good", symbol: "◡", tone: "mint" as const },
  { id: "okay", face: "Okay", symbol: "•", tone: "cyan" as const },
  { id: "uncomfortable", face: "Uncomfortable", symbol: "~", tone: "amber" as const },
  { id: "assistance", face: "Need assistance", symbol: "!", tone: "coral" as const },
];

export default function WellbeingPage() {
  const navigate = useNavigate();
  const [feeling, setFeeling] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  return (
    <div className="wellbeing-module">
      <header className="module-heading module-heading--compact"><div><p className="workspace-kicker">WELLBEING</p><h1>How are you feeling right now?</h1><p>A respectful check-in, not a diagnosis.</p></div><div className="module-heading__state"><HeartPulse aria-hidden="true" /><span>CHECK-IN</span><strong>{feeling ? "RECORDED" : "READY"}</strong></div></header>
      <section className="feeling-grid" aria-label="Wellbeing choices">
        {feelings.map((item) => <AssistiveTarget key={item.id} targetId={`feeling-${item.id}`} label={`Feeling ${item.face}`} tone={item.tone} className={feeling === item.id ? "is-selected" : ""} onClick={() => { setFeeling(item.id); setAction(null); }} dwellMs={1000}><span className="feeling-symbol">{item.symbol}</span><strong>{item.face}</strong><small>{feeling === item.id ? "Selected" : "Choose"}</small></AssistiveTarget>)}
      </section>
      {feeling && (
        <section className="wellbeing-actions">
          <div><span>NEXT STEP</span><h2>Would you like LuminaXR to do anything?</h2></div>
          <div>
            <AssistiveTarget targetId="wellbeing-nothing" label="Nothing, return home" tone={action === "nothing" ? "mint" : "neutral"} onClick={() => { setAction("nothing"); navigate("/hub"); }}><Home aria-hidden="true" /> Nothing</AssistiveTarget>
            <AssistiveTarget targetId="wellbeing-communication" label="Open communication" tone={action === "communication" ? "cyan" : "neutral"} onClick={() => navigate("/communicate")}><MessageSquareText aria-hidden="true" /> Open communication</AssistiveTarget>
            <AssistiveTarget targetId="wellbeing-contact" label="Show saved contact action" tone={action === "contact" ? "amber" : "neutral"} onClick={() => setAction("contact")}><PhoneCall aria-hidden="true" /> Saved contact</AssistiveTarget>
          </div>
          {action === "contact" && <div className="saved-contact-action"><PhoneCall aria-hidden="true" /><div><span>DEMO CONTACT ACTION</span><strong>Care contact is ready</strong><p>No call is placed in this demonstration.</p></div><ArrowRight aria-hidden="true" /></div>}
        </section>
      )}
    </div>
  );
}
