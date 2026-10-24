// YAML 预览分词：键、字符串、注释、布尔和数字上色。按行切，不改原文。

export type YamlKind = 'text' | 'keyword' | 'string' | 'comment' | 'number' | 'key';
export interface YamlSpan { kind: YamlKind; text: string }

const BOOL = /^(true|false|yes|no|on|off|null|~)$/i;
const NUM = /^[+-]?(?:\d+\.\d+|\d+)(?:e[+-]?\d+)?$/i;

function takeQuoted(body: string, q: "'" | '"'): string {
  let j = 1;
  while (j < body.length) {
    if (q === "'" && body[j] === "'" && body[j + 1] === "'") { j += 2; continue; }
    if (q === '"' && body[j] === '\\') { j += 2; continue; }
    if (body[j] === q) return body.slice(0, j + 1);
    j += 1;
  }
  return body;
}

function pushValue(spans: YamlSpan[], body: string) {
  let i = 0;
  while (i < body.length && (body[i] === ' ' || body[i] === '\t')) i += 1;
  if (i) spans.push({ kind: 'text', text: body.slice(0, i) });
  const rest = body.slice(i);
  if (!rest) return;
  if (rest.startsWith('#')) {
    spans.push({ kind: 'comment', text: rest });
    return;
  }
  if (rest[0] === '"' || rest[0] === "'") {
    const quoted = takeQuoted(rest, rest[0]);
    spans.push({ kind: 'string', text: quoted });
    pushValue(spans, rest.slice(quoted.length));
    return;
  }
  const hash = rest.search(/[ \t]#/);
  const scalar = hash === -1 ? rest : rest.slice(0, hash);
  const trimmed = scalar.trimEnd();
  const pad = scalar.slice(trimmed.length);
  if (BOOL.test(trimmed)) spans.push({ kind: 'keyword', text: trimmed });
  else if (NUM.test(trimmed)) spans.push({ kind: 'number', text: trimmed });
  else if (trimmed) spans.push({ kind: 'text', text: trimmed });
  if (pad) spans.push({ kind: 'text', text: pad });
  if (hash !== -1) {
    spans.push({ kind: 'text', text: rest.slice(hash, rest.indexOf('#', hash)) });
    spans.push({ kind: 'comment', text: rest.slice(rest.indexOf('#', hash)) });
  }
}

function highlightLine(line: string): YamlSpan[] {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
  let rest = line.slice(indent.length);
  const spans: YamlSpan[] = [];
  if (indent) spans.push({ kind: 'text', text: indent });
  if (!rest) return spans;

  if (rest === '---' || rest === '...' || rest.startsWith('--- ') || rest.startsWith('... ')) {
    const marker = rest.startsWith('---') ? '---' : '...';
    spans.push({ kind: 'keyword', text: marker });
    pushValue(spans, rest.slice(marker.length));
    return spans;
  }
  if (rest.startsWith('- ') || rest === '-') {
    const dash = rest.startsWith('- ') ? '- ' : '-';
    spans.push({ kind: 'text', text: dash });
    rest = rest.slice(dash.length);
  }
  if (rest.startsWith('#')) {
    spans.push({ kind: 'comment', text: rest });
    return spans;
  }
  const key = /^("(?:\\.|[^"\n])*"|'(?:''|[^'\n])*'|[^\s:#][^:#]*):(?=\s|$)/.exec(rest);
  if (key) {
    spans.push({ kind: 'key', text: key[1] });
    spans.push({ kind: 'text', text: ':' });
    pushValue(spans, rest.slice(key[0].length));
    return spans;
  }
  pushValue(spans, rest);
  return spans;
}

/** 去掉文件末尾那一个换行，避免多出空行。 */
export function yamlLines(source: string): YamlSpan[][] {
  if (source.length === 0) return [];
  const parts = source.split('\n');
  if (source.endsWith('\n')) parts.pop();
  return parts.map(highlightLine);
}
