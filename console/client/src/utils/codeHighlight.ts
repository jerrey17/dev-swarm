// 代码预览分词：注释 / 字符串里的关键字保持原样。按语言配置，不改原文。

export type CodeKind = 'text' | 'keyword' | 'string' | 'comment' | 'number' | 'key';
export interface CodeSpan { kind: CodeKind; text: string }

export type CodeLang =
  | 'python' | 'java' | 'proto' | 'javascript' | 'typescript'
  | 'shell' | 'json' | 'xml' | 'css' | 'properties' | 'vue';

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

interface Profile {
  line: readonly string[];
  /** # 在标识符后面也是注释（Python）。Shell / properties 只在空白之后。 */
  hashAnywhere: boolean;
  block?: readonly [string, string];
  keywords: ReadonlySet<string>;
  triple: boolean;
  prefixed: boolean;
  tags: boolean;
  stringKey: boolean;
  wordKey: readonly string[];
}

const PY = words('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None');
const JAVA = words('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits');
const JS = words('async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null return static super switch this throw true try typeof undefined var void while with yield of');
const TS = words(`${[...JS].join(' ')} type interface implements namespace declare readonly public private protected abstract enum as satisfies keyof infer`);
const PROTO = words('syntax package import option message enum service rpc returns repeated optional required oneof map reserved extend extensions to stream bool string bytes int32 int64 uint32 uint64 sint32 sint64 fixed32 fixed64 sfixed32 sfixed64 float double true false');
const SH = words('if then fi else elif for while do done case esac function return local export unset readonly declare typeset');

const PROFILES: Record<CodeLang, Profile> = {
  python: { line: ['#'], hashAnywhere: true, keywords: PY, triple: true, prefixed: true, tags: false, stringKey: false, wordKey: [] },
  java: { line: ['//'], hashAnywhere: false, block: ['/*', '*/'], keywords: JAVA, triple: true, prefixed: false, tags: false, stringKey: false, wordKey: [] },
  proto: { line: ['//'], hashAnywhere: false, block: ['/*', '*/'], keywords: PROTO, triple: false, prefixed: false, tags: false, stringKey: false, wordKey: [] },
  javascript: { line: ['//'], hashAnywhere: false, block: ['/*', '*/'], keywords: JS, triple: false, prefixed: false, tags: false, stringKey: false, wordKey: [] },
  typescript: { line: ['//'], hashAnywhere: false, block: ['/*', '*/'], keywords: TS, triple: false, prefixed: false, tags: false, stringKey: false, wordKey: [] },
  shell: { line: ['#'], hashAnywhere: false, keywords: SH, triple: false, prefixed: false, tags: false, stringKey: false, wordKey: [] },
  json: { line: [], hashAnywhere: false, keywords: words('true false null'), triple: false, prefixed: false, tags: false, stringKey: true, wordKey: [] },
  xml: { line: [], hashAnywhere: false, block: ['<!--', '-->'], keywords: words(''), triple: false, prefixed: false, tags: true, stringKey: false, wordKey: [] },
  vue: { line: ['//'], hashAnywhere: false, block: ['<!--', '-->'], keywords: JS, triple: false, prefixed: false, tags: true, stringKey: false, wordKey: [] },
  css: { line: [], hashAnywhere: false, block: ['/*', '*/'], keywords: words('@media @import @charset important'), triple: false, prefixed: false, tags: false, stringKey: false, wordKey: [':'] },
  properties: { line: ['#', '!'], hashAnywhere: false, keywords: words(''), triple: false, prefixed: false, tags: false, stringKey: false, wordKey: ['=', ':'] },
};

export const CODE_EXT: Record<string, CodeLang> = {
  '.py': 'python',
  '.java': 'java',
  '.proto': 'proto',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.sh': 'shell',
  '.json': 'json',
  '.xml': 'xml',
  '.vue': 'vue',
  '.css': 'css',
  '.properties': 'properties',
};

export function codeLangOf(ext: string): CodeLang | null {
  return CODE_EXT[ext] ?? null;
}

function push(out: CodeSpan[], kind: CodeKind, text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ kind, text });
}

