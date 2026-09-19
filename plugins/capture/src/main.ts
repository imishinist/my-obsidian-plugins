import {
  App,
  Component,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath,
  setIcon
} from "obsidian";
import {
  appendCaptureLine,
  appendCaptureUnderHeading,
  CaptureEntry,
  CaptureKind,
  dailyCapturePath,
  formatCaptureLine,
  parseCaptureEntries,
  replaceCaptureEntryInContent,
  resolveCaptureKind
} from "./capture";

const VIEW_TYPE = "markdown-capture-view";
type CaptureEditorMode = "live-preview" | "source";

interface CaptureSettings {
  headingLevel: number;
  insertUnderHeading: string;
  timeFormat: "HH:mm" | "HH:mm:ss";
  editorMode: CaptureEditorMode;
  sendButtonLabel: string;
  taskButtonLabel: string;
}

interface CaptureDraftInput {
  kind: CaptureKind;
  text: string;
  scheduled?: string;
  due?: string;
}

const DEFAULT_SETTINGS: CaptureSettings = {
  headingLevel: 6,
  insertUnderHeading: "",
  timeFormat: "HH:mm:ss",
  editorMode: "live-preview",
  sendButtonLabel: "Send",
  taskButtonLabel: "Task"
};

export default class MarkdownCapturePlugin extends Plugin {
  override settings: CaptureSettings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    const saved = await this.loadData() as Partial<CaptureSettings> | null;
    this.settings = {
      headingLevel: saved?.headingLevel ?? DEFAULT_SETTINGS.headingLevel,
      insertUnderHeading: saved?.insertUnderHeading ?? DEFAULT_SETTINGS.insertUnderHeading,
      timeFormat: saved?.timeFormat === "HH:mm" ? "HH:mm" : "HH:mm:ss",
      editorMode: saved?.editorMode === "source" ? "source" : "live-preview",
      sendButtonLabel: saved?.sendButtonLabel?.trim() || DEFAULT_SETTINGS.sendButtonLabel,
      taskButtonLabel: saved?.taskButtonLabel?.trim() || DEFAULT_SETTINGS.taskButtonLabel
    };
    this.registerView(VIEW_TYPE, (leaf) => new CaptureView(leaf, this));
    this.addCommand({
      id: "open-capture",
      name: "Open capture page",
      callback: () => void this.openCapturePage()
    });
    this.addRibbonIcon("plus-circle", "Open capture page", () => void this.openCapturePage());
    this.addSettingTab(new CaptureSettingTab(this.app, this));
  }

  async openCapturePage(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await Promise.all(this.app.workspace.getLeavesOfType(VIEW_TYPE).map(async (leaf) => {
      if (leaf.view instanceof CaptureView) await leaf.view.applySettings();
    }));
  }

  async appendCapture(draft: CaptureDraftInput): Promise<void> {
    const capturedAt = new Date();
    const dailyNotes = getDailyNotesSettings(this.app);
    const path = normalizePath(dailyCapturePath(dailyNotes.folder, capturedAt, dailyNotes.format));
    const block = formatCaptureLine({
      ...draft,
      capturedAt,
      headingLevel: this.settings.headingLevel,
      timeFormat: this.settings.timeFormat
    });
    await ensureParentFolder(this.app, path);

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (content) => appendCaptureUnderHeading(content, block, this.settings.insertUnderHeading));
    } else if (existing) {
      throw new Error(`${path} is not a Markdown file.`);
    } else {
      const template = await renderDailyNoteTemplate(this.app, dailyNotes.template, capturedAt, path);
      await this.app.vault.create(path, appendCaptureUnderHeading(template, block, this.settings.insertUnderHeading));
    }
  }


  getTodayDailyNote(): TFile | null {
    const dailyNotes = getDailyNotesSettings(this.app);
    const path = normalizePath(dailyCapturePath(dailyNotes.folder, new Date(), dailyNotes.format));
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  async openTodayDailyNote(): Promise<void> {
    const dailyNotes = getDailyNotesSettings(this.app);
    const now = new Date();
    const path = normalizePath(dailyCapturePath(dailyNotes.folder, now, dailyNotes.format));
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      await ensureParentFolder(this.app, path);
      const template = await renderDailyNoteTemplate(this.app, dailyNotes.template, now, path);
      file = await this.app.vault.create(path, template);
    }
    if (!(file instanceof TFile)) throw new Error(`${path} is not a Markdown file.`);
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
  }
}

