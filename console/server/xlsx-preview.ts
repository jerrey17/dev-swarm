// xlsx 预览：只读单元格文本（共享字符串 / 缓存值），不计算公式、不读图表。
// zip 仅支持 store 与 deflate，供 /sheet 端点把表格变成 JSON。
import { inflateRawSync } from "node:zlib";

export interface SheetGrid {
  name: string;
  rows: string[][];
  truncated: boolean;
}

const MAX_ROWS = 500;
const MAX_COLS = 40;

export function unzipEntries(buf: Buffer): Map<string, Buffer> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  if (count === 0xffff) throw new Error("zip64 not supported");
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (flags & 0x1) throw new Error("encrypted zip not supported");
    const nameLenLocal = buf.readUInt16LE(localOff + 26);
    const extraLenLocal = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + nameLenLocal + extraLenLocal;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? Buffer.from(comp) : method === 8 ? inflateRawSync(comp) : null;
    if (!data) throw new Error(`unsupported zip method ${method}`);
    out.set(name, data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<(?:[\w]+:)?si\b[\s\S]*?<\/(?:[\w]+:)?si>/g) ?? []) {
    const texts = [...si.matchAll(/<(?:[\w]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/g)].map((m) => decodeXml(m[1]));
    out.push(texts.join("").trim());
  }
  return out;
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function trimGrid(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].every((c) => !c.trim())) end -= 1;
  const kept = rows.slice(0, end);
  if (!kept.length) return [];
  const width = kept.reduce((m, r) => Math.max(m, r.length), 0);
  const grid = kept.map((r) => {
    const copy = r.slice(0, width);
    while (copy.length < width) copy.push("");
    return copy;
  });
  let first = 0;
  while (first < width && grid.every((r) => !r[first].trim())) first += 1;
  let last = width;
  while (last > first && grid.every((r) => !r[last - 1].trim())) last -= 1;
  return grid.map((r) => r.slice(first, last).map((c) => c.trim()));
}

function sheetRows(xml: string, strings: readonly string[]): { rows: string[][]; truncated: boolean } {
  const raw: string[][] = [];
  let truncated = false;
  const rowXml = xml.match(/<(?:[\w]+:)?row\b[\s\S]*?<\/(?:[\w]+:)?row>/g) ?? [];
  for (const row of rowXml) {
    if (raw.length >= MAX_ROWS) { truncated = true; break; }
    const line: string[] = [];
    let colCut = false;
    for (const cell of row.match(/<(?:[\w]+:)?c\b(?:[^>]*\/>|[\s\S]*?<\/(?:[\w]+:)?c>)/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/i.exec(cell)?.[1] ?? "";
      const col = ref ? colIndex(ref) : line.length;
      if (col >= MAX_COLS) { colCut = true; continue; }
      while (line.length < col) line.push("");
      const type = /\bt="([^"]+)"/.exec(cell)?.[1] ?? "";
      const inline = [...cell.matchAll(/<(?:[\w]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/g)].map((m) => decodeXml(m[1])).join("");
      const value = /<(?:[\w]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?v>/.exec(cell)?.[1] ?? "";
      let text = inline;
      if (!text) {
        if (type === "s") text = strings[Number(value)] ?? "";
        else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
        else text = decodeXml(value);
      }
      line[col] = text;
    }
    if (colCut) truncated = true;
    raw.push(line);
  }
  return { rows: trimGrid(raw), truncated };
}

export function previewXlsx(buf: Buffer): SheetGrid[] {
  const files = unzipEntries(buf);
  const book = files.get("xl/workbook.xml")?.toString("utf8");
  if (!book) throw new Error("missing workbook");
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const relMap = new Map<string, string>();
  for (const rel of rels.match(/<Relationship\b[^>]*\/>/g) ?? []) {
    const id = /\bId="([^"]+)"/.exec(rel)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(rel)?.[1];
    if (!id || !target) continue;
    relMap.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const sheets: SheetGrid[] = [];
  for (const tag of book.match(/<(?:[\w]+:)?sheet\b[^>]*\/>/g) ?? []) {
    const name = /\bname="([^"]*)"/.exec(tag)?.[1] ?? "Sheet";
    const rid = /\br:id="([^"]+)"/.exec(tag)?.[1] ?? "";
    const path = relMap.get(rid);
    const xml = path ? files.get(path)?.toString("utf8") ?? "" : "";
    const parsed = sheetRows(xml, strings);
    sheets.push({ name: decodeXml(name), rows: parsed.rows, truncated: parsed.truncated });
  }
  return sheets;
}
