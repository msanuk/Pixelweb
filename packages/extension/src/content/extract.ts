import type { CapturedField, CapturedFieldKind } from '@pixelweb/shared';

/**
 * Reads one frame of a cloud console page into what the guide needs: the form's
 * fields (label, kind, value, options, help, error, section) plus the visible
 * text around them. Generic rules only — native controls, ARIA roles and the
 * class names component libraries share (form-item, label, help, error) — so it
 * copes with Ant Design, Alibaba Fusion and AWS Cloudscape without knowing them.
 * Nothing is redacted here (the side panel does that on the merged frames), but
 * password inputs are never read. The page's DOM is never changed.
 */

/** One frame's page, before refs are assigned and secrets masked. */
export interface FrameCapture {
  url: string;
  title: string;
  breadcrumbs: string[];
  heading: string;
  fields: Omit<CapturedField, 'ref'>[];
  text: string;
  selection?: string;
  /** indexes of the fields inside the user's selection, when there is one */
  selected?: number[];
}

/** How to tell what is on screen; a test DOM has no layout, so tests pass their own. */
export interface Dom {
  /** rendered with a size, for controls */
  visible(el: Element): boolean;
  /** rendered at all (not display: none / visibility: hidden), for text */
  rendered(el: Element): boolean;
}

export const browserDom: Dom = {
  visible(el) {
    if (!this.rendered(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  },
  rendered(el) {
    return typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : true;
  },
};

const MAX = { fields: 150, label: 120, value: 500, options: 30, option: 80, help: 400, error: 200, section: 80, crumbs: 12, crumb: 80, heading: 200, selection: 4000 };
export const TEXT_BUDGET = 8000;

const CONTROLS = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'button[aria-haspopup="listbox"]',
  ...['combobox', 'listbox', 'radiogroup', 'radio', 'switch', 'checkbox', 'textbox', 'spinbutton', 'slider'].map((r) => `[role="${r}"]`),
].join(',');

/** Inputs that aren't settings: buttons, file pickers, the console's global search. */
const SKIP_INPUT = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file', 'search', 'color']);

/** The console's own chrome: top bar, product menus, side navigation. */
const NOISE = 'nav, [role="navigation"], [role="banner"], [role="menubar"], [role="menu"], [role="tree"], script, style, noscript, template';

const FORM_ITEM = [
  'form-item',
  'formitem',
  'form-field',
  'formfield',
  'form-group',
  'form-row',
].map((c) => `[class*="${c}" i]`).concat('fieldset', '[role="group"]', 'tr').join(',');

const LABELISH = 'label, legend, th, dt, [class*="label" i]';
const HELP = /help|extra|desc|hint|tip|explain|constraint/i;
const ERROR = /error|invalid/i;
const PLACEHOLDER = '[class*="placeholder" i]';
const PLACEHOLDER_TEXT = /^(请选择|请输入|select\b|choose\b)/i;
const SECTION = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '[role="heading"]:not([aria-level="1"])',
  ...['card-title', 'card-header', 'section-title', 'panel-title', 'block-title', 'group-title'].map((c) => `[class*="${c}" i]`),
].join(',');

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
/** A label as shown, minus the required star and the trailing colon. */
const cleanLabel = (s: string) => squash(s).replace(/^\*\s*/, '').replace(/\s*[*:：]+$/, '').replace(/\s*\*$/, '').trim();

/** Element's parent, stepping out of a shadow root to its host. */
function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function within(el: Element, ancestor: Element): boolean {
  for (let e: Element | null = el; e; e = parentOf(e)) if (e === ancestor) return true;
  return false;
}

function closestUp(el: Element | null, selector: string, levels = Infinity): Element | null {
  for (let e = el, n = 0; e && n <= levels; e = parentOf(e), n++) if (e.matches(selector)) return e;
  return null;
}

