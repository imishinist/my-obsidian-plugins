import { describe, expect, it } from "vitest";
import {
  appendCaptureLine,
  appendCaptureUnderHeading,
  dailyCapturePath,
  formatCaptureLine,
  parseCaptureEntries,
  replaceCaptureEntryInContent,
  resolveCaptureKind
} from "../src/capture";

const capturedAt = new Date(2026, 8, 19, 10, 21, 37);

describe("formatCaptureLine", () => {
  it("writes a visible time heading and preserves memo Markdown", () => {
    expect(formatCaptureLine({ kind: "note", text: "  idea\ncontinued ", capturedAt }))
      .toBe("###### 10:21:37\n  idea\ncontinued ");
  });

  it("writes a Task Board-compatible task line", () => {
    expect(formatCaptureLine({
      kind: "task",
      text: "タスク #project/foo",
      scheduled: "2026-09-20",
      due: "2026-09-30",
      capturedAt
    })).toBe("###### 10:21:37\n- [ ] タスク #project/foo ⏳ 2026-09-20 📅 2026-09-30");
  });

  it("preserves lines after the task title", () => {
    expect(formatCaptureLine({ kind: "task", text: "parent\n- child\n\nparagraph", capturedAt }))
      .toBe("###### 10:21:37\n- [ ] parent\n- child\n\nparagraph");
  });

  it("keeps an explicitly entered Markdown task status", () => {
    expect(formatCaptureLine({ kind: "task", text: "- [/] doing", capturedAt }))
      .toBe("###### 10:21:37\n- [/] doing");
  });

  it("uses the configured capture heading level", () => {
    expect(formatCaptureLine({ kind: "note", text: "memo", capturedAt, headingLevel: 3 }))
      .toBe("### 10:21:37\nmemo");
    expect(() => formatCaptureLine({ kind: "note", text: "memo", capturedAt, headingLevel: 7 }))
      .toThrow("Invalid heading level");
  });

  it("can omit seconds from the capture time", () => {
    expect(formatCaptureLine({ kind: "note", text: "memo", capturedAt, timeFormat: "HH:mm" }))
      .toBe("###### 10:21\nmemo");
  });

  it("rejects invalid dates", () => {
    expect(() => formatCaptureLine({ kind: "task", text: "x", due: "09/30/2026", capturedAt }))
      .toThrow("Invalid date");
  });

  it("does not attach task dates to a normal note", () => {
    expect(formatCaptureLine({
      kind: "note",
      text: "memo",
      scheduled: "2026-09-20",
      due: "2026-09-30",
      capturedAt
    })).toBe("###### 10:21:37\nmemo");
  });

  it("rejects empty capture text", () => {
    expect(() => formatCaptureLine({ kind: "note", text: "\n  \n", capturedAt }))
      .toThrow("Capture text is required");
  });
});

describe("resolveCaptureKind", () => {
  it.each(["- [ ] todo", "* [x] done", "+ [/] doing"])("detects a Markdown task: %s", (text) => {
    expect(resolveCaptureKind(text)).toBe("task");
  });

  it("keeps ordinary Markdown as a note unless Task is explicitly requested", () => {
    expect(resolveCaptureKind("ordinary note")).toBe("note");
    expect(resolveCaptureKind("ordinary note", true)).toBe("task");
  });

  it("only auto-detects a task at the beginning of the input", () => {
    expect(resolveCaptureKind("intro\n- [ ] later task")).toBe("note");
  });
});

describe("dailyCapturePath", () => {
  it("uses the local calendar date and normalizes folder slashes", () => {
    const local = new Date(2026, 8, 19, 23, 59);
    expect(dailyCapturePath("/Capture/", local)).toBe("Capture/2026-09-19.md");
    expect(dailyCapturePath("", local)).toBe("2026-09-19.md");
  });

  it("uses the Daily Notes date format", () => {
    const local = new Date(2026, 8, 9, 23, 55);
    expect(dailyCapturePath("Daily", local, "YYYY/MM/YYYY-MM-DD")).toBe("Daily/2026/09/2026-09-09.md");
  });
});

describe("appendCaptureLine", () => {
  it("preserves existing Markdown and inserts a missing line break", () => {
    expect(appendCaptureLine("# Capture", "- next")).toBe("# Capture\n- next\n");
    expect(appendCaptureLine("# Capture\n", "- next")).toBe("# Capture\n- next\n");
  });

  it("does not add blank lines between consecutive captures", () => {
    const first = appendCaptureLine("", "###### 10:00:00\nfirst");
    expect(appendCaptureLine(first, "###### 10:00:01\nsecond"))
      .toBe("###### 10:00:00\nfirst\n###### 10:00:01\nsecond\n");
  });
});