class CaptureView extends ItemView {
  private editor: NativeMarkdownEditor | null = null;
  private timelineEl: HTMLElement | null = null;
  private timelineRenderRevision = 0;
  private sendButton: HTMLButtonElement | null = null;
  private taskButton: HTMLButtonElement | null = null;
  private taskOptionsEl: HTMLElement | null = null;
  private editingCapture: { file: TFile; entry: CaptureEntry } | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: MarkdownCapturePlugin) {
    super(leaf);
  }

  override getViewType(): string { return VIEW_TYPE; }
  override getDisplayText(): string { return "Capture"; }
  override getIcon(): string { return "plus-circle"; }

  override async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("markdown-capture-page");
    const header = root.createDiv({ cls: "markdown-capture-header" });
    header.createEl("h2", { text: "Capture" });
    const openDailyNote = header.createEl("button", { cls: "markdown-capture-daily-note" });
    setIcon(openDailyNote, "calendar-days");
    openDailyNote.createSpan({ text: "Daily note" });
    openDailyNote.addEventListener("click", () => {
      void this.plugin.openTodayDailyNote().catch((error: unknown) => {
        new Notice(error instanceof Error ? error.message : "Could not open today's Daily Note.");
      });
    });

    const composer = root.createDiv({ cls: "markdown-capture-composer" });
    composer.createEl("label", { cls: "markdown-capture-label", text: "Markdown" });
    const editorHost = composer.createDiv({ cls: "markdown-capture-input" });
    const taskOptions = composer.createDiv({ cls: "markdown-capture-task-options" });
    this.taskOptionsEl = taskOptions;
    taskOptions.createSpan({ cls: "markdown-capture-section-label", text: "Task dates (optional)" });
    const dates = taskOptions.createDiv({ cls: "markdown-capture-dates" });
    const scheduled = createDateInput(dates, "Scheduled");
    const due = createDateInput(dates, "Due");

    const footer = composer.createDiv({ cls: "markdown-capture-footer" });
    const shortcuts = footer.createDiv({ cls: "markdown-capture-shortcuts" });
    shortcuts.createEl("span", { text: "Send" });
    shortcuts.createEl("kbd", { text: "⌘ ↵" });
    shortcuts.createEl("span", { text: "Task" });
    shortcuts.createEl("kbd", { text: "⌘ ⇧ ↵" });
    const actions = footer.createDiv({ cls: "markdown-capture-actions" });
    const saveTask = actions.createEl("button", {
      text: this.plugin.settings.taskButtonLabel,
      cls: "markdown-capture-send-task"
    });
    const save = actions.createEl("button", {
      text: this.plugin.settings.sendButtonLabel,
      cls: "mod-cta markdown-capture-send"
    });
    this.taskButton = saveTask;
    this.sendButton = save;
    const timeline = root.createDiv({ cls: "markdown-capture-timeline" });
    this.timelineEl = timeline;
    const submit = async (forceTask = false): Promise<void> => {
      const value = this.editor?.get() ?? "";
      if (!value.trim()) {
        new Notice("Enter something to capture.");
        return;
      }
      save.disabled = true;
      saveTask.disabled = true;
      try {
        if (this.editingCapture) {
          const { file, entry } = this.editingCapture;
          await replaceCaptureEntry(this.app, file, entry, value.replace(/^\n+|\n+$/g, ""));
          this.finishEditing();
          await this.renderTimeline();
          new Notice("Capture updated.");
          return;
        }
        const kind = resolveCaptureKind(value, forceTask);
        const draft: CaptureDraftInput = { kind, text: value };
        if (kind === "task" && scheduled.value) draft.scheduled = scheduled.value;
        if (kind === "task" && due.value) draft.due = due.value;
        await this.plugin.appendCapture(draft);
        await this.renderTimeline();
        this.editor?.set("", true);
        scheduled.value = "";
        due.value = "";
        new Notice("Captured.");
        this.editor?.editor.focus();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "Capture failed.");
      } finally {
        save.disabled = false;
        saveTask.disabled = false;
      }
    };
    save.addEventListener("click", () => void submit(false));
    saveTask.addEventListener("click", () => {
      if (this.editingCapture) this.finishEditing();
      else void submit(true);
    });
    const NativeEditor = getNativeMarkdownEditor(this.app);
    const owner = createEditorOwner(this.app, VIEW_TYPE, this.plugin.settings.editorMode);
    const editor = new NativeEditor(this.app, editorHost, owner);
    this.addChild(editor as unknown as Component);
    owner.editMode = editor;
    editor.owner.editor = editor.editor;
    editor.sourceMode = this.plugin.settings.editorMode === "source";
    editor.set("", true);
    this.editor = editor;
    editorHost.addEventListener("click", () => editor.editor.focus());
    this.registerDomEvent(window, "keydown", (event) => {
      if (!editorHost.contains(event.target as Node)) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void submit(event.shiftKey);
      }
    }, { capture: true });
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path === this.plugin.getTodayDailyNote()?.path) void this.renderTimeline();
    }));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file.path === this.plugin.getTodayDailyNote()?.path) void this.renderTimeline();
    }));
    await this.renderTimeline();
    editor.editor.focus();
  }

  async applySettings(): Promise<void> {
    this.updateActionLabels();
    if (this.editor) {
      const sourceMode = this.plugin.settings.editorMode === "source";
      if (this.editor.sourceMode !== sourceMode) {
        const draft = this.editor.get();
        this.editor.sourceMode = sourceMode;
        this.editor.set(draft, true);
      }
    }
    await this.renderTimeline();
  }

  private beginEditing(file: TFile, entry: CaptureEntry): void {
    this.editingCapture = { file, entry };
    this.editor?.set(entry.markdown, true);
    this.taskOptionsEl?.addClass("is-hidden");
    this.updateActionLabels();
    this.editor?.editor.focus();
  }

  private finishEditing(): void {
    this.editingCapture = null;
    this.editor?.set("", true);
    this.taskOptionsEl?.removeClass("is-hidden");
    this.updateActionLabels();
    this.editor?.editor.focus();
  }

  private updateActionLabels(): void {
    if (this.sendButton) {
      this.sendButton.textContent = this.editingCapture ? "Save" : this.plugin.settings.sendButtonLabel;
    }
    if (this.taskButton) {
      this.taskButton.textContent = this.editingCapture ? "Cancel" : this.plugin.settings.taskButtonLabel;
    }
  }

  private async renderTimeline(): Promise<void> {
    const revision = ++this.timelineRenderRevision;
    const timeline = this.timelineEl;
    if (!timeline) return;
    const file = this.plugin.getTodayDailyNote();
    const entries = file
      ? parseCaptureEntries(await this.app.vault.cachedRead(file), this.plugin.settings.headingLevel).reverse()
      : [];
    if (revision !== this.timelineRenderRevision || timeline !== this.timelineEl) return;

    timeline.empty();
    const heading = timeline.createDiv({ cls: "markdown-capture-timeline-header" });
    heading.createEl("h3", { text: "Today" });
    if (!file) {
      timeline.createDiv({ cls: "markdown-capture-empty", text: "No captures yet." });
      return;
    }
    if (entries.length === 0) {
      timeline.createDiv({ cls: "markdown-capture-empty", text: "No captures yet." });
      return;
    }
    const list = timeline.createDiv({ cls: "markdown-capture-timeline-list" });
    for (const entry of entries) {
      if (revision !== this.timelineRenderRevision) return;
      const item = list.createDiv({ cls: "markdown-capture-timeline-item" });
      item.createDiv({ cls: "markdown-capture-timeline-time", text: entry.time });
      const body = item.createDiv({ cls: "markdown-capture-timeline-body markdown-rendered" });
      await MarkdownRenderer.render(this.app, entry.markdown, body, file.path, this);
      if (revision !== this.timelineRenderRevision) {
        item.remove();
        return;
      }
      item.addEventListener("contextmenu", (event) => this.openEntryMenu(event, file, entry));
      item.addEventListener("dblclick", (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a, input, button")) return;
        event.preventDefault();
        this.beginEditing(file, entry);
      });
    }
  }

  private openEntryMenu(event: MouseEvent, file: TFile, entry: CaptureEntry): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle("Copy internal link")
      .setIcon("link")
      .onClick(() => void copyText(`[[${file.path.replace(/\.md$/, "")}#${entry.time}|${entry.time}]]`, "Internal link copied.")));
    menu.addItem((item) => item
      .setTitle("Copy Obsidian link")
      .setIcon("external-link")
      .onClick(() => void copyText(createObsidianUrl(this.app, file), "Obsidian link copied.")));
    menu.addSeparator();
    menu.addItem((item) => item
      .setTitle("Edit")
      .setIcon("pencil")
      .onClick(() => this.beginEditing(file, entry)));
    menu.addItem((item) => item
      .setTitle("Source")
      .setIcon("file-text")
      .onClick(() => void openSourceAtLine(this.app, file, entry.startLine)));
    menu.showAtMouseEvent(event);
  }

  override async onClose(): Promise<void> {
    this.timelineRenderRevision += 1;
    this.editor?.unload();
    this.editor = null;
    this.timelineEl = null;
    this.sendButton = null;
    this.taskButton = null;
    this.taskOptionsEl = null;
    this.editingCapture = null;
  }
}

