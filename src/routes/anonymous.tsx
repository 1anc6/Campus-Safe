import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy, EyeOff, LoaderCircle, Lock, Search, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AdaptiveShell } from "@/components/student/student-shell";
import { FormSection } from "@/components/student/form-section";
import { CATEGORIES, LOCATIONS, SEVERITIES, type Severity } from "@/lib/campus";
import { createAnonymous } from "@/backend/functions/reports";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/anonymous")({ component: AnonymousPage });

type Role = "victim" | "witness" | "heard";

const ROLES: [Role, string][] = [
  ["victim", "It happened to me"],
  ["witness", "I saw it"],
  ["heard", "I heard about it"],
];

const PROMISES = [
  "No name or account attached",
  "No IP address or device details stored",
  "Command only sees what you type",
  "Follow up with a private tracking code",
];

function AnonymousPage() {
  const [categoryId, setCategoryId] = useState<string>(CATEGORIES[0].id);
  const [locationId, setLocationId] = useState<string>(LOCATIONS[0].id);
  const [role, setRole] = useState<Role>("witness");
  const [timeRange, setTimeRange] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("P2");
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (timeRange.trim().length < 2) {
      setError("Roughly when did it happen? A range is fine.");
      return;
    }
    if (description.trim().length < 8) {
      setError("Please add a short description.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createAnonymous({
        data: {
          categoryId,
          locationId,
          role,
          timeRange: timeRange.trim(),
          description: description.trim(),
          severity,
          photoStripped: photo,
        },
      });
      setCode(res.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdaptiveShell anon width="wide">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet">
          <EyeOff className="size-3.5" /> Anonymous report
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Your identity is not saved.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Tell campus command what happened without revealing who you are. You'll get a private code
          to follow the case.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          {code ? (
            <CodeCard code={code} />
          ) : (
            <form id="anon-form" onSubmit={submit} className="space-y-4" noValidate>
              <FormSection step={1} title="Your connection to it" tone="violet">
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRole(id)}
                      aria-pressed={role === id}
                      className={cn(
                        "min-h-12 rounded-xl px-2 text-xs font-semibold ring-1 transition-colors",
                        role === id
                          ? "bg-violet/15 text-violet ring-violet/60"
                          : "bg-panel-2/40 ring-line hover:bg-panel-2",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FormSection>

              <FormSection step={2} title="What and where" tone="violet">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Category</span>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="input"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Campus place</span>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="input"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="field-label">Roughly when</span>
                    <input
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      placeholder="e.g. Last night, between 9 and 11 pm"
                      maxLength={80}
                      className="input"
                    />
                  </label>
                </div>
              </FormSection>

              <FormSection step={3} title="How serious is it?" tone="violet">
                <div className="grid grid-cols-4 gap-2">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id)}
                      aria-pressed={severity === s.id}
                      className={cn(
                        "min-h-14 rounded-xl px-1 text-xs ring-1 transition-colors",
                        severity === s.id
                          ? "bg-violet/15 text-violet ring-violet/60"
                          : "bg-panel-2/40 ring-line hover:bg-panel-2",
                      )}
                    >
                      <span className="block font-bold">{s.id}</span>
                      <span className="block text-[11px] text-muted">{s.label}</span>
                    </button>
                  ))}
                </div>
              </FormSection>

              <FormSection
                step={4}
                title="Describe it"
                hint="Avoid details that could identify you."
                tone="violet"
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="What happened, and anything command should know."
                  className="input min-h-32"
                  aria-label="Description"
                />
                <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={photo}
                    onChange={(e) => setPhoto(e.target.checked)}
                    className="size-4 accent-violet"
                  />
                  I have a photo (metadata will be stripped)
                </label>
              </FormSection>

              {/* Phones / tablets: submit sits under the form. */}
              <div className="lg:hidden">
                <SubmitBlock busy={busy} error={error} />
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-8">
          {!code && (
            <div className="card hidden p-4 lg:block">
              <SubmitBlock busy={busy} error={error} formId="anon-form" />
            </div>
          )}
          <div className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-violet" /> Our privacy promise
            </h2>
            <ul className="space-y-2">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-muted">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-violet" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <TrackBox />
        </aside>
      </div>
    </AdaptiveShell>
  );
}

function SubmitBlock({
  busy,
  error,
  formId,
}: {
  busy: boolean;
  error: string | null;
  formId?: string;
}) {
  return (
    <>
      {error && (
        <p
          className="mb-3 rounded-lg bg-sos/10 p-2.5 text-sm text-sos ring-1 ring-sos/30"
          role="alert"
        >
          {error}
        </p>
      )}
      <button type="submit" form={formId} disabled={busy} className="btn-neon min-h-12 w-full">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        {busy ? "Sending…" : "Send anonymously"}
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-dim">
        <Lock className="size-3" /> Sent without your name or account
      </p>
    </>
  );
}

function CodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card flex flex-col items-center px-5 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-violet/15 text-violet">
        <ShieldCheck className="size-6" />
      </span>
      <p className="mt-4 font-display text-xl font-semibold">Report sent anonymously</p>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">
        Your private tracking code
      </p>
      <div className="mt-2 flex items-center gap-2">
        <p className="select-all break-all font-mono text-2xl font-semibold tracking-wide text-violet sm:text-3xl">
          {code}
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true));
          }}
          className="grid size-10 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-fg"
          aria-label="Copy tracking code"
        >
          {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-4 max-w-sm text-sm text-muted">
        Save this now — it is the only way to follow your report, and we can't show it again.
      </p>
      <Link to="/track/$code" params={{ code }} className="btn-neon mt-8 w-full sm:w-auto sm:px-8">
        Open tracker
      </Link>
    </div>
  );
}

/** Look up an earlier anonymous report by its tracking code. */
function TrackBox() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const cleaned = value.trim().toUpperCase();
  return (
    <form
      className="card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (cleaned.length >= 6) void navigate({ to: "/track/$code", params: { code: cleaned } });
      }}
    >
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Search className="size-4 text-violet" /> Track a report
      </h2>
      <p className="mb-3 text-xs text-muted">Enter the code you saved when you reported.</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="CS-XXXX-XXXX"
          autoCapitalize="characters"
          spellCheck={false}
          className="input flex-1 font-mono uppercase"
          aria-label="Tracking code"
        />
        <button
          type="submit"
          disabled={cleaned.length < 6}
          className="btn-ghost px-3"
          aria-label="Track"
        >
          <Search className="size-4" />
        </button>
      </div>
    </form>
  );
}
