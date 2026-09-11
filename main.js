"use strict";

const { Plugin, PluginSettingTab, Setting, MarkdownRenderChild, Notice } = require("obsidian");

const DEFAULT_SETTINGS = {
  height: "480px",
  fit: "contain",
  loop: true,
  captions: true,
  thumbnailSize: 76,
  openOnClick: true
};

function parseBoolean(value, fallback) {
  if (value == null) return fallback;
  if (/^(true|yes|on|1)$/i.test(value)) return true;
  if (/^(false|no|off|0)$/i.test(value)) return false;
  return fallback;
}

function safeHeight(value, fallback) {
  const text = String(value ?? "").trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  return /^(auto|\d+(?:\.\d+)?(?:px|vh|vw|rem|em|%))$/i.test(text) ? text : fallback;
}

function splitTarget(value) {
  const parts = value.split("|");
  return { target: (parts.shift() || "").trim(), caption: parts.join("|").trim() };
}

function decodePath(value) {
  try { return decodeURIComponent(value); }
  catch (_) { return value; }
}

function parseDeck(source, defaults) {
  const options = { ...defaults };
  const images = [];
  let readingOptions = true;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { readingOptions = false; continue; }
    if (line.startsWith("#")) continue;

    const option = readingOptions && line.match(/^(height|fit|loop|caption|captions|thumbnailSize|start|controls|openOnClick)\s*:\s*(.+)$/i);
    if (option) {
      const name = option[1].toLowerCase();
      const value = option[2].trim();
      if (name === "height") options.height = safeHeight(value, defaults.height);
      else if (name === "fit" && /^(contain|cover)$/i.test(value)) options.fit = value.toLowerCase();
      else if (name === "loop") options.loop = parseBoolean(value, defaults.loop);
      else if (name === "caption" || name === "captions") options.captions = parseBoolean(value, defaults.captions);
      else if (name === "controls") options.controls = parseBoolean(value, true);
      else if (name === "openonclick") options.openOnClick = parseBoolean(value, defaults.openOnClick);
      else if (name === "thumbnailsize") options.thumbnailSize = Math.min(160, Math.max(44, Number(value) || defaults.thumbnailSize));
      else if (name === "start") options.start = Math.max(1, Number.parseInt(value, 10) || 1);
      continue;
    }
    readingOptions = false;

    let match = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
    if (match) {
      images.push({ target: match[2].trim(), caption: match[1].trim() });
      continue;
    }
    match = line.match(/^!?\[\[([\s\S]+)\]\]$/);
    const parsed = splitTarget(match ? match[1] : line);
    if (parsed.target) images.push(parsed);
  }
  return { options, images };
}

class ImageDeckView extends MarkdownRenderChild {
  constructor(container, plugin, source, sourcePath) {
    super(container);
    this.plugin = plugin;
    this.source = source;
    this.sourcePath = sourcePath;
    this.index = 0;
    this.touchStartX = null;
  }

  onload() {
    this.render();
    this.registerEvent(this.plugin.app.vault.on("rename", () => this.render()));
    this.registerEvent(this.plugin.app.vault.on("delete", () => this.render()));
  }

  resolve(item) {
    if (/^https?:\/\//i.test(item.target) || /^data:image\//i.test(item.target)) {
      return { ...item, src: item.target, file: null };
    }
    const decoded = decodePath(item.target.replace(/^<|>$/g, ""));
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(decoded, this.sourcePath);
    return file
      ? { ...item, src: this.plugin.app.vault.getResourcePath(file), file }
      : { ...item, src: "", file: null };
  }