function quoteAt(source: string, i: number, profile: Profile): { start: number; q: string } | null {
  let p = i;
  if (profile.prefixed) {
    let k = 0;
    while (k < 2 && /[rRfFbBuU]/.test(source[p + k] ?? '')) k += 1;
    if (k > 0 && (source[p + k] === '"' || source[p + k] === "'")) p += k;
    else if (k > 0) return null;
  }
  if (profile.triple && (source.startsWith('"""', p) || source.startsWith("'''", p))) {
    return { start: i, q: source.slice(p, p + 3) };
  }
  if (source[p] === '"' || source[p] === "'") return { start: i, q: source[p] };
  return null;
}

function takeString(source: string, quoteAtIndex: number, q: string, doubleSingle: boolean): number {
  let j = quoteAtIndex + q.length;
  while (j < source.length) {
    if (q.length === 1 && source[j] === '\\') { j += 2; continue; }
    if (doubleSingle && q === "'" && source[j] === "'" && source[j + 1] === "'") { j += 2; continue; }
    if (source.startsWith(q, j)) return j + q.length;
    j += 1;
  }
  return source.length;
}

function markKeys(out: CodeSpan[], profile: Profile) {
  const seps = profile.stringKey ? [':'] : profile.wordKey;
  if (!seps.length) return;
  const accept = profile.stringKey ? 'string' : 'text';
  for (let n = 0; n < out.length; n++) {
    if (out[n].kind !== accept) continue;
    if (accept === 'text' && !/^[@A-Za-z_][\w-]*$/.test(out[n].text)) continue;
    let k = n + 1;
    while (k < out.length && out[k].kind === 'text' && /^[ \t]*$/.test(out[k].text)) k += 1;
    if (k < out.length && seps.some((sep) => out[k].text.startsWith(sep))) out[n].kind = 'key';
  }
}

function tokenize(source: string, profile: Profile): CodeSpan[] {
  const out: CodeSpan[] = [];
  let i = 0;
  while (i < source.length) {
    if (profile.block && source.startsWith(profile.block[0], i)) {
      const end = source.indexOf(profile.block[1], i + profile.block[0].length);
      const to = end === -1 ? source.length : end + profile.block[1].length;
      push(out, 'comment', source.slice(i, to));
      i = to;
      continue;
    }
    const lineMark = profile.line.find((mark) => source.startsWith(mark, i));
    const freeLine = lineMark !== undefined && lineMark !== '#' && lineMark !== '!';
    if (lineMark && (freeLine || profile.hashAnywhere || i === 0 || /\s/.test(source[i - 1]))) {
      const nl = source.indexOf('\n', i);
      const end = nl === -1 ? source.length : nl;
      push(out, 'comment', source.slice(i, end));
      i = end;
      continue;
    }
    const quoted = quoteAt(source, i, profile);
    if (quoted) {
      const quoteIndex = source.indexOf(quoted.q, quoted.start);
      const end = takeString(source, quoteIndex, quoted.q, profile.prefixed);
      push(out, 'string', source.slice(quoted.start, end));
      i = end;
      continue;
    }
    if (profile.tags && source[i] === '<') {
      push(out, 'text', '<');
      i += 1;
      if (source[i] === '/') { push(out, 'text', '/'); i += 1; }
      let j = i;
      while (j < source.length && /[A-Za-z0-9_:.-]/.test(source[j])) j += 1;
      if (j > i) push(out, 'key', source.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(source[i]) && (i === 0 || !/[A-Za-z0-9_]/.test(source[i - 1]))) {
      let j = i + 1;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      push(out, 'number', source.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$@]/.test(source[i])) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_$-]/.test(source[j])) j += 1;
      const word = source.slice(i, j);
      push(out, profile.keywords.has(word) ? 'keyword' : 'text', word);
      i = j;
      continue;
    }
    push(out, 'text', source[i]);
    i += 1;
  }
  markKeys(out, profile);
  return out;
}

export function codeLines(source: string, lang: CodeLang): CodeSpan[][] {
  if (source.length === 0) return [];
  const lines: CodeSpan[][] = [[]];
  for (const span of tokenize(source, PROFILES[lang])) {
    const parts = span.text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part.length) lines[lines.length - 1].push({ kind: span.kind, text: part });
    });
  }
  if (source.endsWith('\n') && lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

export const CODE_LABEL: Record<CodeLang, string> = {
  python: 'PYTHON',
  java: 'JAVA',
  proto: 'PROTO',
  javascript: 'JAVASCRIPT',
  typescript: 'TYPESCRIPT',
  shell: 'SHELL',
  json: 'JSON',
  xml: 'XML',
  css: 'CSS',
  properties: 'PROPERTIES',
  vue: 'VUE',
};