interface NativeEditorOwner {
  app: App;
  id: string;
  scroll: number;
  editMode: NativeMarkdownEditor | null;
  editor?: NativeMarkdownEditor["editor"];
  showSearch(): void;
  toggleMode(): void;
  onMarkdownScroll(): void;
  getMode(): string;
  getState(): { mode: "source"; source: boolean };
  getViewType(): string;
  readonly file: null;
  readonly path: string;
}

interface NativeMarkdownEditor {
  owner: NativeEditorOwner;
  sourceMode: boolean;
  editor: { focus(): void };
  get(): string;
  set(value: string, clearHistory?: boolean): void;
  load(): void;
  unload(): void;
}

type NativeMarkdownEditorConstructor = new (
  app: App,
  containerEl: HTMLElement,
  owner: NativeEditorOwner
) => NativeMarkdownEditor;

interface EmbeddedMarkdownEditor {
  editable: boolean;
  editMode: object;
  set(value: string): void;
  showEditor(): void;
  unload(): void;
}

interface AppWithEmbedRegistry extends App {
  embedRegistry: {
    embedByExtension: {
      md(context: { app: App; containerEl: HTMLElement }, file: null, subpath: null): EmbeddedMarkdownEditor;
    };
  };
}

function getNativeMarkdownEditor(app: App): NativeMarkdownEditorConstructor {
  const internalApp = app as AppWithEmbedRegistry;
  const embedded = internalApp.embedRegistry.embedByExtension.md(
    { app, containerEl: createDiv() },
    null,
    null
  );
  embedded.editable = true;
  embedded.set("");
  embedded.showEditor();
  const constructor = Object.getPrototypeOf(Object.getPrototypeOf(embedded.editMode)).constructor as NativeMarkdownEditorConstructor;
  embedded.unload();
  return constructor;
}