/** Every element in document order, into open shadow roots, not into iframes (each frame reads itself). */
function* walk(root: ParentNode): Generator<Element> {
  for (const el of Array.from(root.children)) {
    yield el;
    if (el.shadowRoot) yield* walk(el.shadowRoot);
    yield* walk(el);
  }
}

class Reader {
  constructor(private readonly dom: Dom) {}

  /** Rendered text under `node`, leaving out `skip` (the control itself) and other controls' innards. */
  text(node: Node, skip?: Element): string {
    let out = '';
    const visit = (n: Node) => {
      if (n === skip) return;
      if (n.nodeType === Node.TEXT_NODE) {
        out += n.nodeValue ?? '';
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const e = n as Element;
      if (e.matches('script, style, noscript, template, svg, select, textarea, [role="listbox"], ' + PLACEHOLDER) || !this.dom.rendered(e)) return;
      if (/^(DIV|P|LI|TR|BR|H[1-6])$/.test(e.tagName)) out += ' ';
      for (const c of Array.from(e.childNodes)) visit(c);
    };
    visit(node);
    return squash(out);
  }

  /** Text of the elements an aria-labelledby / aria-describedby attribute points at. */
  idsText(el: Element, attr: string): string {
    const ids = el.getAttribute(attr)?.trim().split(/\s+/) ?? [];
    const root = el.getRootNode() as Document | ShadowRoot;
    return squash(
      ids
        .map((id) => root.getElementById?.(id) ?? null)
        .filter((e): e is HTMLElement => !!e && e !== el)
        .map((e) => this.text(e))
        .join(' '),
    );
  }

  /** The control's own label: ARIA, <label for>, a wrapping <label>. */
  ownLabel(el: Element): { text: string; el?: Element } {
    const byIds = this.idsText(el, 'aria-labelledby');
    if (byIds) return { text: byIds };
    const aria = el.getAttribute('aria-label')?.trim();
    if (aria) return { text: aria };
    if (el.id) {
      const root = el.getRootNode() as Document | ShadowRoot;
      const forLabel = Array.from(root.querySelectorAll('label')).find((l) => l.getAttribute('for') === el.id);
      if (forLabel) {
        const t = this.text(forLabel, el);
        if (t) return { text: t, el: forLabel };
      }
    }
    const wrap = closestUp(el, 'label', 6);
    if (wrap) {
      const t = this.text(wrap, el);
      if (t) return { text: t, el: wrap };
    }
    return { text: '' };
  }

  /** A label inside `item` for the control: before it, not part of it, not another control's. */
  labelIn(item: Element, el: Element): { text: string; el?: Element } | null {
    const own = this.idsText(item, 'aria-labelledby') || item.getAttribute('aria-label')?.trim();
    if (own) return { text: own };
    for (const l of Array.from(item.querySelectorAll(LABELISH))) {
      if (within(el, l) || within(l, el) || l.matches(CONTROLS) || l.querySelector(CONTROLS)) continue;
      // the item's label comes before its control; option labels and hints after it don't count
      if (!(l.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const t = this.text(l);
      if (t) return { text: t, el: l };
    }
    return null;
  }

  /**
   * The form item around the control. Libraries nest several form-item-ish
   * boxes (Fusion's next-form-item > next-form-item-control), so it is the
   * nearest one that also holds the label, else the nearest one.
   */
  itemOf(el: Element): Element | null {
    let first: Element | null = null;
    let item = closestUp(parentOf(el), FORM_ITEM);
    for (let depth = 0; item && depth < 3; depth++, item = closestUp(parentOf(item), FORM_ITEM)) {
      first ??= item;
      if (this.labelIn(item, el)) return item;
    }
    return first;
  }

  /** The label of the form item around the control: its label column, legend or header cell. */
  itemLabel(el: Element): { text: string; el?: Element } {
    const item = this.itemOf(el);
    return (item && this.labelIn(item, el)) || { text: '' };
  }

  /** Short text just before the control, for forms without label markup. */
  nearText(el: Element): string {
    let node: Element | null = el;
    for (let up = 0; node && up < 3; up++, node = parentOf(node)) {
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        // another control, or a heading: whatever comes before belongs to something else
        if (sib.matches(CONTROLS) || sib.querySelector(CONTROLS) || sib.matches('h1,' + SECTION)) return '';
        const t = this.text(sib);
        if (t) return t.length <= 60 ? t : '';
      }
    }
    return '';
  }

  label(el: Element, toggle = false): { text: string; required: boolean } {
    const own = this.ownLabel(el);
    let pick = own;
    if (!own.text || toggle) {
      const item = this.itemLabel(el);
      const near = item.text ? item : { text: this.nearText(el) };
      // a checkbox's own text is its option ("HTTP 80"); the item says what the options are for
      if (toggle && own.text && near.text && cleanLabel(near.text) !== cleanLabel(own.text)) pick = { text: `${cleanLabel(near.text)} · ${cleanLabel(own.text)}`, el: near.el };
      else if (!own.text) pick = near;
    }
    let text = pick.text || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || '';
    const star = /^\s*\*|\*\s*[:：]?\s*$/.test(text);
    const required = star || !!pick.el?.matches('[class*="required" i]') || !!pick.el?.querySelector('[class*="required" i]');
    text = cleanLabel(text);
    return { text: cut(text, MAX.label), required };
  }

  /** Help and error text: ARIA first, then the item's hint and error elements. */
  notes(el: Element): { help?: string; error?: string } {
    let help = this.idsText(el, 'aria-describedby');
    let error = this.idsText(el, 'aria-errormessage');
    const item = this.itemOf(el);
    if (item) {
      for (const n of Array.from(item.querySelectorAll('[class]'))) {
        if (within(el, n) || within(n, el) || n.querySelector(CONTROLS)) continue;
        const cls = typeof n.className === 'string' ? n.className : n.getAttribute('class') ?? '';
        const isError = ERROR.test(cls);
        if (!isError && !HELP.test(cls)) continue;
        if (isError && error) continue;
        if (!isError && help) continue;
        const t = this.text(n);
        if (!t) continue;
        if (isError) error = t;
        else help = t;
      }
    }
    if (help && error && help.includes(error)) help = squash(help.replace(error, ''));
    return { ...(help ? { help: cut(help, MAX.help) } : {}), ...(error ? { error: cut(error, MAX.error) } : {}) };
  }

  /** What an option of a radio group or listbox is called. */
  optionText(el: Element): string {
    const own = this.ownLabel(el).text;
    if (own) return cut(cleanLabel(own), MAX.option);
    const t = this.text(el) || this.text(el.nextElementSibling ?? el);
    return cut(cleanLabel(t || (el as HTMLInputElement).value || ''), MAX.option);
  }
}

/** The smallest element holding all of `els`. */
function commonAncestor(els: Element[]): Element {
  let box: Element | null = els[0];
  while (box && !els.every((e) => within(e, box!))) box = parentOf(box);
  return box ?? els[0];
}

function isDisabled(el: Element): boolean {
  if ((el as HTMLInputElement).disabled) return true;
  if (closestUp(el, '[aria-disabled="true"], fieldset[disabled]', 3)) return true;
  return !!closestUp(el, '[class*="disabled" i]', 2);
}

interface Found {
  field: Omit<CapturedField, 'ref'>;
  /** the control; whatever is inside it belongs to this field */
  el: Element;
  /** what "show me ⟦f3⟧" outlines, when that isn't the control itself */
  mark?: Element;
  /** other elements this field accounts for, e.g. the rest of a radio group */
  covers?: Element[];
}

function kindOf(el: Element): CapturedFieldKind | 'skip' | 'radio-input' {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role')?.trim().split(/\s+/)[0] ?? '';
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (SKIP_INPUT.has(type)) return 'skip';
    if (type === 'radio') return 'radio-input';
    if (type === 'checkbox') return role === 'switch' ? 'switch' : 'checkbox';
    if (role === 'combobox') return 'select';
    if (type === 'number' || type === 'range' || role === 'spinbutton') return 'number';
    return 'text';
  }
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  switch (role) {
    case 'radiogroup':
    case 'radio':
      return 'radio';
    case 'switch':
      return 'switch';
    case 'checkbox':
      return 'checkbox';
    case 'combobox':
    case 'listbox':
      return 'select';
    case 'spinbutton':
    case 'slider':
      return 'number';
    case 'textbox':
      return el.getAttribute('aria-multiline') === 'true' ? 'textarea' : 'text';
  }
  if (tag === 'button') return 'select'; // aria-haspopup="listbox": a select drawn as a button (Cloudscape)
  return 'textarea'; // contenteditable
}

function checkedState(el: Element): boolean | 'mixed' {
  const aria = el.getAttribute('aria-checked');
  if (aria === 'mixed') return 'mixed';
  if (aria) return aria === 'true';
  return !!(el as HTMLInputElement).checked;
}

export function extractPage(doc: Document, dom: Dom = browserDom): { capture: FrameCapture; elements: Element[] } {
  const r = new Reader(dom);
  const fields: Omit<CapturedField, 'ref'>[] = [];
  const elements: Element[] = [];
  const covered = new Set<Element>();
  let inside: Element | null = null; // the last field found: its descendants belong to it
  let section: string | undefined;

  const read = (el: Element): Found | null => {
    const kind = kindOf(el);
    if (kind === 'skip') return null;
    if (kind === 'radio-input' || (kind === 'radio' && el.getAttribute('role') === 'radio')) return radioGroup(el);
    const box = kind === 'checkbox' || kind === 'switch' ? (el.tagName === 'INPUT' ? closestUp(el, 'label', 3) ?? parentOf(el) ?? el : el) : el;
    if (!dom.visible(box)) return null;
    const lab = r.label(el, kind === 'checkbox' || kind === 'switch');
    const field: Omit<CapturedField, 'ref'> = { label: lab.text, kind };
    const value = valueOf(el, kind);
    if (value !== undefined) field.value = cut(value, MAX.value);
    const options = optionsOf(el);
    if (options.length) field.options = options;
    if (lab.required || el.hasAttribute('required') || el.getAttribute('aria-required') === 'true') field.required = true;
    if (isDisabled(el)) field.disabled = true;
    Object.assign(field, r.notes(el));
    return { field, el, covers: el.getAttribute('role') === 'radiogroup' ? Array.from(el.querySelectorAll('input[type="radio"], [role="radio"]')) : undefined };
  };

  const valueOf = (el: Element, kind: CapturedFieldKind): string | undefined => {
    const input = el as HTMLInputElement;
    if (el.tagName === 'INPUT' && input.type === 'password') return undefined; // never read
    switch (kind) {
      case 'checkbox': {
        const s = checkedState(el);
        return s === 'mixed' ? '部分勾选' : s ? '已勾选' : '未勾选';
      }
      case 'switch':
        return checkedState(el) ? '开' : '关';
      case 'radio': {
        const checked = Array.from(el.querySelectorAll('input[type="radio"], [role="radio"]')).find((o) => checkedState(o) === true);
        return checked ? r.optionText(checked) : '';
      }
      case 'select':
        if (el.tagName === 'SELECT')
          return Array.from((el as HTMLSelectElement).selectedOptions)
            .map((o) => squash(o.label || o.text))
            .join('、');
        if (el.getAttribute('role') === 'listbox')
          return Array.from(el.querySelectorAll('[role="option"][aria-selected="true"]'))
            .map((o) => r.text(o))
            .join('、');
        return selectedText(el);
      case 'number':
        if (el.tagName === 'INPUT') return input.value;
        return el.getAttribute('aria-valuetext') ?? el.getAttribute('aria-valuenow') ?? r.text(el);
      default:
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return input.value;
        return squash((el as HTMLElement).innerText ?? el.textContent ?? '');
    }
  };

  /**
   * A custom select's current choice. A button or div shows it inside itself;
   * an input (Ant Design, Fusion) has it typed in or drawn next to it, within
   * the select's own box — never as far out as the form item, whose label
   * would read as the value.
   */
  const selectedText = (el: Element): string => {
    let shown = '';
    if (el.tagName !== 'INPUT') shown = r.text(el);
    else {
      shown = (el as HTMLInputElement).value.trim();
      for (let box = parentOf(el), up = 0; !shown && box && up < 2; box = parentOf(box), up++) {
        if (box.matches(FORM_ITEM) || box.querySelector('label') || Array.from(box.querySelectorAll(CONTROLS)).some((c) => c !== el)) break;
        shown = r.text(box, el);
      }
    }
    return PLACEHOLDER_TEXT.test(shown) ? '' : shown;
  };

  const optionsOf = (el: Element): string[] => {
    let opts: Element[] = [];
    if (el.tagName === 'SELECT') opts = Array.from((el as HTMLSelectElement).options);
    else if (el.getAttribute('role') === 'radiogroup') opts = Array.from(el.querySelectorAll('input[type="radio"], [role="radio"]'));
    else if (el.getAttribute('role') === 'listbox') opts = Array.from(el.querySelectorAll('[role="option"]'));
    else if (el.getAttribute('aria-expanded') === 'true') {
      // an open custom select: its popup list is wherever aria-controls points
      const root = el.getRootNode() as Document | ShadowRoot;
      const id = el.getAttribute('aria-controls') ?? el.getAttribute('aria-owns');
      const list = id ? root.getElementById?.(id) : null;
      if (list) opts = Array.from(list.querySelectorAll('[role="option"]'));
    }
    return opts
      .slice(0, MAX.options)
      .map((o) => (o.tagName === 'OPTION' ? cut(squash((o as HTMLOptionElement).label || o.textContent || ''), MAX.option) : r.optionText(o)))
      .filter(Boolean);
  };

  /** Native radios without a radiogroup role: grouped by their group container, else by name. */
  const radioGroup = (radio: Element): Found | null => {
    const box = closestUp(radio, '[role="radiogroup"], [class*="radio-group" i], [class*="radiogroup" i]');
    let radios: Element[];
    if (box) radios = Array.from(box.querySelectorAll('input[type="radio"], [role="radio"]'));
    else {
      const name = radio.getAttribute('name');
      const root = radio.getRootNode() as Document | ShadowRoot;
      radios = name
        ? Array.from(root.querySelectorAll('input[type="radio"]')).filter(
            (o) => o.getAttribute('name') === name && (o as HTMLInputElement).form === (radio as HTMLInputElement).form,
          )
        : radio.getAttribute('role') === 'radio' && radio.parentElement
          ? Array.from(radio.parentElement.querySelectorAll('[role="radio"]'))
          : [radio];
    }
    const shown = radios.filter((o) => dom.visible(o.tagName === 'INPUT' ? closestUp(o, 'label', 3) ?? parentOf(o) ?? o : o));
    if (!shown.length) return null;
    const anchor = box ?? shown[0];
    const lab = box ? r.label(box) : radios.length > 1 ? (() => {
      const item = r.itemLabel(radio);
      return { text: cut(cleanLabel(item.text || r.nearText(shown[0])), MAX.label), required: false };
    })() : r.label(radio);
    const checked = radios.find((o) => checkedState(o) === true);
    const field: Omit<CapturedField, 'ref'> = {
      label: lab.text,
      kind: 'radio',
      value: checked ? r.optionText(checked) : '',
      options: shown.slice(0, MAX.options).map((o) => r.optionText(o)),
    };
    if (lab.required || radios.some((o) => o.hasAttribute('required'))) field.required = true;
    if (radios.every(isDisabled)) field.disabled = true;
    Object.assign(field, r.notes(anchor));
    return { field, el: anchor, mark: box ?? commonAncestor(shown), covers: radios };
  };

  for (const el of walk(doc)) {
    if (inside && within(el, inside)) continue;
    inside = null;
    if (el.matches(NOISE)) {
      inside = el; // skip the console's own menus and top bar
      continue;
    }
    if (el.matches(SECTION) && dom.rendered(el)) {
      const t = squash(r.text(el));
      if (t && t.length <= MAX.section) section = t;
      continue;
    }
    if (covered.has(el) || !el.matches(CONTROLS)) continue;
    if (fields.length >= MAX.fields) break;
    const found = read(el);
    if (!found) continue;
    for (const c of found.covers ?? []) covered.add(c);
    if (section && section !== found.field.label) found.field.section = section;
    fields.push(found.field);
    elements.push(found.mark ?? found.el);
    inside = found.el;
  }

  const selection = doc.getSelection?.();
  const sel = selection?.toString().trim();
  const ranges = sel && selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i)) : [];
  const selected = elements.flatMap((el, i) => (ranges.some((rg) => rg.intersectsNode(el)) ? [i] : []));
  return {
    capture: {
      url: doc.location?.href ?? doc.URL,
      title: squash(doc.title),
      breadcrumbs: breadcrumbs(doc, r, dom),
      heading: heading(doc, r, dom),
      fields,
      text: pageText(doc, dom),
      ...(sel ? { selection: cut(sel, MAX.selection), selected } : {}),
    },
    elements,
  };
}

