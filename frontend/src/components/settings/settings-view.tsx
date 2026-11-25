"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, Laptop, LogOut, Monitor, Moon, Palette, Shield, SlidersHorizontal, Sun, Trash2, User as UserIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api";
import { qk, useMe, useSessions } from "@/lib/queries";
import { applyTheme } from "@/lib/theme";
import type { Accent, Preferences, Theme, User } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "security", label: "Security", icon: Shield },
  { id: "account", label: "Account", icon: Trash2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const raw = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "profile";
  if (!me.data) return null;
  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, appearance and account." />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.replace(`${pathname}?tab=${t.id}`)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                tab === t.id ? "bg-surface-2 text-fg" : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {tab === "profile" ? <ProfileTab user={me.data} /> : null}
          {tab === "appearance" ? <AppearanceTab user={me.data} /> : null}
          {tab === "preferences" ? <PreferencesTab user={me.data} /> : null}
          {tab === "security" ? <SecurityTab /> : null}
          {tab === "account" ? <AccountTab user={me.data} /> : null}
        </div>
      </div>
    </>
  );
}

function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-line bg-bg-subtle/50 px-6 py-3">{footer}</div> : null}
    </Card>
  );
}

function usePrefs() {
  const qc = useQueryClient();
  return async (patch: Partial<Preferences>, msg = "Preferences saved") => {
    try {
      const u = await api<User>("/users/me/preferences", { method: "PATCH", body: patch });
      qc.setQueryData(qk.me, u);
      applyTheme(u.preferences.theme, u.preferences.accent);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    }
  };
}

function ProfileTab({ user }: { user: User }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setErrors({});
    try {
      const u = await api<User>("/users/me", { method: "PATCH", body: { name: f.get("name"), email: f.get("email") } });
      qc.setQueryData(qk.me, u);
      toast.success("Profile updated");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? { email: err.message });
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <Section title="Profile" description="How you appear across NEXUS OS." footer={<Button type="submit" variant="primary" loading={saving}>Save profile</Button>}>
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-xl font-semibold text-white">{initials(user.name)}</span>
          <div>
            <p className="font-medium text-fg">{user.name}</p>
            <p className="text-[13px] text-fg-subtle">Member since {format(parseISO(user.created_at), "MMMM yyyy")}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name}><Input name="name" defaultValue={user.name} maxLength={120} required /></Field>
          <Field label="Email" error={errors.email}><Input name="email" type="email" defaultValue={user.email} required /></Field>
        </div>
      </Section>
    </form>
  );
}

const ACCENTS: { id: Accent; color: string }[] = [
  { id: "violet", color: "#7c5cff" }, { id: "blue", color: "#3b82f6" }, { id: "cyan", color: "#06b6d4" },
  { id: "emerald", color: "#10b981" }, { id: "amber", color: "#f59e0b" }, { id: "rose", color: "#f43f5e" },
];

function AppearanceTab({ user }: { user: User }) {
  const save = usePrefs();
  const p = user.preferences;
  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ];
  return (
    <>
      <Section title="Theme" description="Choose how NEXUS OS looks to you.">
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button key={t.id} onClick={() => save({ theme: t.id }, "Theme updated")} className={cn("group rounded-xl border p-2 text-left transition-colors", p.theme === t.id ? "border-accent/60 ring-4 ring-accent/10" : "border-line hover:border-line-strong")}>
              <div className={cn("mb-2 h-20 overflow-hidden rounded-lg border border-line", t.id === "light" ? "bg-[#f4f4f5]" : t.id === "dark" ? "bg-[#09090b]" : "bg-gradient-to-r from-[#09090b] from-50% to-[#f4f4f5] to-50%")}>
                <div className="m-2 h-2 w-10 rounded bg-accent" />
                <div className={cn("mx-2 h-8 rounded", t.id === "light" ? "bg-white" : "bg-[#151518]")} />
              </div>
              <span className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-fg"><t.icon className="size-3.5" />{t.label}{p.theme === t.id ? <Check className="ml-auto size-3.5 text-accent" /> : null}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Accent color" description="Used for highlights, focus states and charts of your own data.">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => save({ accent: a.id }, "Accent updated")} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] capitalize transition-colors", p.accent === a.id ? "border-line-strong bg-surface-2 text-fg" : "border-line text-fg-subtle hover:text-fg")}>
              <span className="grid size-4 place-items-center rounded-full" style={{ background: a.color }}>{p.accent === a.id ? <Check className="size-2.5 text-white" strokeWidth={4} /> : null}</span>
              {a.id}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Layout">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-[13.5px] font-medium text-fg">Compact sidebar</span>
            <span className="block text-[13px] text-fg-subtle">Collapse navigation to icons on desktop.</span>
          </span>
          <Toggle checked={p.compact_sidebar} onChange={(v) => save({ compact_sidebar: v }).then(() => location.reload())} />
        </label>
      </Section>
    </>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "RUB", "KZT", "UZS", "TRY", "AED", "INR", "CNY", "BRL"];

