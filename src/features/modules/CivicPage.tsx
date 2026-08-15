import { useState } from "react";
import { Accessibility, ArrowLeft, ArrowRight, CheckCircle2, FileSearch, Landmark, MessageSquareText, ShieldCheck } from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

const services = [
  { id: "local", title: "View local services", copy: "Browse nearby community support", icon: Landmark },
  { id: "status", title: "Check application status", copy: "Follow a fictional reference", icon: FileSearch },
  { id: "access", title: "Accessibility support", copy: "Request a communication preference", icon: Accessibility },
  { id: "feedback", title: "Submit feedback", copy: "Send a demonstration message", icon: MessageSquareText },
];

export default function CivicPage() {
  const { requestConfirmation } = useLumina();
  const [step, setStep] = useState<"services" | "details" | "complete">("services");
  const [service, setService] = useState<typeof services[number] | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);
  const choose = (item: typeof services[number]) => { setService(item); setSelectedPreference(null); setStep("details"); };
  const submit = () => requestConfirmation({ title: "Submit this demo request?", description: "This is a fictional Community Services flow. No information will be sent to a real public agency.", confirmLabel: "Confirm demo request", onConfirm: () => setStep("complete") });

  return (
    <div className="civic-module">
      <header className="module-heading module-heading--compact"><div><p className="workspace-kicker">CIVIC ACCESS · FICTIONAL DEMO</p><h1>Community Services</h1><p>A complex portal, transformed into a predictable guided journey.</p></div><div className="module-heading__state"><Landmark aria-hidden="true" /><span>JOURNEY</span><strong>{step === "services" ? "1 OF 3" : step === "details" ? "2 OF 3" : "COMPLETE"}</strong></div></header>
      {step === "services" && <section className="civic-services" aria-label="Community service options">{services.map((item, index) => { const Icon = item.icon; return <AssistiveTarget key={item.id} targetId={`civic-${item.id}`} label={item.title} tone={(["cyan", "mint", "violet", "amber"] as const)[index]} onClick={() => choose(item)}><Icon aria-hidden="true" /><div><span>0{index + 1}</span><h2>{item.title}</h2><p>{item.copy}</p></div><ArrowRight aria-hidden="true" /></AssistiveTarget>; })}</section>}
      {step === "details" && service && (
        <section className="civic-details">
          <button type="button" onClick={() => { setSelectedPreference(null); setStep("services"); }}><ArrowLeft aria-hidden="true" /> Back to services</button>
          <div className="civic-details__guide"><span>GUIDED STEP</span><h2>{service.title}</h2><p>Choose the access preference you would like this fictional service to remember.</p></div>
          <div className="civic-choice-grid">
            {["Large text and simple language", "Communication by email", "Extra time for each step", "Keyboard and assistive input"].map((choice, index) => <AssistiveTarget key={choice} targetId={`civic-choice-${index}`} label={choice} tone={selectedPreference === choice ? "mint" : index === 0 ? "cyan" : "neutral"} className={selectedPreference === choice ? "is-selected" : ""} onClick={() => setSelectedPreference(choice)}><span>{selectedPreference === choice ? "✓" : index + 1}</span><strong>{choice}</strong></AssistiveTarget>)}
          </div>
          <AssistiveTarget targetId="civic-submit" label="Review and submit demo request" tone="mint" className="civic-submit" dwellMs={1200} requiresConfirmation disabled={!selectedPreference} onClick={submit}><ShieldCheck aria-hidden="true" /><span><strong>Review and submit</strong><small>{selectedPreference ? "Requires deliberate confirmation" : "Choose an access preference first"}</small></span><ArrowRight aria-hidden="true" /></AssistiveTarget>
        </section>
      )}
      {step === "complete" && <section className="civic-complete"><CheckCircle2 aria-hidden="true" /><p>DEMO JOURNEY COMPLETE</p><h2>Your fictional request is ready.</h2><p>No information was transmitted. The flow demonstrates large-target navigation and deliberate confirmation.</p><button type="button" className="primary-command" onClick={() => { setService(null); setStep("services"); }}>Start another journey <ArrowRight aria-hidden="true" /></button></section>}
    </div>
  );
}