function breadcrumbs(doc: Document, r: Reader, dom: Dom): string[] {
  const bc = Array.from(doc.querySelectorAll('[aria-label*="breadcrumb" i], [class*="breadcrumb" i]')).find((e) => dom.visible(e));
  if (!bc) return [];
  const items = Array.from(bc.querySelectorAll('li, a, [class*="item" i]')).filter((e) => !e.querySelector('li, a, [class*="item" i]'));
  const texts = (items.length ? items.map((e) => r.text(e)) : r.text(bc).split(/\s+[/>›»]\s+/))
    .map((t) => squash(t.replace(/^[/>›»|\s]+|[/>›»|\s]+$/g, '')))
    .filter(Boolean)
    .filter((t, i, all) => t !== all[i - 1]);
  return texts.slice(0, MAX.crumbs).map((t) => cut(t, MAX.crumb));
}

function heading(doc: Document, r: Reader, dom: Dom): string {
  for (const sel of ['h1, [role="heading"][aria-level="1"]', 'h2']) {
    for (const h of Array.from(doc.querySelectorAll(sel))) {
      if (!dom.visible(h) || closestUp(h, NOISE)) continue;
      const t = r.text(h);
      if (t) return cut(t, MAX.heading);
    }
  }
  return '';
}

/**
 * The page's visible text without the console's menus and top bar, one line
 * per block. All of the body, not just <main>: the price usually sits in a
 * bar outside it.
 */
export function pageText(doc: Document, dom: Dom, budget = TEXT_BUDGET): string {
  const root = doc.body;
  if (!root) return '';
  const parts: string[] = [];
  const visit = (el: Element) => {
    if (el.matches(NOISE) || !dom.rendered(el)) return;
    if (!el.querySelector(NOISE)) {
      parts.push((el as HTMLElement).innerText ?? el.textContent ?? '');
      return;
    }
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === Node.TEXT_NODE) parts.push(c.nodeValue ?? '');
      else if (c.nodeType === Node.ELEMENT_NODE) visit(c as Element);
    }
  };
  visit(root);
  return tidy(parts.join('\n'), budget);
}

/** Trimmed lines, no blank or repeated ones, cut to the budget. */
export function tidy(text: string, budget = TEXT_BUDGET): string {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/[ \t ]+/g, ' ').trim();
    if (line && line !== lines[lines.length - 1]) lines.push(line);
  }
  const out = lines.join('\n');
  return out.length > budget ? out.slice(0, budget) + '\n…（正文太长，后面省略）' : out;
}