function createEditorOwner(app: App, id: string, editorMode: CaptureEditorMode): NativeEditorOwner {
  return {
    app,
    id,
    scroll: 0,
    editMode: null,
    showSearch: () => undefined,
    toggleMode: () => undefined,
    onMarkdownScroll: () => undefined,
    getMode: () => "source",
    getState: () => ({ mode: "source", source: editorMode === "source" }),
    getViewType: () => VIEW_TYPE,
    get file() { return null; },
    get path() { return ""; }
  };
}

class CaptureSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: MarkdownCapturePlugin) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl).setName("Capture format").setHeading();
    new Setting(this.containerEl)
      .setName("Capture heading level")
      .setDesc("Choose the Markdown heading level used for each captured entry.")
      .addDropdown((dropdown) => {
        for (let level = 1; level <= 6; level += 1) {
          dropdown.addOption(String(level), `${level}  (${"#".repeat(level)})`);
        }
        dropdown
          .setValue(String(this.plugin.settings.headingLevel))
          .onChange(async (value) => {
            this.plugin.settings.headingLevel = Number(value);
            await this.plugin.saveSettings();
          });
      });
    new Setting(this.containerEl)
      .setName("Capture time format")
      .setDesc("Choose whether capture headings include seconds.")
      .addDropdown((dropdown) => dropdown
        .addOption("HH:mm", "HH:mm")
        .addOption("HH:mm:ss", "HH:mm:ss")
        .setValue(this.plugin.settings.timeFormat)
        .onChange(async (value) => {
          this.plugin.settings.timeFormat = value === "HH:mm" ? "HH:mm" : "HH:mm:ss";
          await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl).setName("Editor").setHeading();
    new Setting(this.containerEl)
      .setName("Editor mode")
      .setDesc("Choose how Markdown is displayed in the Capture and edit fields. Reopen the Capture page after changing it.")
      .addDropdown((dropdown) => dropdown
        .addOption("live-preview", "Live Preview")
        .addOption("source", "Source mode")
        .setValue(this.plugin.settings.editorMode)
        .onChange(async (value) => {
          this.plugin.settings.editorMode = value === "source" ? "source" : "live-preview";
          await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl).setName("Buttons").setHeading();
    new Setting(this.containerEl)
      .setName("Send button label")
      .setDesc("Text shown on the normal capture button.")
      .addText((text) => text
        .setPlaceholder(DEFAULT_SETTINGS.sendButtonLabel)
        .setValue(this.plugin.settings.sendButtonLabel)
        .onChange(async (value) => {
          this.plugin.settings.sendButtonLabel = value.trim() || DEFAULT_SETTINGS.sendButtonLabel;
          await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl)
      .setName("Task button label")
      .setDesc("Text shown on the task capture button.")
      .addText((text) => text
        .setPlaceholder(DEFAULT_SETTINGS.taskButtonLabel)
        .setValue(this.plugin.settings.taskButtonLabel)
        .onChange(async (value) => {
          this.plugin.settings.taskButtonLabel = value.trim() || DEFAULT_SETTINGS.taskButtonLabel;
          await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl).setName("Destination").setHeading();
    new Setting(this.containerEl)
      .setName("Insert under heading")
      .setDesc("Optional. Append captures to this Daily Note section. Leave empty to append to the end of the file.")
      .addText((text) => text
        .setPlaceholder("Notes")
        .setValue(this.plugin.settings.insertUnderHeading)
        .onChange(async (value) => {
          this.plugin.settings.insertUnderHeading = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}

interface DailyNotesSettings {
  folder: string;
  format: string;
  template: string;
}

interface AppWithInternalPlugins extends App {
  internalPlugins: {
    getPluginById(id: string): {
      enabled: boolean;
      instance?: { options?: Partial<DailyNotesSettings> };
    } | null;
  };
}

function getDailyNotesSettings(app: App): DailyNotesSettings {
  const dailyNotes = (app as AppWithInternalPlugins).internalPlugins.getPluginById("daily-notes");
  if (!dailyNotes?.enabled) throw new Error("Enable Obsidian's Daily notes core plugin first.");
  const options = dailyNotes.instance?.options;
  return {
    folder: options?.folder ?? "",
    format: options?.format || "YYYY-MM-DD",
    template: options?.template ?? ""
  };
}

async function renderDailyNoteTemplate(app: App, templatePath: string, date: Date, notePath: string): Promise<string> {
  if (!templatePath) return "";
  const normalizedTemplatePath = normalizePath(templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`);
  const template = app.vault.getAbstractFileByPath(normalizedTemplatePath);
  if (!(template instanceof TFile)) return "";
  const source = await app.vault.cachedRead(template);
  const title = notePath.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
  return source
    .replace(/{{date(?::([^}]+))?}}/g, (_match, format: string | undefined) => formatTemplateDate(date, format || "YYYY-MM-DD"))
    .replace(/{{time(?::([^}]+))?}}/g, (_match, format: string | undefined) => formatTemplateTime(date, format || "HH:mm"))
    .replace(/{{title}}/g, title);
}

function formatTemplateDate(date: Date, format: string): string {
  return dailyCapturePath("", date, format).replace(/\.md$/, "");
}

function formatTemplateTime(date: Date, format: string): string {
  const values: Record<string, string> = {
    HH: String(date.getHours()).padStart(2, "0"),
    H: String(date.getHours()),
    mm: String(date.getMinutes()).padStart(2, "0"),
    m: String(date.getMinutes()),
    ss: String(date.getSeconds()).padStart(2, "0"),
    s: String(date.getSeconds())
  };
  return format.replace(/HH|mm|ss|H|m|s/g, (token) => values[token] ?? token);
}

async function copyText(value: string, message: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  new Notice(message);
}

function createObsidianUrl(app: App, file: TFile): string {
  return `obsidian://open?vault=${encodeURIComponent(app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
}

async function openSourceAtLine(app: App, file: TFile, line: number): Promise<void> {
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(file, { active: true, state: { mode: "source" }, eState: { line } });
  const view = leaf.view;
  if (view instanceof MarkdownView) {
    const position = { line, ch: 0 };
    view.editor.setCursor(position);
    view.editor.scrollIntoView({ from: position, to: position }, true);
    view.editor.focus();
  }
}

async function replaceCaptureEntry(app: App, file: TFile, entry: CaptureEntry, markdown: string): Promise<void> {
  await app.vault.process(file, (content) => replaceCaptureEntryInContent(content, entry, markdown));
}

function createDateInput(parent: HTMLElement, label: string): HTMLInputElement {
  const wrapper = parent.createEl("label");
  wrapper.createSpan({ text: label });
  return wrapper.createEl("input", { type: "date" });
}

async function ensureParentFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}
