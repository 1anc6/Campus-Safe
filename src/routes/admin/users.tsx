import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, LoaderCircle, Search, Shield, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/account-menu";
import { AdminPageHeader } from "@/components/admin-shell";
import { useViewer } from "@/lib/auth/use-viewer";
import { USER_ROLES, type UserRole } from "@/lib/campus";
import { roleLabel } from "@/lib/roles";
import { createAccount, listPeople, resetPassword, setPersonRole, type PersonRow } from "@/lib/server/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

const ROLE_TONE: Record<UserRole, string> = {
  admin: "bg-violet/15 text-violet ring-violet/30",
  responder: "bg-sos/15 text-sos ring-sos/30",
  student: "bg-neon-dim text-neon ring-neon/30",
};

const PERMISSIONS: { role: UserRole; perms: string[] }[] = [
  { role: "student", perms: ["Hold-to-send SOS with live location", "Report incidents & track own reports", "Anonymous reporting"] },
  { role: "responder", perms: ["Field app for assigned SOS alerts", "Update arrival & resolution", "No console access"] },
  { role: "admin", perms: ["Full operations console", "Dispatch, status & remarks", "Manage users, roles & analytics"] },
];

function UsersPage() {
  const viewer = useViewer();
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<PersonRow | null>(null);

  const load = useCallback(
    () =>
      listPeople()
        .then((p) => {
          setPeople(p);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load users")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<UserRole, number> = { student: 0, responder: 0, admin: 0 };
    for (const p of people ?? []) c[p.role] += 1;
    return c;
  }, [people]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (people ?? []).filter(
      (p) =>
        (roleFilter === "all" || p.role === roleFilter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q)),
    );
  }, [people, term, roleFilter]);

  async function changeRole(person: PersonRow, role: UserRole) {
    if (role === person.role) return;
    setSavingId(person.userId);
    try {
      await setPersonRole({ data: { userId: person.userId, role } });
      toast.success(`${person.name} is now ${roleLabel(role).toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change role");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="Users"
        subtitle="Campus accounts and their roles. Roles are enforced on the server."
        actions={
          <button type="button" className="btn-neon" onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> New account
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {USER_ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleFilter((cur) => (cur === r.id ? "all" : r.id))}
            aria-pressed={roleFilter === r.id}
            className={cn(
              "card p-3 text-center transition-colors hover:bg-panel-2 sm:p-4",
              roleFilter === r.id && "ring-1 ring-neon/50",
            )}
          >
            <p className="font-display text-2xl font-bold">{people ? counts[r.id] : "–"}</p>
            <p className="mt-0.5 text-xs text-muted">{r.label}s</p>
          </button>
        ))}
      </div>

      {resetting && (
        <ResetPasswordForm
          person={resetting}
          self={resetting.userId === viewer?.userId}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null);
            void load();
          }}
        />
      )}

      {creating && (
        <CreateAccountForm
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      <div className="card flex flex-col gap-2 p-3 sm:flex-row sm:p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name or email…"
            className="input pl-10"
            aria-label="Search users"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          className="input sm:w-48"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="card p-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}

      {/* Phones / small tablets: cards */}
      <ul className="space-y-2 md:hidden">
        {filtered.map((p) => (
          <li key={p.userId} className="card flex items-center gap-3 p-3">
            <Avatar profile={{ ...p, phone: null, avatarUrl: null }} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.name}
                {p.userId === viewer?.userId && <span className="ml-1 text-xs text-dim">(you)</span>}
              </p>
              <p className="truncate text-xs text-muted">{p.email ?? "No email"}</p>
            </div>
            <div className="flex items-center gap-1">
              <RoleSelect person={p} self={p.userId === viewer?.userId} saving={savingId === p.userId} onChange={changeRole} />
              <ResetButton person={p} onClick={() => setResetting(p)} />
            </div>
          </li>
        ))}
      </ul>

      {/* ≥768px: table */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-chrome/60 font-mono text-[10px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="hidden px-5 py-3 font-semibold xl:table-cell">Sign-in</th>
                <th className="hidden px-5 py-3 font-semibold xl:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p) => (
                <tr key={p.userId} className="hover:bg-panel-2/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar profile={{ ...p, phone: null, avatarUrl: null }} />
                      <span className="font-medium">
                        {p.name}
                        {p.userId === viewer?.userId && <span className="ml-1 text-xs text-dim">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{p.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
              <RoleSelect person={p} self={p.userId === viewer?.userId} saving={savingId === p.userId} onChange={changeRole} />
              <ResetButton person={p} onClick={() => setResetting(p)} />
            </div>
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted xl:table-cell">
                    {p.hasPassword ? (
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="size-3" /> Password
                      </span>
                    ) : (
                      "Federated"
                    )}
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted xl:table-cell">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {people && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <Users className="mx-auto size-10 text-dim" />
          <p className="mt-3 text-sm text-muted">No users match.</p>
        </div>
      )}

      <section className="card p-4 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
          <Shield className="size-5 text-neon" /> Role-based access
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PERMISSIONS.map((item) => (
            <div key={item.role} className={cn("rounded-xl p-4 ring-1", ROLE_TONE[item.role])}>
              <h3 className="mb-2 text-sm font-bold">{roleLabel(item.role)}</h3>
              <ul className="space-y-1 text-xs opacity-85">
                {item.perms.map((perm) => (
                  <li key={perm}>• {perm}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RoleSelect({
  person,
  self,
  saving,
  onChange,
}: {
  person: PersonRow;
  self: boolean;
  saving: boolean;
  onChange: (person: PersonRow, role: UserRole) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={person.role}
        disabled={self || saving}
        onChange={(e) => void onChange(person, e.target.value as UserRole)}
        className="input min-h-10 w-auto py-1.5 text-xs disabled:opacity-60"
        aria-label={`Role for ${person.name}`}
        title={self ? "You cannot change your own role" : undefined}
      >
        {USER_ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {saving && <LoaderCircle className="size-4 animate-spin text-muted" />}
    </div>
  );
}

function ResetButton({ person, onClick }: { person: PersonRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-neon"
      aria-label={`Reset password for ${person.name}`}
      title="Reset password"
    >
      <KeyRound className="size-4" />
    </button>
  );
}

function ResetPasswordForm({
  person,
  self,
  onClose,
  onDone,
}: {
  person: PersonRow;
  self: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await resetPassword({ data: { userId: person.userId, password } });
      toast.success(
        self ? "Your password was changed" : `Password reset for ${person.name}. They were signed out everywhere.`,
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5" aria-label={`Reset password for ${person.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Reset password</h2>
          <p className="truncate text-sm text-muted">
            {person.name} · {person.email ?? "no email"}
          </p>
        </div>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel-2" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">New password (min. 8 characters)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />
        </label>
        <label>
          <span className="field-label">Confirm new password</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" autoComplete="new-password" />
        </label>
      </div>
      {!self && <p className="text-xs text-dim">They'll be signed out on every device and must use the new password.</p>}
      {error && (
        <p className="text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-neon">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Set new password
        </button>
      </div>
    </form>
  );
}

function CreateAccountForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Enter the person's name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Temporary password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await createAccount({ data: { name: name.trim(), email: email.trim(), password, role } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Account created for ${email.trim()}`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5" aria-label="New account">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">New account</h2>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel-2" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="off" />
        </label>
        <label>
          <span className="field-label">Email</span>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            autoComplete="off"
          />
        </label>
        <label>
          <span className="field-label">Temporary password (min. 8 characters)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="new-password"
          />
        </label>
        <label>
          <span className="field-label">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input">
            {USER_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-neon">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create account
        </button>
      </div>
    </form>
  );
}
