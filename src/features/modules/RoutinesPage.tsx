import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, RotateCcw, SkipForward } from "lucide-react";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

type Routine = { id: string; time: string; title: string; state: "upcoming" | "done" | "skipped" | "later" };
const defaults: Routine[] = [
  { id: "reading", time: "09:00", title: "Reading session", state: "upcoming" },
  { id: "break", time: "10:30", title: "Rest break", state: "upcoming" },
  { id: "lunch", time: "13:00", title: "Lunch", state: "upcoming" },
  { id: "family", time: "17:00", title: "Call family", state: "upcoming" },
  { id: "relax", time: "20:00", title: "Watch and relax", state: "upcoming" },
];

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>(() => { try { return JSON.parse(localStorage.getItem("luminax.routines") ?? "null") ?? defaults; } catch { return defaults; } });
  useEffect(() => { try { localStorage.setItem("luminax.routines", JSON.stringify(routines)); } catch { /* session only */ } }, [routines]);
  const update = (id: string, state: Routine["state"]) => setRoutines((current) => current.map((routine) => routine.id === id ? { ...routine, state } : routine));
  const complete = routines.filter((routine) => routine.state === "done").length;

  return (
    <div className="routines-module">
      <header className="module-heading module-heading--compact"><div><p className="workspace-kicker">MY DAY</p><h1>Good morning.</h1><p>A calm view of what is ahead. These examples are not medical advice.</p></div><div className="module-heading__state"><CalendarDays aria-hidden="true" /><span>TODAY</span><strong>{complete}/{routines.length} DONE</strong></div></header>
      <div className="routine-progress"><span style={{ width: `${(complete / routines.length) * 100}%` }} /><p>{complete === routines.length ? "Your day is complete." : `${routines.length - complete} moments remaining`}</p></div>
      <section className="routine-timeline" aria-label="Today's routine">
        {routines.map((routine, index) => (
          <article key={routine.id} className={`is-${routine.state}`}>
            <div className="routine-time"><span>{routine.time}</span><i /></div>
            <div className="routine-copy"><span>{routine.state === "done" ? "COMPLETE" : routine.state === "later" ? "REMIND LATER" : routine.state === "skipped" ? "SKIPPED" : `ITEM ${index + 1}`}</span><h2>{routine.title}</h2></div>
            <div className="routine-actions">
              <AssistiveTarget targetId={`routine-done-${routine.id}`} label={`Mark ${routine.title} done`} tone={routine.state === "done" ? "mint" : "neutral"} onClick={() => update(routine.id, routine.state === "done" ? "upcoming" : "done")} dwellMs={900}><Check aria-hidden="true" /> Done</AssistiveTarget>
              <AssistiveTarget targetId={`routine-later-${routine.id}`} label={`Remind later for ${routine.title}`} tone={routine.state === "later" ? "amber" : "neutral"} onClick={() => update(routine.id, "later")} dwellMs={1050}><Clock3 aria-hidden="true" /> Later</AssistiveTarget>
              <AssistiveTarget targetId={`routine-skip-${routine.id}`} label={`Skip ${routine.title}`} tone="neutral" onClick={() => update(routine.id, "skipped")} dwellMs={1300}><SkipForward aria-hidden="true" /> Skip</AssistiveTarget>
            </div>
          </article>
        ))}
      </section>
      <button type="button" className="routine-reset" onClick={() => setRoutines(defaults)}><RotateCcw aria-hidden="true" /> Reset demo day</button>
    </div>
  );
}
