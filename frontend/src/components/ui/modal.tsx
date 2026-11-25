"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useIsClient } from "@/lib/hooks";
import { cn } from "@/lib/utils";

import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select");
      (target ?? panel.current)?.focus();
    }, 30);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-surface shadow-pop outline-none sm:rounded-2xl",
              widths[size],
            )}
          >
            {title ? (
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
                  {description ? <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p> : null}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                  <X />
                </Button>
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-bg-subtle/50 px-5 py-3">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────── Confirmation dialogs (promise-based) ───────── */
interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  /** Optional checkbox, e.g. "also delete tasks". Its value is returned. */
  checkbox?: string;
}
type ConfirmResult = false | { checked: boolean };

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<ConfirmResult>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const [checked, setChecked] = useState(false);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        setChecked(false);
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (r: ConfirmResult) => {
    state?.resolve(r);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} size="sm">
        {state ? (
          <div className="pt-1">
            <div className="flex gap-3.5">
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  state.tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
                )}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-fg">{state.title}</h2>
                {state.description ? <div className="mt-1 text-[13px] leading-relaxed text-fg-subtle">{state.description}</div> : null}
                {state.checkbox ? (
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="accent-[var(--accent)]" />
                    {state.checkbox}
                  </label>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button
                data-autofocus
                variant={state.tone === "danger" ? "danger" : "primary"}
                onClick={() => close({ checked })}
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
