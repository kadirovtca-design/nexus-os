"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { qk, useMe } from "@/lib/queries";
import type { User } from "@/lib/types";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  useEffect(() => {
    if (me.data) router.replace(dest);
  }, [me.data, router, dest]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setFields({});
    setLoading(true);
    try {
      const body: Record<string, unknown> = { email: form.get("email"), password: form.get("password") };
      if (mode === "register") {
        body.name = form.get("name");
        body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      const user = await api<User>(`/auth/${mode}`, { method: "POST", body });
      qc.setQueryData(qk.me, user);
      router.replace(dest);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.fields ? null : err.message);
        setFields(err.fields ?? {});
      } else setError("Network error — is the API running?");
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="border-flow rounded-3xl"><div className="rounded-3xl border border-line bg-surface/70 p-7 shadow-pop backdrop-blur-xl sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-fg">{isLogin ? "Welcome back" : "Create your workspace"}</h2>
      <p className="mt-1.5 text-sm text-fg-subtle">
        {isLogin ? "Sign in to continue to NEXUS OS." : "It takes less than a minute. No credit card."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {!isLogin ? (
          <Field label="Full name" htmlFor="name" error={fields.name}>
            <Input id="name" name="name" autoComplete="name" required icon={<UserIcon />} placeholder="Alex Morgan" aria-invalid={!!fields.name} />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email" error={fields.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required icon={<Mail />} placeholder="you@company.com" aria-invalid={!!fields.email} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={fields.password}
          hint={!isLogin ? "At least 8 characters, with a letter and a number." : undefined}
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={isLogin ? 1 : 8}
              icon={<Lock />}
              placeholder="••••••••"
              className="pr-10"
              aria-invalid={!!fields.password}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-subtle hover:text-fg"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {error ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
            {error}
          </motion.p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {isLogin ? "Sign in" : "Create account"}
          {!loading ? <ArrowRight /> : null}
        </Button>
      </form>

      <p className="mt-8 text-center text-[13px] text-fg-subtle">
        {isLogin ? "New to NEXUS OS? " : "Already have an account? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-fg hover:text-accent-2">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div></motion.div>
  );
}
