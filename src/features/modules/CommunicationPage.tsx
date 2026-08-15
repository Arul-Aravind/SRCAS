import { useEffect, useState } from "react";
import { CircleCheck, MessageSquareText, Plus, Settings2, Volume2 } from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

const defaultPhrases = {
  Needs: ["I need water", "I need help", "Please wait", "I need a break"],
  Social: ["Yes", "No", "Thank you", "Hello", "I'm okay"],
};

export default function CommunicationPage() {
  const { speak } = useLumina();
  const [category, setCategory] = useState<"Needs" | "Social" | "Custom">("Needs");
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("luminax.customPhrases") ?? "[]"); } catch { return []; }
  });
  const [draft, setDraft] = useState("");

  useEffect(() => { try { localStorage.setItem("luminax.customPhrases", JSON.stringify(custom)); } catch { /* session-only fallback */ } }, [custom]);
  const phrases = category === "Custom" ? custom : defaultPhrases[category];
  const choose = (phrase: string) => { setSelected(phrase); speak(phrase, true); };
  const addCustom = () => { const phrase = draft.trim(); if (!phrase) return; setCustom((current) => [phrase, ...current].slice(0, 12)); setDraft(""); setCategory("Custom"); };

  return (
    <div className="communication-module">
      <header className="module-heading module-heading--compact"><div><p className="workspace-kicker">COMMUNICATION</p><h1>Say what matters.</h1><p>Select a phrase to speak it aloud. Custom phrases stay in this browser.</p></div><div className="module-heading__state"><MessageSquareText aria-hidden="true" /><span>SPEECH</span><strong>READY</strong></div></header>
      <div className="communication-layout">
        <aside className="phrase-categories" aria-label="Phrase categories">
          {(["Needs", "Social", "Custom"] as const).map((item) => <AssistiveTarget key={item} targetId={`phrase-category-${item.toLowerCase()}`} label={`Open ${item} phrases`} tone={category === item ? "cyan" : "neutral"} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)} dwellMs={850}><span>{item}</span><small>{item === "Needs" ? "Essential requests" : item === "Social" ? "Everyday conversation" : `${custom.length} saved phrases`}</small></AssistiveTarget>)}
          <div className="custom-phrase-entry"><label htmlFor="custom-phrase">New custom phrase</label><div><input id="custom-phrase" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a phrase" /><button type="button" onClick={addCustom} aria-label="Add custom phrase"><Plus /></button></div></div>
        </aside>
        <section className="phrase-board" aria-label={`${category} communication phrases`}>
          {phrases.length ? phrases.map((phrase, index) => (
            <AssistiveTarget key={phrase} targetId={`phrase-${category.toLowerCase()}-${index}`} label={`Speak: ${phrase}`} tone={selected === phrase ? "mint" : (["cyan", "violet", "amber", "neutral"] as const)[index % 4]} className={selected === phrase ? "is-selected" : ""} onClick={() => choose(phrase)} dwellMs={950}>
              {selected === phrase ? <CircleCheck aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<strong>{phrase}</strong><span>{selected === phrase ? "Spoken" : "Select to speak"}</span>
            </AssistiveTarget>
          )) : <div className="phrase-empty"><Settings2 aria-hidden="true" /><h2>No custom phrases yet</h2><p>Add one using the field on the left.</p></div>}
        </section>
      </div>
      <div className="spoken-output" aria-live="polite"><span>CURRENT PHRASE</span><strong>{selected ?? "Choose a phrase"}</strong>{selected && <button type="button" onClick={() => speak(selected, true)}><Volume2 aria-hidden="true" /> Speak again</button>}</div>
    </div>
  );
}