function PreferencesTab({ user }: { user: User }) {
  const save = usePrefs();
  const p = user.preferences;
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [p.timezone];
    }
  }, [p.timezone]);
  const [form, setForm] = useState({ currency: p.currency, timezone: p.timezone, week_starts_on: p.week_starts_on });
  const dirty = form.currency !== p.currency || form.timezone !== p.timezone || form.week_starts_on !== p.week_starts_on;
  return (
    <Section title="Regional preferences" description="Affects dates, “today”, streaks and money formatting." footer={<Button variant="primary" disabled={!dirty} onClick={() => save(form)}>Save preferences</Button>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Currency">
          <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {Array.from(new Set([form.currency, ...CURRENCIES])).map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Timezone" hint={`Browser: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}>
          <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {Array.from(new Set(["UTC", ...zones])).map((z) => <option key={z}>{z}</option>)}
          </Select>
        </Field>
        <Field label="Week starts on">
          <Select value={form.week_starts_on} onChange={(e) => setForm({ ...form, week_starts_on: Number(e.target.value) as 0 | 1 })}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </Select>
        </Field>
      </div>
    </Section>
  );
}

function SecurityTab() {
  const sessions = useSessions();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("new_password") !== f.get("confirm")) return setErrors({ confirm: "Passwords don't match" });
    setSaving(true);
    setErrors({});
    try {
      await api("/users/me/password", { method: "POST", body: { current_password: f.get("current_password"), new_password: f.get("new_password") } });
      form.reset();
      toast.success("Password changed — other devices were signed out");
      qc.invalidateQueries({ queryKey: qk.sessions });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? { current_password: err.message });
    } finally {
      setSaving(false);
    }
  }
  async function revoke(id?: number) {
    await api(id ? `/users/me/sessions/${id}` : "/users/me/sessions/revoke-others", { method: id ? "DELETE" : "POST" });
    toast.success(id ? "Session revoked" : "Signed out of all other sessions");
    qc.invalidateQueries({ queryKey: qk.sessions });
  }
  return (
    <>
      <form onSubmit={change}>
        <Section title="Change password" description="At least 8 characters with a letter and a number." footer={<Button type="submit" variant="primary" loading={saving}>Update password</Button>}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password" error={errors.current_password}><Input name="current_password" type="password" autoComplete="current-password" required /></Field>
            <Field label="New password" error={errors.new_password}><Input name="new_password" type="password" autoComplete="new-password" minLength={8} required /></Field>
            <Field label="Confirm new password" error={errors.confirm}><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
          </div>
        </Section>
      </form>
      <Section title="Active sessions" description="Devices currently signed in to your account.">
        <ul className="divide-y divide-line">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-fg-subtle"><Laptop className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{describeAgent(s.user_agent)} {s.current ? <Badge tone="success" className="ml-1">This device</Badge> : null}</p>
                <p className="text-xs text-fg-subtle">{s.ip_address ?? "Unknown IP"} · last active {format(parseISO(s.last_seen_at), "MMM d, HH:mm")}</p>
              </div>
              {!s.current ? <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}><LogOut /> Revoke</Button> : null}
            </li>
          ))}
        </ul>
        {(sessions.data?.length ?? 0) > 1 ? <Button className="mt-4" size="sm" variant="danger" onClick={() => revoke()}>Sign out all other sessions</Button> : null}
      </Section>
    </>
  );
}

function describeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? ` on ${os}` : ""}`;
}

function AccountTab({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  async function remove() {
    setBusy(true);
    try {
      await api("/users/me", { method: "DELETE", body: { password: pw } });
      qc.clear();
      router.replace("/register");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete account");
      setBusy(false);
    }
  }
  return (
    <>
      <Section title="Danger zone" description="Permanently delete your account and every record in it: tasks, projects, transactions, goals, habits and events.">
        <Button variant="danger" onClick={() => setOpen(true)}><Trash2 /> Delete account</Button>
      </Section>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete account"
        description="This cannot be undone."
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} disabled={!pw || confirmText !== user.email} onClick={remove}>Delete forever</Button></>}
      >
        <div className="space-y-4">
          <Field label={`Type ${user.email} to confirm`}><Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></Field>
          <Field label="Password" error={error}><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
        </div>
      </Modal>
    </>
  );
}
