import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Droplet,
  GraduationCap,
  HeartPulse,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Avatar, SignOutButton } from "@/components/shared/account-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { authClient } from "@/lib/auth/client";
import { changeMyEmail, getMyProfile, updateMyProfile } from "@/backend/functions/profile";
import { BLOOD_GROUPS, type BloodGroup, type MyProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { forgetViewer } from "@/lib/auth/viewer-cache";

/* ------------------------------------------------------------------ context */

type ProfilePanelState = {
  profile: MyProfile | null;
  open: (section?: "medical") => void;
};

const ProfilePanelContext = createContext<ProfilePanelState | null>(null);

export function useProfilePanel(): ProfilePanelState {
  const ctx = useContext(ProfilePanelContext);
  if (!ctx) throw new Error("useProfilePanel must be used inside <ProfilePanelProvider>");
  return ctx;
}

/** How much of the safety-relevant profile is filled in (0–100). */
export function profileCompleteness(p: MyProfile): { percent: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [Boolean(p.phone), "phone number"],
    [Boolean(p.course), "course"],
    [Boolean(p.bloodGroup), "blood group"],
    [Boolean(p.emergencyName && p.emergencyPhone), "emergency contact"],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return {
    percent: Math.round(((done + 1) / (checks.length + 1)) * 100), // name always counts
    missing: checks.filter(([ok]) => !ok).map(([, label]) => label),
  };
}

/**
 * Loads the student's own profile once for the shell and renders the profile &
 * settings panel (a right-hand drawer on desktop, a full-height sheet on phones).
 */
export function ProfilePanelProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusMedical, setFocusMedical] = useState(false);

  useEffect(() => {
    let live = true;
    getMyProfile()
      .then((p) => live && setProfile(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const open = useCallback((section?: "medical") => {
    setFocusMedical(section === "medical");
    setIsOpen(true);
  }, []);

  const value = useMemo(() => ({ profile, open }), [profile, open]);

  return (
    <ProfilePanelContext.Provider value={value}>
      {children}
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              "glass-bar fixed inset-0 z-[1101] flex flex-col outline-none",
              "md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:border-l md:border-line md:shadow-2xl",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            )}
            aria-describedby={undefined}
          >
            {profile ? (
              <PanelBody
                profile={profile}
                focusMedical={focusMedical}
                onSaved={setProfile}
                onClose={() => setIsOpen(false)}
              />
            ) : (
              <div className="grid flex-1 place-items-center">
                <Dialog.Title className="sr-only">Profile</Dialog.Title>
                <LoaderCircle className="size-6 animate-spin text-muted" />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ProfilePanelContext.Provider>
  );
}

/** The avatar button that opens the panel (top bar on phones, rail on desktop). */
export function ProfileButton({ className, withName }: { className?: string; withName?: boolean }) {
  const { profile, open } = useProfilePanel();
  if (!profile) return null;
  const incomplete = profileCompleteness(profile).missing.length > 0;
  return (
    <button
      type="button"
      onClick={() => open()}
      className={cn(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-xl transition-colors hover:bg-panel-2",
        withName && "w-full justify-start px-2 py-2 text-left",
        className,
      )}
      aria-label="Open profile and settings"
      title="Profile & settings"
    >
      <span className="relative">
        <Avatar profile={profile} />
        {incomplete && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warn ring-2 ring-chrome"
            aria-hidden="true"
          />
        )}
      </span>
      {withName && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-fg">{profile.name}</span>
          <span className="block truncate text-[11px] text-dim">
            {profile.course ?? "Profile & settings"}
          </span>
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------- panel */

function PanelBody({
  profile,
  focusMedical,
  onSaved,
  onClose,
}: {
  profile: MyProfile;
  focusMedical: boolean;
  onSaved: (p: MyProfile) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(profile));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(profile));
  const { percent, missing } = profileCompleteness(profile);

  useEffect(() => {
    if (focusMedical)
      document.getElementById("profile-medical")?.scrollIntoView({ block: "start" });
  }, [focusMedical]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validate(form);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const next = await updateMyProfile({ data: form });
      onSaved(next);
      setForm(toForm(next));
      forgetViewer();
      await router.invalidate(); // refresh the name shown across the app
      toast.success("Profile saved");
    } catch {
      setError("Couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line bg-chrome px-4 pb-3 pt-[max(0.75rem,var(--safe-top))]">
        <Avatar profile={profile} className="size-11 text-base" />
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate font-display text-lg font-semibold">
            {profile.name}
          </Dialog.Title>
          <p className="truncate text-xs text-muted">{profile.email}</p>
        </div>
        <Dialog.Close
          className="grid size-11 place-items-center rounded-xl text-muted hover:bg-panel-2 hover:text-fg"
          aria-label="Close profile"
        >
          <X className="size-5" />
        </Dialog.Close>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Completeness */}
        <div className="border-b border-line px-4 py-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Profile {percent}% complete</span>
            {missing.length === 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-ok">
                <ShieldCheck className="size-3.5" /> Ready for emergencies
              </span>
            ) : (
              <span className="text-muted">{missing.length} to go</span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percent === 100 ? "bg-ok" : "bg-accent",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Add your {joinWords(missing)} so responders can help you faster.
            </p>
          )}
        </div>

        <form id="profile-form" onSubmit={save} className="space-y-6 px-4 py-5" noValidate>
          <Section icon={GraduationCap} title="Personal details">
            <Field label="Full name" id="pf-name">
              <input
                id="pf-name"
                className="input"
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Course" id="pf-course">
                <input
                  id="pf-course"
                  className="input"
                  list="pf-course-options"
                  placeholder="e.g. B.Tech CSE, 2nd year"
                  value={form.course}
                  onChange={(e) => set("course", e.target.value)}
                />
                <datalist id="pf-course-options">
                  {COURSE_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Student ID" id="pf-sid">
                <input
                  id="pf-sid"
                  className="input"
                  autoCapitalize="characters"
                  placeholder="Roll / enrolment no."
                  value={form.studentId}
                  onChange={(e) => set("studentId", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Phone" id="pf-phone" hint="Responders call this number during your SOS.">
              <input
                id="pf-phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </Section>

          <Section icon={HeartPulse} title="Medical ID" tone="sos" id="profile-medical">
            <div>
              <p className="field-label">Blood group</p>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Blood group">
                {BLOOD_GROUPS.map((g) => (
                  <BloodChip
                    key={g}
                    label={g}
                    on={form.bloodGroup === g}
                    onClick={() => set("bloodGroup", g)}
                  />
                ))}
                <BloodChip
                  label="Not sure"
                  on={form.bloodGroup === null}
                  onClick={() => set("bloodGroup", null)}
                  wide
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Emergency contact" id="pf-ename">
                <input
                  id="pf-ename"
                  className="input"
                  placeholder="Name (e.g. Mom)"
                  value={form.emergencyName}
                  onChange={(e) => set("emergencyName", e.target.value)}
                />
              </Field>
              <Field label="Their phone" id="pf-ephone">
                <input
                  id="pf-ephone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 …"
                  value={form.emergencyPhone}
                  onChange={(e) => set("emergencyPhone", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Allergies, conditions or medication" id="pf-notes">
              <textarea
                id="pf-notes"
                className="input min-h-20 resize-y"
                maxLength={500}
                placeholder="e.g. Asthma — inhaler in bag. Allergic to penicillin."
                value={form.medicalNotes}
                onChange={(e) => set("medicalNotes", e.target.value)}
              />
            </Field>
            <Toggle
              on={form.shareMedical}
              onChange={(v) => set("shareMedical", v)}
              label="Share with responders during an SOS"
              hint="Only campus command and your assigned responder see it, and only while your SOS is open."
            />
          </Section>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-sos/10 p-3 text-sm text-sos ring-1 ring-sos/40"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </form>

        <div className="space-y-6 border-t border-line px-4 py-5">
          <Section icon={Mail} title="Sign-in">
            <EmailChanger profile={profile} onChanged={onSaved} />
            {profile.hasPassword && <PasswordChanger />}
          </Section>

          <Section icon={ShieldCheck} title="Preferences">
            <ThemeToggle withLabel className="ring-line" />
            <SignOutButton className="w-full justify-center neu-raised-xs" />
          </Section>
        </div>
      </div>

      <footer className="flex gap-2 border-t border-line bg-chrome px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3">
        <button type="button" onClick={onClose} className="btn-ghost flex-1">
          Close
        </button>
        <button
          type="submit"
          form="profile-form"
          disabled={!dirty || saving}
          className="btn-neon flex-[2] disabled:cursor-not-allowed"
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          {saving ? "SAVING…" : dirty ? "SAVE CHANGES" : "SAVED"}
        </button>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------ form helpers */

type FormState = {
  name: string;
  phone: string;
  course: string;
  studentId: string;
  bloodGroup: BloodGroup | null;
  emergencyName: string;
  emergencyPhone: string;
  medicalNotes: string;
  shareMedical: boolean;
};

const COURSE_SUGGESTIONS = [
  "B.Tech CSE",
  "B.Tech ECE",
  "B.Tech ME",
  "B.Tech Civil",
  "BCA",
  "MCA",
  "BBA",
  "MBA",
  "B.Sc",
  "M.Sc",
  "B.Com",
  "B.Pharm",
  "BA LLB",
];

function toForm(p: MyProfile): FormState {
  return {
    name: p.name,
    phone: p.phone ?? "",
    course: p.course ?? "",
    studentId: p.studentId ?? "",
    bloodGroup: p.bloodGroup,
    emergencyName: p.emergencyName ?? "",
    emergencyPhone: p.emergencyPhone ?? "",
    medicalNotes: p.medicalNotes ?? "",
    shareMedical: p.shareMedical,
  };
}

const PHONE_RE = /^[+\d][\d\s()-]{5,}$/;

function validate(f: FormState): string | null {
  if (f.name.trim().length < 2) return "Enter your full name.";
  if (f.phone.trim() && !PHONE_RE.test(f.phone.trim()))
    return "Your phone number doesn't look right.";
  if (f.emergencyPhone.trim() && !PHONE_RE.test(f.emergencyPhone.trim()))
    return "The emergency contact's phone number doesn't look right.";
  if (f.emergencyName.trim() && !f.emergencyPhone.trim())
    return "Add a phone number for your emergency contact.";
  return null;
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function Section({
  icon: Icon,
  title,
  tone,
  id,
  children,
}: {
  icon: typeof Mail;
  title: string;
  tone?: "sos";
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h3
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
          tone === "sos" ? "text-sos" : "text-muted",
        )}
      >
        <Icon className="size-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

function BloodChip({
  label,
  on,
  onClick,
  wide,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1 rounded-xl text-sm font-semibold ring-1 transition-colors",
        wide && "col-span-2 text-xs",
        on
          ? wide
            ? "bg-fg text-panel ring-fg"
            : "bg-[var(--sos-fill)] text-white ring-sos"
          : "bg-panel-2 text-fg ring-line hover:ring-line-strong",
      )}
    >
      {!wide && <Droplet className={cn("size-3", on ? "text-white" : "text-sos")} />}
      {label}
    </button>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 rounded-xl p-3 text-left neu-well"
    >
      <span
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-full transition-colors",
          on ? "bg-ok" : "bg-line-strong",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/* ----------------------------------------------------- email & password */

function EmailChanger({
  profile,
  onChanged,
}: {
  profile: MyProfile;
  onChanged: (p: MyProfile) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl p-3 neu-well">
        <span className="min-w-0">
          <span className="block text-[11px] text-muted">Email</span>
          <span className="block truncate text-sm">{profile.email}</span>
        </span>
        {profile.hasPassword && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEmail(profile.email ?? "");
            }}
            className="btn-ghost min-h-9 shrink-0 px-3 text-xs"
          >
            Change
          </button>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your current password.");
    setBusy(true);
    try {
      const res = await changeMyEmail({ data: { email: email.trim(), currentPassword: password } });
      if (!res.ok) return setError(res.error);
      onChanged(res.profile);
      forgetViewer();
      await router.invalidate();
      toast.success("Email updated — use it next time you sign in");
      setEditing(false);
      setPassword("");
    } catch {
      setError("Couldn't change your email. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl p-3 neu-well" noValidate>
      <Field label="New email" id="pf-email">
        <input
          id="pf-email"
          className="input"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Current password" id="pf-email-pw">
        <input
          id="pf-email-pw"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-xs text-sos">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-neon flex-1">
          {busy && <LoaderCircle className="size-4 animate-spin" />} Update email
        </button>
      </div>
    </form>
  );
}

function PasswordChanger() {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 rounded-xl p-3 text-left neu-well"
      >
        <KeyRound className="size-4 text-muted" />
        <span className="flex-1 text-sm">Change password</span>
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    setBusy(true);
    try {
      const { error: authError } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (authError) {
        setError(
          authError.code === "INVALID_PASSWORD" || authError.status === 400
            ? "Current password is incorrect."
            : "Couldn't change your password. Try again.",
        );
        return;
      }
      toast.success("Password changed. Other devices were signed out.");
      setEditing(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Couldn't change your password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl p-3 neu-well" noValidate>
      <Field label="Current password" id="pf-pw-cur">
        <input
          id="pf-pw-cur"
          className="input"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="New password" id="pf-pw-new">
        <input
          id="pf-pw-new"
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <Field label="Confirm new password" id="pf-pw-confirm">
        <input
          id="pf-pw-confirm"
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-xs text-sos">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-neon flex-1">
          {busy && <LoaderCircle className="size-4 animate-spin" />} Update password
        </button>
      </div>
    </form>
  );
}
