// SQL 预览分词：注释 / 字符串里的关键字保持原样，供 CodePreview 上色。不改原文。

export type SqlKind = 'text' | 'keyword' | 'string' | 'comment' | 'number';
export interface SqlSpan { kind: SqlKind; text: string }

const KEYWORDS = new Set(
  `add after alter and as asc auto_increment before between bigint by cascade case char character
   charset collate column comment constraint create current_timestamp database default delete desc
   distinct drop engine exists from group having if ignore in index inner insert int integer into
   is join key left like limit not null on or order outer primary rename replace right select set
   table then tinyint timestamp unique unsigned update using values varchar when where with`
    .split(/\s+/)
    .filter(Boolean),
);

function push(out: SqlSpan[], kind: SqlKind, text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ kind, text });
}

export function tokenizeSql(source: string): SqlSpan[] {
  const out: SqlSpan[] = [];
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('--', i) || source[i] === '#') {
      const nl = source.indexOf('\n', i);
      const end = nl === -1 ? source.length : nl;
      push(out, 'comment', source.slice(i, end));
      i = end;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      const to = end === -1 ? source.length : end + 2;
      push(out, 'comment', source.slice(i, to));
      i = to;
      continue;
    }
    const quote = source[i];
    if (quote === "'" || quote === '"') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === quote && source[j + 1] === quote) { j += 2; continue; }
        if (source[j] === quote) { j += 1; break; }
        j += 1;
      }
      push(out, 'string', source.slice(i, j));
      i = j;
      continue;
    }
    if (quote === '`') {
      const end = source.indexOf('`', i + 1);
      const to = end === -1 ? source.length : end + 1;
      push(out, 'text', source.slice(i, to));
      i = to;
      continue;
    }
    if (/[0-9]/.test(source[i]) && (i === 0 || !/[A-Za-z0-9_]/.test(source[i - 1]))) {
      let j = i + 1;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      push(out, 'number', source.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(source[i])) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j += 1;
      const word = source.slice(i, j);
      push(out, KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'text', word);
      i = j;
      continue;
    }
    push(out, 'text', source[i]);
    i += 1;
  }
  return out;
}

/** 按行切开，供行号对齐。去掉文件末尾那一个换行，避免多出空行。 */
export function sqlLines(source: string): SqlSpan[][] {
  if (source.length === 0) return [];
  const lines: SqlSpan[][] = [[]];
  for (const span of tokenizeSql(source)) {
    const parts = span.text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part.length) lines[lines.length - 1].push({ kind: span.kind, text: part });
    });
  }
  if (source.endsWith('\n') && lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }
  return lines;
}
