import { Fragment, type ReactNode } from "react";

/** Minimal, safe markdown → React (no HTML injection): headings, lists, bold, italics, inline code. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = (k: number) => {
    if (!list) return;
    const L = list.type;
    blocks.push(
      <L key={`l${k}`}>
        {list.items.map((it, j) => <li key={j}>{inline(it, `li${k}-${j}`)}</li>)}
      </L>,
    );
    list = null;
  };
  lines.forEach((raw, k) => {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (list && list.type !== type) flush(k);
      if (!list) list = { type, items: [] };
      list.items.push((ul ?? ol)![1]!);
      return;
    }
    flush(k);
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = (`h${h[1]!.length}` as "h1" | "h2" | "h3");
      blocks.push(<Tag key={k}>{inline(h[2]!, `h${k}`)}</Tag>);
    } else if (line.trim() === "---") {
      blocks.push(<hr key={k} className="my-3 border-line" />);
    } else if (line.trim()) {
      blocks.push(<p key={k}>{inline(line, `p${k}`)}</p>);
    }
  });
  flush(lines.length);
  return <div className="prose-nexus text-[14px] leading-relaxed text-fg-muted">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
