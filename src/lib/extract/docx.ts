import JSZip from "jszip";

/**
 * Turns a .docx into plain lines the parser understands. Read straight from
 * the Word XML (not via an HTML converter) because Word's automatic list
 * numbering — the "1." before a question and the "a." before a choice — only
 * exists in numbering.xml, and teachers rely on it. A paragraph that is
 * bold, underlined or highlighted from end to end is wrapped in **…** so a
 * single emphasised choice can be read as the correct answer.
 */

type Level = { numFmt: string; lvlText: string; start: number };

export async function docxToText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("This Word file has no document body.");
  const numberingXml = (await zip.file("word/numbering.xml")?.async("string")) ?? "";

  const numbering = readNumbering(numberingXml);
  const counters = new Map<string, number[]>();
  const lines: string[] = [];

  const body = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? documentXml;
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    const { text, emphasised } = readRuns(p);
    let label = "";

    const numId = p.match(/<w:numId w:val="(\d+)"/)?.[1];
    const ilvl = Number(p.match(/<w:ilvl w:val="(\d+)"/)?.[1] ?? 0);
    if (numId && numId !== "0" && numbering.has(numId)) {
      const levels = numbering.get(numId)!;
      const count = counters.get(numId) ?? [];
      count[ilvl] = (count[ilvl] ?? (levels[ilvl]?.start ?? 1) - 1) + 1;
      count.length = ilvl + 1; // deeper levels restart after this item
      counters.set(numId, count);
      label = formatLabel(levels, count, ilvl);
    }

    if (!text.trim()) continue;
    const content = emphasised ? `**${text.trim()}**` : text.trim();
    lines.push(label ? `${label} ${content}` : content);
  }

  return lines.join("\n");
}

function readRuns(paragraphXml: string): { text: string; emphasised: boolean } {
  let text = "";
  let emphasisedChars = 0;
  let totalChars = 0;

  for (const run of paragraphXml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const props = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
    const pieces: string[] = [];
    for (const m of run.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      pieces.push(m[1] !== undefined ? decodeXml(m[1]) : " ");
    }
    const runText = pieces.join("");
    text += runText;

    const visible = runText.replace(/\s/g, "").length;
    totalChars += visible;
    if (isOn(props, "b") || isOn(props, "u") || /<w:highlight w:val="(?!none)/.test(props)) {
      emphasisedChars += visible;
    }
  }

  return { text, emphasised: totalChars > 0 && emphasisedChars === totalChars };
}

function isOn(props: string, tag: string): boolean {
  const m = props.match(new RegExp(`<w:${tag}(?: w:val="([^"]*)")?\\s*/>`));
  if (!m) return false;
  return !["0", "false", "none"].includes((m[1] ?? "true").toLowerCase());
}

function readNumbering(xml: string): Map<string, Level[]> {
  const abstract = new Map<string, Level[]>();
  for (const a of xml.match(/<w:abstractNum [\s\S]*?<\/w:abstractNum>/g) ?? []) {
    const id = a.match(/w:abstractNumId="(\d+)"/)?.[1];
    if (!id) continue;
    const levels: Level[] = [];
    for (const lvl of a.match(/<w:lvl [\s\S]*?<\/w:lvl>/g) ?? []) {
      const ilvl = Number(lvl.match(/w:ilvl="(\d+)"/)?.[1] ?? 0);
      levels[ilvl] = {
        numFmt: lvl.match(/<w:numFmt w:val="([^"]+)"/)?.[1] ?? "decimal",
        lvlText: lvl.match(/<w:lvlText w:val="([^"]*)"/)?.[1] ?? `%${ilvl + 1}.`,
        start: Number(lvl.match(/<w:start w:val="(\d+)"/)?.[1] ?? 1),
      };
    }
    abstract.set(id, levels);
  }

  const nums = new Map<string, Level[]>();
  for (const n of xml.match(/<w:num w:numId="\d+"[\s\S]*?<\/w:num>/g) ?? []) {
    const numId = n.match(/w:numId="(\d+)"/)?.[1];
    const abstractId = n.match(/<w:abstractNumId w:val="(\d+)"/)?.[1];
    if (!numId || !abstractId || !abstract.has(abstractId)) continue;
    const levels = abstract.get(abstractId)!.map((l) => ({ ...l }));
    for (const o of n.match(/<w:lvlOverride [\s\S]*?<\/w:lvlOverride>/g) ?? []) {
      const ilvl = Number(o.match(/w:ilvl="(\d+)"/)?.[1] ?? 0);
      const start = o.match(/<w:startOverride w:val="(\d+)"/)?.[1];
      if (start && levels[ilvl]) levels[ilvl].start = Number(start);
    }
    nums.set(numId, levels);
  }
  return nums;
}

function formatLabel(levels: Level[], count: number[], ilvl: number): string {
  const level = levels[ilvl];
  if (!level || level.numFmt === "bullet" || level.numFmt === "none") return "";
  return level.lvlText.replace(/%(\d)/g, (_, n) => {
    const i = Number(n) - 1;
    return formatNumber(count[i] ?? levels[i]?.start ?? 1, levels[i]?.numFmt ?? "decimal");
  });
}

function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case "lowerLetter":
      return toLetters(n).toLowerCase();
    case "upperLetter":
      return toLetters(n);
    case "lowerRoman":
      return toRoman(n).toLowerCase();
    case "upperRoman":
      return toRoman(n);
    default:
      return String(n);
  }
}

function toLetters(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let s = "";
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
