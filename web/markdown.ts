/* Markdown, built as DOM nodes so session text cannot inject markup. */
import { el } from "./util.js";

/** Called when the reader clicks a link to another session. */
export type OpenSession = (id: string) => void;

function inline(parent: HTMLElement, text: string, open: OpenSession): void {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  for (const part of parts) {
    if (!part) continue;
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      parent.append(el("code", { text: part.slice(1, -1) }));
    } else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const strong = el("strong");
      inline(strong, part.slice(2, -2), open);
      parent.append(strong);
    } else if (linkMatch && /^https?:\/\//.test(linkMatch[2])) {
      parent.append(el("a", { href: linkMatch[2], target: "_blank", rel: "noopener noreferrer", text: linkMatch[1] }));
    } else if (linkMatch && /^#local_[0-9a-f-]{36}$/.test(linkMatch[2])) {
      const target = linkMatch[2].slice(1);
      const btn = el("button", { type: "button", class: "sess", text: linkMatch[1] });
      btn.onclick = (e) => { e.stopPropagation(); open(target); };
      parent.append(btn);
    } else if (linkMatch) {
      parent.append(linkMatch[1]);
    } else {
      parent.append(part);
    }
  }
}

const LIST = /^\s*([-*]|\d+[.)])\s+/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;

export function md(text: string, open: OpenSession): HTMLElement {
  const body = el("div", { class: "body" });
  const lines = text.replace(/\r/g, "").split("\n");
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      const pre = el("pre");
      pre.append(el("code", { text: code.join("\n") }));
      body.append(pre);
    } else if (/^\s*\|/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const table = el("table");
      const hasHead = rows.length > 1 && /^[\s|:-]+$/.test(rows[1]);
      rows.forEach((row, n) => {
        if (hasHead && n === 1) return;
        const tr = el("tr");
        cells(row).forEach((cell) => {
          const td = el(hasHead && n === 0 ? "th" : "td");
          inline(td, cell, open);
          tr.append(td);
        });
        table.append(tr);
      });
      body.append(table);
    } else if (RULE.test(line)) {
      body.append(el("hr"));
      i++;
    } else if (/^#{1,6}\s/.test(line)) {
      const h = el("h4");
      inline(h, line.replace(/^#{1,6}\s+/, ""), open);
      body.append(h);
      i++;
    } else if (LIST.test(line)) {
      const list = el(/^\s*\d/.test(line) ? "ol" : "ul");
      while (i < lines.length && LIST.test(lines[i])) {
        const li = el("li");
        inline(li, lines[i++].replace(LIST, ""), open);
        list.append(li);
      }
      body.append(list);
    } else if (/^\s*>/.test(line)) {
      const quote = el("blockquote");
      const said: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) said.push(lines[i++].replace(/^\s*>\s?/, ""));
      inline(quote, said.join(" "), open);
      body.append(quote);
    } else if (!line.trim()) {
      i++;
    } else {
      const p = el("p");
      let first = true;
      while (i < lines.length && lines[i].trim() && !/^\s*(```|\||#{1,6}\s|>)/.test(lines[i]) && !LIST.test(lines[i]) && !RULE.test(lines[i])) {
        if (!first) p.append(el("br"));
        inline(p, lines[i++], open);
        first = false;
      }
      if (first) inline(p, lines[i++], open);
      body.append(p);
    }
  }
  return body;
}
