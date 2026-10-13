"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { completeWellbeingActivity } from "./actions";
import { wellbeingActivities } from "./resources";
import type { ActivityId } from "./contracts";

export function ActivityCard({ id, reason }: { id: ActivityId; reason?: string }) {
  const activity = wellbeingActivities[id];
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  async function complete() {
    if (busy.current || completed) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const result = await completeWellbeingActivity(id, Intl.DateTimeFormat().resolvedOptions().timeZone);
      setCompleted(result.ok); setMessage(result.message);
    } catch { setMessage("No se ha podido registrar la actividad. Puedes reintentarlo."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="wellbeing-activity">
    <h3>{activity.title}</h3><p className="muted">{activity.duration}</p>
    {reason ? <p>{reason}</p> : null}
    <ol>{activity.steps.map(step => <li key={step}>{step}</li>)}</ol>
    <Button variant="outline" disabled={pending || completed} onClick={complete}>
      {pending ? "Registrando…" : completed ? "Actividad realizada" : "He realizado esta actividad"}
    </Button>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
