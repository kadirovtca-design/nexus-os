import Link from "next/link";

export default function NotFound() {
  return (
    <div className="canvas-glow grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-accent-2">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">This page drifted out of orbit</h1>
        <p className="mt-2 text-sm text-fg-subtle">The page you’re looking for doesn’t exist.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white">Back to dashboard</Link>
      </div>
    </div>
  );
}