  render() {
    const parsed = parseDeck(this.source, this.plugin.settings);
    this.items = parsed.images.map(item => this.resolve(item));
    this.options = parsed.options;
    this.index = Math.min(this.items.length - 1, Math.max(0, (this.options.start || 1) - 1));
    this.containerEl.empty();
    this.containerEl.addClass("image-deck-host");

    if (!this.items.length) {
      this.containerEl.createDiv({ cls: "image-deck-empty", text: "Image Deck: no images were specified." });
      return;
    }

    this.deckEl = this.containerEl.createDiv({ cls: "image-deck", attr: { tabindex: "0", role: "region", "aria-label": "Image gallery" } });
    this.deckEl.style.setProperty("--image-deck-height", safeHeight(this.options.height, DEFAULT_SETTINGS.height));
    this.deckEl.style.setProperty("--image-deck-thumb-size", `${this.options.thumbnailSize}px`);
    this.stageEl = this.deckEl.createDiv({ cls: "image-deck-stage" });
    this.mainImage = this.stageEl.createEl("img", { cls: "image-deck-main", attr: { draggable: "false" } });
    this.mainImage.style.objectFit = this.options.fit;
    this.missingEl = this.stageEl.createDiv({ cls: "image-deck-missing" });

    if (this.options.controls !== false && this.items.length > 1) {
      this.previousButton = this.stageEl.createEl("button", { cls: "image-deck-control image-deck-previous", text: "‹", attr: { type: "button", "aria-label": "Previous image" } });
      this.nextButton = this.stageEl.createEl("button", { cls: "image-deck-control image-deck-next", text: "›", attr: { type: "button", "aria-label": "Next image" } });
      this.previousButton.addEventListener("click", event => { event.stopPropagation(); this.move(-1); });
      this.nextButton.addEventListener("click", event => { event.stopPropagation(); this.move(1); });
    }

    this.captionEl = this.deckEl.createDiv({ cls: "image-deck-caption" });
    this.thumbnailsEl = this.deckEl.createDiv({ cls: "image-deck-thumbnails", attr: { role: "tablist", "aria-label": "Gallery thumbnails" } });
    this.thumbnailButtons = this.items.map((item, index) => this.createThumbnail(item, index));
    if (this.items.length === 1) this.thumbnailsEl.addClass("is-single");

    this.deckEl.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); this.move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); this.move(1); }
      if (event.key === "Home") { event.preventDefault(); this.select(0); }
      if (event.key === "End") { event.preventDefault(); this.select(this.items.length - 1); }
    });
    this.stageEl.addEventListener("touchstart", event => { this.touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
    this.stageEl.addEventListener("touchend", event => {
      if (this.touchStartX == null) return;
      const distance = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
      this.touchStartX = null;
      if (Math.abs(distance) >= 45) this.move(distance > 0 ? -1 : 1);
    }, { passive: true });
    this.mainImage.addEventListener("click", () => this.openCurrent());
    this.select(this.index, false);
  }

  createThumbnail(item, index) {
    const button = this.thumbnailsEl.createEl("button", {
      cls: "image-deck-thumbnail",
      attr: { type: "button", role: "tab", "aria-label": item.caption || `Image ${index + 1}` }
    });
    if (item.src) button.createEl("img", { attr: { src: item.src, alt: "", loading: "lazy", draggable: "false" } });
    else button.createSpan({ cls: "image-deck-thumbnail-missing", text: "?" });
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      this.select(index);
    });
    return button;
  }

  move(delta) {
    let next = this.index + delta;
    if (this.options.loop) next = (next + this.items.length) % this.items.length;
    else next = Math.min(this.items.length - 1, Math.max(0, next));
    this.select(next);
  }

  select(index, scroll = true) {
    this.index = index;
    const item = this.items[index];
    this.mainImage.toggleClass("is-hidden", !item.src);
    this.missingEl.toggleClass("is-visible", !item.src);
    if (item.src) {
      this.mainImage.src = item.src;
      this.mainImage.alt = item.caption || item.target;
    }
    this.missingEl.setText(item.src ? "" : `Image not found: ${item.target}`);
    this.captionEl.setText(this.options.captions ? (item.caption || "") : "");
    this.captionEl.toggleClass("is-hidden", !this.options.captions);
    this.captionEl.toggleClass("is-empty", this.options.captions && !item.caption);
    this.thumbnailButtons.forEach((button, i) => {
      button.toggleClass("is-selected", i === index);
      button.setAttr("aria-selected", String(i === index));
    });
    if (scroll) this.thumbnailButtons[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (!this.options.loop) {
      if (this.previousButton) this.previousButton.disabled = index === 0;
      if (this.nextButton) this.nextButton.disabled = index === this.items.length - 1;
    }
  }

  async openCurrent() {
    if (!this.options.openOnClick) return;
    const item = this.items[this.index];
    if (item?.file) await this.plugin.app.workspace.getLeaf(false).openFile(item.file);
    else if (item?.src && /^https?:\/\//i.test(item.src)) window.open(item.src, "_blank", "noopener");
  }
}

class ImageDeckSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Image Deck" });
    new Setting(containerEl).setName("Default gallery height").setDesc("Height in pixels.").addText(text => {
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.step = "any";
      const height = Number(String(this.plugin.settings.height).replace(/px$/i, ""));
      text.setValue(String(Number.isFinite(height) && height >= 0 ? height : 480))
        .onChange(async value => {
          if (!value.trim()) return;
          const height = Number(value);
          if (!Number.isFinite(height) || height < 0) return;
          this.plugin.settings.height = String(height);
          await this.plugin.saveSettings();
        });
      text.inputEl.insertAdjacentText("afterend", " px");
    });
    new Setting(containerEl).setName("Image fit").addDropdown(dropdown => dropdown
      .addOption("contain", "Contain").addOption("cover", "Cover").setValue(this.plugin.settings.fit)
      .onChange(async value => { this.plugin.settings.fit = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Loop navigation").addToggle(toggle => toggle
      .setValue(this.plugin.settings.loop).onChange(async value => { this.plugin.settings.loop = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Show captions").addToggle(toggle => toggle
      .setValue(this.plugin.settings.captions).onChange(async value => { this.plugin.settings.captions = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Open image on click").setDesc("Open Vault images as a file and external images in the browser.").addToggle(toggle => toggle
      .setValue(this.plugin.settings.openOnClick).onChange(async value => { this.plugin.settings.openOnClick = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Thumbnail size").setDesc("Between 44 and 160 pixels.").addSlider(slider => slider
      .setLimits(44, 160, 4).setDynamicTooltip().setValue(this.plugin.settings.thumbnailSize)
      .onChange(async value => { this.plugin.settings.thumbnailSize = value; await this.plugin.saveSettings(); }));
  }
}

class ImageDeckPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.registerMarkdownCodeBlockProcessor("image-deck", (source, el, ctx) => {
      ctx.addChild(new ImageDeckView(el, this, source, ctx.sourcePath));
    });
    this.addSettingTab(new ImageDeckSettingTab(this.app, this));
  }
  async saveSettings() { await this.saveData(this.settings); }
}

module.exports = ImageDeckPlugin;
