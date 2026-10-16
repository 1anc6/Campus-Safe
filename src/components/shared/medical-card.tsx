import { Droplet, HeartPulse, Phone } from "lucide-react";
import type { MedicalInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The reporter's medical ID, for command and the assigned responder during an SOS. */
export function MedicalCard({ info, className }: { info: MedicalInfo | null; className?: string }) {
  if (!info) {
    return (
      <div className={cn("rounded-xl p-3 text-xs text-muted neu-well", className)}>
        No medical ID shared.
      </div>
    );
  }
  return (
    <div className={cn("space-y-3 rounded-xl bg-sos/5 p-3 ring-1 ring-sos/25", className)}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sos">
        <HeartPulse className="size-4" /> Medical ID
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {info.bloodGroup && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--sos-fill)] px-2.5 py-1 text-sm font-bold text-white">
            <Droplet className="size-3.5" /> {info.bloodGroup}
          </span>
        )}
        {info.emergencyPhone && (
          <a
            href={`tel:${info.emergencyPhone.replace(/\s/g, "")}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-neon neu-raised-xs hover:bg-panel-2"
          >
            <Phone className="size-3.5" />
            {info.emergencyName ? `${info.emergencyName} · ` : "Emergency contact · "}
            {info.emergencyPhone}
          </a>
        )}
      </div>
      {info.medicalNotes && <p className="whitespace-pre-line text-sm">{info.medicalNotes}</p>}
    </div>
  );
}
