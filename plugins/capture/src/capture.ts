export type CaptureKind = "note" | "task";

export interface CaptureDraft {
  kind: CaptureKind;
  text: string;
  capturedAt: Date;
  headingLevel?: number;
  timeFormat?: "HH:mm" | "HH:mm:ss";
  scheduled?: string;
  due?: string;
}

export interface CaptureEntry {
  time: string;
  markdown: string;
  startLine: number;
  endLine: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function resolveCaptureKind(text: string, forceTask = false): CaptureKind {
  return forceTask || /^\s*[-+*]\s+\[[^\]]\]\s+/.test(text) ? "task" : "note";
}

export function formatCaptureLine(draft: CaptureDraft): string {
  const text = normalizeMultiline(draft.text);
  if (!text.trim()) throw new Error("Capture text is required.");

  const [firstLine = "", ...remainingLines] = text.split("\n");
  const time = formatLocalTime(draft.capturedAt, draft.timeFormat);
  const heading = `${"#".repeat(normalizeHeadingLevel(draft.headingLevel))} ${time}`;
  if (draft.kind === "note") {
    return [heading, firstLine, ...remainingLines].join("\n");
  }

  const scheduled = formatDateField("⏳", draft.scheduled);
  const due = formatDateField("📅", draft.due);
  const sourceTask = /^\s*[-+*]\s+\[[^\]]\]\s+/.test(firstLine);
  const task = sourceTask ? firstLine.trim() : `- [ ] ${firstLine.trim()}`;
  const taskLine = [task, scheduled, due].filter(Boolean).join(" ");
  return [heading, taskLine, ...remainingLines].join("\n");
}

export function dailyCapturePath(folder: string, capturedAt: Date, format = "YYYY-MM-DD"): string {
  const date = formatMomentDate(capturedAt, format);
  const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");
  return cleanFolder ? `${cleanFolder}/${date}.md` : `${date}.md`;
}

export function appendCaptureLine(content: string, line: string): string {
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  return `${content}${separator}${line}\n`;
}

export function appendCaptureUnderHeading(content: string, line: string, heading: string): string {
  const target = heading.trim().replace(/^#{1,6}\s+/, "");
  if (!target) return appendCaptureLine(content, line);

  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const headingIndex = lines.findIndex((candidate) => {
    const match = candidate.match(/^(#{1,6})\s+(.+?)\s*$/);
    return match?.[2] === target;
  });
  if (headingIndex < 0) throw new Error(`Daily Note heading not found: ${target}`);

  const level = lines[headingIndex]?.match(/^#+/)?.[0].length ?? 6;
  let insertionIndex = lines.findIndex((candidate, index) => index > headingIndex
    && new RegExp(`^#{1,${level}}\\s+`).test(candidate));
  if (insertionIndex < 0) insertionIndex = lines.length;
  while (insertionIndex > headingIndex + 1 && lines[insertionIndex - 1] === "") insertionIndex -= 1;
  lines.splice(insertionIndex, 0, ...line.split("\n"));
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

export function parseCaptureEntries(content: string, headingLevel = 6): CaptureEntry[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const marker = "#".repeat(normalizeHeadingLevel(headingLevel));
  const entries: CaptureEntry[] = [];
  let current: CaptureEntry | null = null;

  const finish = (endLine: number): void => {
    if (!current) return;
    entries.push({ ...current, endLine, markdown: current.markdown.replace(/\n+$/, "") });
    current = null;
  };

  for (const [lineIndex, line] of lines.entries()) {
    const match = line.match(new RegExp(`^${marker}\\s+(\\d{2}:\\d{2}(?::\\d{2})?)\\s*$`));
    if (match) {
      finish(lineIndex);
      current = { time: match[1] ?? "", markdown: "", startLine: lineIndex, endLine: lineIndex + 1 };
      continue;
    }
    if (current && /^#{1,6}\s+/.test(line)) {
      finish(lineIndex);
      continue;
    }
    if (current) current.markdown += `${line}\n`;
  }
  finish(lines.length);
  return entries.filter((entry) => entry.markdown.trim().length > 0);
}

export function replaceCaptureEntryInContent(content: string, entry: CaptureEntry, markdown: string): string {
  const replacement = normalizeMultiline(markdown);
  if (!replacement.trim()) throw new Error("Capture text cannot be empty.");

  const hadTrailingNewline = content.endsWith("\n");
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const heading = lines[entry.startLine];
  if (!heading?.match(new RegExp(`^#{1,6}\\s+${escapeRegExp(entry.time)}\\s*$`))) {
    throw new Error("The source changed. Reopen the menu and try again.");
  }
  const currentMarkdown = lines.slice(entry.startLine + 1, entry.endLine).join("\n").replace(/\n+$/, "");
  if (currentMarkdown !== entry.markdown) {
    throw new Error("The source changed. Reopen the menu and try again.");
  }
  lines.splice(entry.startLine + 1, entry.endLine - entry.startLine - 1, ...replacement.split("\n"));
  const updated = lines.join("\n").replace(/\n*$/, "");
  return hadTrailingNewline ? `${updated}\n` : updated;
}

function normalizeMultiline(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
}

function formatLocalTime(date: Date, format: "HH:mm" | "HH:mm:ss" = "HH:mm:ss"): string {
  const values = format === "HH:mm:ss"
    ? [date.getHours(), date.getMinutes(), date.getSeconds()]
    : [date.getHours(), date.getMinutes()];
  return values
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatMomentDate(date: Date, format: string): string {
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    DD: String(date.getDate()).padStart(2, "0"),
    YY: String(date.getFullYear()).slice(-2),
    M: String(date.getMonth() + 1),
    D: String(date.getDate())
  };
  return (format || "YYYY-MM-DD").replace(/YYYY|YY|MM|DD|M|D/g, (token) => tokens[token] ?? token);
}

function normalizeHeadingLevel(level: number | undefined): number {
  if (level === undefined) return 6;
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(`Invalid heading level: ${level}`);
  }
  return level;
}

function formatDateField(marker: string, value: string | undefined): string {
  if (!value) return "";
  if (!DATE_PATTERN.test(value)) throw new Error(`Invalid date: ${value}`);
  return `${marker} ${value}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
