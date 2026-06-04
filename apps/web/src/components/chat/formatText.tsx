import { ReactNode } from 'react';

type Tag = 'b' | 'i' | 'u';
const EL: Record<Tag, 'strong' | 'em' | 'u'> = { b: 'strong', i: 'em', u: 'u' };

export function formatText(text: string): ReactNode[] {
  return parse(text, 0, null).nodes;
}

function parse(text: string, start: number, until: Tag | null) {
  const nodes: ReactNode[] = [];
  let buffer = '';
  let i = start;
  let key = 0;
  const flush = () => { if (buffer) { nodes.push(buffer); buffer = ''; } };

  while (i < text.length) {
    if (until && text.startsWith(`</${until}>`, i)) {
      flush();
      return { nodes, end: i + until.length + 3 };
    }
    const open = matchOpen(text, i);
    if (open) {
      flush();
      const inner = parse(text, i + 3, open);
      const Tag = EL[open];
      nodes.push(<Tag key={key++}>{inner.nodes}</Tag>);
      i = inner.end;
      continue;
    }
    buffer += text[i];
    i++;
  }
  flush();
  return { nodes, end: i };
}

function matchOpen(text: string, i: number): Tag | null {
  for (const t of ['b', 'i', 'u'] as Tag[]) {
    if (text.startsWith(`<${t}>`, i)) return t;
  }
  return null;
}