describe("appendCaptureUnderHeading", () => {
  it("appends at the end of the selected section", () => {
    const source = "# Day\n## Notes\nold\n\n## Tasks\n- [ ] existing\n";
    expect(appendCaptureUnderHeading(source, "###### 10:00\nnew", "Notes"))
      .toBe("# Day\n## Notes\nold\n###### 10:00\nnew\n\n## Tasks\n- [ ] existing\n");
  });

  it("accepts a Markdown heading and fails clearly when it is missing", () => {
    expect(appendCaptureUnderHeading("## Notes\n", "entry", "## Notes")).toBe("## Notes\nentry\n");
    expect(() => appendCaptureUnderHeading("## Notes\n", "entry", "Missing"))
      .toThrow("Daily Note heading not found: Missing");
  });

  it("keeps nested subsections inside the target section", () => {
    const source = "## Journal\n### Morning\ntext\n## Tasks\n";
    expect(appendCaptureUnderHeading(source, "###### 10:00:00\nnew", "Journal"))
      .toBe("## Journal\n### Morning\ntext\n###### 10:00:00\nnew\n## Tasks\n");
  });

  it("falls back to file-end append when no heading is configured", () => {
    expect(appendCaptureUnderHeading("# Day\n", "###### 10:00:00\nnew", ""))
      .toBe("# Day\n###### 10:00:00\nnew\n");
  });
});

describe("parseCaptureEntries", () => {
  it("reads capture blocks and ignores unrelated headings", () => {
    const source = "## Notes\n###### 09:10\nfirst\nline two\n###### 10:20\n- [ ] task 📅 2026-09-20\n## Other\ntext\n";
    expect(parseCaptureEntries(source)).toEqual([
      { time: "09:10", markdown: "first\nline two", startLine: 1, endLine: 4 },
      { time: "10:20", markdown: "- [ ] task 📅 2026-09-20", startLine: 4, endLine: 6 }
    ]);
  });

  it("uses the configured heading level", () => {
    expect(parseCaptureEntries("### 08:00\nnote\n", 3)).toEqual([
      { time: "08:00", markdown: "note", startLine: 0, endLine: 3 }
    ]);
  });

  it("reads second-resolution capture headings", () => {
    expect(parseCaptureEntries("###### 08:00:42\nnote\n")).toEqual([
      { time: "08:00:42", markdown: "note", startLine: 0, endLine: 3 }
    ]);
  });

  it("supports old and new time formats in the same Daily Note", () => {
    const entries = parseCaptureEntries("###### 08:00\nold\n###### 08:00:01\nnew\n");
    expect(entries.map(({ time, markdown }) => ({ time, markdown }))).toEqual([
      { time: "08:00", markdown: "old" },
      { time: "08:00:01", markdown: "new" }
    ]);
  });

  it("keeps repeated timestamps as separate entries with distinct source positions", () => {
    const entries = parseCaptureEntries("###### 08:00\nfirst\n###### 08:00\nsecond\n");
    expect(entries).toHaveLength(2);
    expect(entries[0]?.startLine).toBe(0);
    expect(entries[1]?.startLine).toBe(2);
  });

  it("ignores empty time headings", () => {
    expect(parseCaptureEntries("###### 08:00\n###### 08:01\ncontent\n")).toEqual([
      { time: "08:01", markdown: "content", startLine: 1, endLine: 4 }
    ]);
  });
});

describe("replaceCaptureEntryInContent", () => {
  it("edits only the selected item even when timestamps are repeated", () => {
    const source = "###### 08:00\nfirst\n###### 08:00\nsecond\n";
    const second = parseCaptureEntries(source)[1]!;
    expect(replaceCaptureEntryInContent(source, second, "updated\n- [ ] child"))
      .toBe("###### 08:00\nfirst\n###### 08:00\nupdated\n- [ ] child\n");
  });

  it("preserves whether the source had a trailing newline", () => {
    const source = "###### 08:00\nnote";
    const entry = parseCaptureEntries(source)[0]!;
    expect(replaceCaptureEntryInContent(source, entry, "changed")).toBe("###### 08:00\nchanged");
  });

  it("refuses to overwrite an entry after its source changed", () => {
    const source = "###### 08:00\noriginal\n";
    const entry = parseCaptureEntries(source)[0]!;
    expect(() => replaceCaptureEntryInContent("###### 08:00\nchanged elsewhere\n", entry, "mine"))
      .toThrow("The source changed");
  });

  it("rejects deleting all capture text through Edit", () => {
    const source = "###### 08:00\nnote\n";
    const entry = parseCaptureEntries(source)[0]!;
    expect(() => replaceCaptureEntryInContent(source, entry, "  \n"))
      .toThrow("Capture text cannot be empty");
  });
});
