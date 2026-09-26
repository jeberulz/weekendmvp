"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { SetupForm } from "@/components/platform/home/SetupForm";

function LiveAnswers() {
  const prefs = useQuery(api.platform.preferences.get);
  const [message, setMessage] = useState("");
  if (prefs === undefined) return <ModuleSkeleton label="Loading your answers" className="h-[360px]" />;
  return (
    <>
      <SetupForm
        initial={{ tools: [...prefs.tools], weeklyHours: prefs.weeklyHours, goal: prefs.goal }}
        submitLabel="Save answers"
        onSaved={() => setMessage("Saved. Picked for you now uses these answers.")}
      />
      <p role="status" className="text-sm text-home-sage-ink">
        {message}
      </p>
    </>
  );
}

/** WP44-S8. The setup answers, editable any time (ruling R7). */
export function SettingsAnswers() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your answers" className="h-[360px]" />}>
      <LiveAnswers />
    </PersonalModule>
  );
}
