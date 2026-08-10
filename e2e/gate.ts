import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Five rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this replaces
 *     finished its driver with `addStyleTag({ content:
 *     '*{animation:none!important;transition:none!important}' })` and never
 *     asked for the preference at all. Overriding from the test bypasses this
 *     lab's own `@media (prefers-reduced-motion: reduce)` block instead of
 *     exercising it, and that block is doing real work here: `reveal`,
 *     `dealin` and `flipin` all start at `opacity: 0`, and the block cancels
 *     them outright with `animation: none` rather than collapsing their
 *     duration. `boot` asks for the preference, asserts it took effect, `settle`
 *     waits for the animations to drain, and `expectNotBlank` checks the end
 *     state actually landed.
 *
 *  2. NOTHING IS FORCE-REVEALED. The old driver ended with
 *     `document.querySelectorAll('[hidden]').forEach(el =>
 *     el.removeAttribute('hidden'))`, which un-hides all five tab panels at
 *     once — a document no visitor can ever load, with five `role="tabpanel"`
 *     elements visible under a tablist that says only one is selected. It also
 *     set `.open = true` on every `<details>`. This gate switches tabs and
 *     clicks summaries.
 *
 *  3. EVERY STATE IS SCANNED, NOT ONLY THE LAST ONE. The old driver walked all
 *     five exhibits, every dealer preset, both guessing-game answers, every
 *     learner check right and wrong — and then scanned ONCE, at the end. Almost
 *     all of that had been overwritten by the next click before anything
 *     measured it, and it swallowed every failure with `.catch(() => {})`, so a
 *     control that stopped existing would have been silently skipped.
 *
 *  4. IT SCANNED ONE VIEWPORT. This lab is a five-tab, table-heavy exhibit with
 *     a 560-unit-wide SVG chart; the phone width is where it is most at risk.
 *
 *  5. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. This lab is
 * a live case rather than a hypothetical one: `.reveal`, `.card-deal` and
 * `.card-flip` are applied to freshly rendered content, all three keyframe sets
 * start at `opacity: 0`, and the reduced-motion block sets `animation: none`
 * rather than collapsing the duration. That is safe only because each
 * animation's end state IS the element's natural state; change one keyframe to
 * end anywhere else, or add an `opacity: 0` to the base rule, and every dealt
 * card and every revealed row goes invisible for readers with the preference
 * set. This assertion is what notices — and the preference is genuinely in
 * effect while it runs, which is what the injected override made impossible.
 *
 * `aria-hidden` subtrees are excluded. The cost of that exclusion is stated
 * plainly: text removed from the accessibility tree AND painted at zero opacity
 * is not checked here.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * WCAG 1.4.11: a text-entry control whose only boundary is its border needs that
 * border at >= 3:1 against an adjacent surface.
 *
 * Carried over from the gate this replaces, which measured `.mono-input` once
 * per theme on the untouched page — before any tab but the first had even
 * rendered, so the number-and-range inputs in Break it and Compare were never
 * in the DOM when it ran. It is folded into `scan` here, so every control is
 * measured in every state it exists in, at both viewports.
 *
 * The backdrop walk composites plain `rgba()`/`rgb()` only; an unparseable value
 * (a `color-mix()`) is treated as transparent and the walk continues outward.
 * That is sound here because every surface a control sits on is a flat custom
 * property, and this page's `color-mix()` surface is the hero aside, which
 * contains no controls.
 */
export async function expectControlBordersContrast(page: Page, label: string): Promise<void> {
  const rows = await page.evaluate(() => {
    const parse = (c: string): number[] => {
      const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : [0, 0, 0, 0];
    };
    const comp = (fg: number[], bg: number[]): number[] =>
      [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat([1]);
    const lum = ([r, g, b]: number[]): number => {
      const f = (v: number): number => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number[], b: number[]): number => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const effBg = (start: Element | null): number[] => {
      const stack: number[][] = [];
      let node: Element | null = start;
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c[3] > 0) stack.push(c);
        if (c[3] >= 1) break;
        node = node.parentElement;
      }
      let bg = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i--) bg = comp(stack[i], bg);
      return bg;
    };
    const TEXTY = ['', 'text', 'number', 'password', 'email', 'search', 'url', 'tel'];
    const out: string[] = [];
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.tagName === 'INPUT' && !TEXTY.includes((el.getAttribute('type') || '').toLowerCase()))
        return;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        rect.width === 0 ||
        rect.height === 0
      )
        return;
      if ((parseFloat(cs.borderTopWidth) || 0) === 0) return;
      const outer = effBg(el.parentElement);
      const ownBg = parse(cs.backgroundColor);
      const inner = ownBg[3] >= 1 ? ownBg : comp(ownBg, outer);
      const borderRaw = parse(cs.borderTopColor);
      const best = Math.max(
        ratio(comp(borderRaw, outer), outer),
        ratio(comp(borderRaw, inner), inner)
      );
      if (best < 3) {
        out.push(
          `${Math.round(best * 100) / 100}:1 (needs 3:1) ` +
            `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} border ${cs.borderTopColor}`
        );
      }
    });
    return out;
  });
  expect(rows, `text-control border contrast (WCAG 1.4.11) in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert THE LAB'S DEFAULTS rather than assuming them.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page: a silent no-op there would leave the gate
 * certifying a different rendering than the one it claims to.
 *
 * The default assertions matter for the same reason. Which half of this lab a
 * scan measures is decided by state that ships in a particular position: the
 * stage arrives FACE DOWN, so the card backs are what a first-paint scan
 * measures and the revealed faces exist only after a click; only one of five tab
 * panels is in the document; and the Break-it exhibit opens on the honest
 * uniform dealer, whose verdict is the passing one — the leaking dealers are
 * behind preset buttons the drive presses.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // A click on a control that never becomes actionable otherwise burns the
  // whole test timeout and reports nothing useful. 20s turns that silent hang
  // into a named failure naming the locator.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // Every panel is rendered lazily by `src/main.ts` into an empty `<section>`,
  // so a navigation that resolves proves nothing.
  await expect(page.locator('.tab-btn')).toHaveCount(5);
  await expect(page.locator('#panel-protocol .stage')).toBeVisible();

  // Defaults, asserted:
  //  - exactly one exhibit is selected, and the other four are really hidden
  //    rather than merely unfocused;
  await expect(page.locator('#tab-protocol')).toHaveAttribute('aria-selected', 'true');
  for (const key of ['why', 'leak', 'break', 'compare']) {
    await expect(page.locator(`#tab-${key}`)).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator(`#panel-${key}`)).toBeHidden();
  }
  //  - the stage arrives face down, so the first scan measures the card BACKS;
  await expect(page.locator('#stage-reveal')).toHaveText('Cut and reveal');
  //  - the guided tour is an invitation, not a running overlay;
  await expect(page.locator('#tour-invite')).toBeVisible();
  await expect(page.locator('#tour-bar')).toHaveCount(0);
  //  - and nothing is disclosed.
  await expect(page.locator('details[open]')).toHaveCount(0);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: it lays five cards out in a row, prints a full
 * indistinguishability table and a five-column comparison grid, draws a
 * 560-unit-wide SVG chart, and puts a five-tab tablist above all of it.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide box inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element. That
    // cost a run elsewhere in this fleet, and this lab is full of the same
    // decoy: every wide table is inside a `.table-wrap` that scrolls.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    // Prefer an unclipped culprit; fall back to the widest clipped one rather
    // than reporting nothing, so the message always names something to look at.
    const widest = over.filter((x) => !clipped(x.el))[0] ?? over[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${clipped(widest.el) ? '[clipped] ' : ''}${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + String(widest.el.getAttribute('class')).trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 *
 * `dom.ts`'s `scrollRegion()` already builds its wrappers that way, and this
 * assertion is what keeps it true — and what catches the containers that become
 * scrollers only in some states, which is the systematic miss: a region sized
 * for its content on a 1280px viewport is a scroller at 380px, and a
 * `role="log"`-shaped feed only overflows after a long enough run.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * When `A11Y_COLLECT` is set, `scan` records failures instead of throwing.
 *
 * A strict gate reports the first failing assertion in the first failing state
 * and stops, so a page with defects in several states needs one full run per
 * defect to enumerate them. The collection pass turns that into a single run.
 * It is a debugging aid only: `A11Y_COLLECT` is never set in CI or in the
 * committed workflow, and a run with it set prints a banner and fails at the
 * end, so a green collection run cannot be mistaken for a green gate.
 */
const COLLECTING = !!process.env.A11Y_COLLECT;
const collected: string[] = [];

function record(entry: string): void {
  collected.push(entry);
  // Printed as it happens, not only at the end: a hard assertion later in the
  // drive would otherwise abort the test before anything collected so far was
  // ever shown.
  console.log(`\n[A11Y_COLLECT #${collected.length}] ${entry}`);
}

function softExpect(actual: unknown, message: string, expected: unknown): void {
  if (!COLLECTING) {
    expect(actual, message).toEqual(expected);
    return;
  }
  try {
    expect(actual, message).toEqual(expected);
  } catch {
    record(`${message}\n  ${JSON.stringify(actual, null, 2)}`);
  }
}

/**
 * Fail the test if the collection pass recorded anything.
 *
 * Without this a collection run would end green, and a green collection run is
 * indistinguishable from a green gate — which is the exact confusion the whole
 * exercise exists to remove.
 */
export function reportCollected(): void {
  if (!COLLECTING) return;
  expect(collected, `A11Y_COLLECT recorded ${collected.length} failure(s)`).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Seven assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `expectNotBlank` — the reduced-motion end-state check above.
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those ratios
 *    arithmetically. Everything else in that bucket is a real result axe simply
 *    could not finish — including `aria-prohibited-attr`, which is where an
 *    `aria-label` on a role-less element hides, and `aria-required-children`,
 *    which is where an empty `role="list"` hides. Both are defects that never
 *    reach the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node,
 *    including the SVG chart's ticks and series labels, which sit inside a
 *    `role="img"` and are therefore invisible to axe's own contrast rule.
 *  - control-border contrast — WCAG 1.4.11, which axe does not check.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a
 * `::before` glyph, because a pseudo-element is not an element and owns no text
 * node. Both were being found by hand-sampling screenshot pixels, which does
 * not regress-test.
 *
 * The backlog is real, so this does not block on it — but a check that merely
 * logs is not a gate, and this sweep has spent its whole length deleting checks
 * that could not fail. So it ratchets instead: anything NOT in the baseline
 * fails, anything in the baseline that got WORSE fails, and anything in the
 * baseline that has been FIXED fails until its entry is deleted. That last rule
 * is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(`NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`);
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(`NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`);
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(
        `WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`
      );
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  softExpect(violations, `axe violations in state: ${label}`, []);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  softExpect(unexplainedIncomplete, `axe incomplete results in state: ${label}`, []);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  softExpect(contrast, `measured contrast failures in state: ${label}`, []);

  await softAsync(() => expectControlBordersContrast(page, label));
  await softAsync(() => expectScrollersReachable(page, label));
  await softAsync(() => expectNoHorizontalOverflow(page, label));
  await expectNoNewNonTextFailures(page, label);
}

async function softAsync(fn: () => Promise<void>): Promise<void> {
  if (!COLLECTING) return fn();
  try {
    await fn();
  } catch (e) {
    record(String(e).slice(0, 900));
  }
}

/**
 * Drive the lab through every state that renders content, scanning each.
 *
 * Five things shape this drive:
 *
 *  - NOTHING IS SWALLOWED. The driver this replaces wrapped every single click
 *    in `.catch(() => {})`, so a control that had been renamed, moved or broken
 *    was silently not pressed and the run stayed green having scanned less than
 *    it claimed. Every step here either lands or fails the test by name.
 *
 *  - THE FAILING TONE IS DRIVEN, NOT ONLY THE PASSING ONE. Break it opens on the
 *    honest uniform dealer and its `verdict-ok`; the leaking presets and their
 *    `verdict-fail` exist only after a press. The learner checks are the same
 *    shape — `pill-ok` and `pill-bad` are separate ink/surface pairs, so both
 *    are answered, right and wrong, and each is scanned where it appears rather
 *    than in whatever state survived to the end of the run.
 *
 *  - TABS ARE SWITCHED, NOT UN-HIDDEN, and the roving-tabindex keyboard route is
 *    driven too, because a tablist that only works with a mouse is a 2.1.1
 *    failure no axe rule catches.
 *
 *  - COMPLETION IS WAITED ON, NEVER TIMED. The old driver relied on
 *    `waitForTimeout` between steps. Each step here waits for the output the lab
 *    itself produces — a panel rendering, a verdict class, a button's label
 *    flipping.
 *
 *  - `<details>` ARE OPENED BY THEIR OWN SUMMARIES, one at a time, per exhibit,
 *    so the shut state is scanned too and a failure names the panel it belongs
 *    to.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  const scanAt = (s: string): Promise<void> => scan(page, `${theme} / ${s}`);

  /** Open every disclosure in the panel, one at a time, scanning each. */
  const openDisclosures = async (panel: string, tag: string): Promise<void> => {
    const details = page.locator(`#panel-${panel} details`);
    const count = await details.count();
    expect(count, `${tag} must have disclosures to open`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const d = details.nth(i);
      await d.locator('> summary').click();
      await expect(d).toHaveAttribute('open', '');
      await scanAt(`${tag}: disclosure ${i + 1} of ${count} open`);
    }
  };

  /** Click every button matched by `loc`, scanning after each. */
  const clickEach = async (loc: Locator, tag: string): Promise<void> => {
    const n = await loc.count();
    expect(n, `${tag} must match at least one control`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await loc.nth(i).click();
      await scanAt(`${tag} ${i + 1} of ${n}`);
    }
  };

  await scanAt('first paint — Perform tab, cards face down');

  await page.locator('a.cl-skip-link').focus();
  await scanAt('skip link focused');

  // ── The guided tour: a real overlay bar with its own controls ────────────
  await page.locator('#tour-invite button').click();
  await expect(page.locator('#tour-bar')).toBeVisible();
  await scanAt('guided mode started');

  await page.locator('#tour-bar button', { hasText: 'Continue' }).click();
  await scanAt('guided mode, step 2');

  await page.locator('#tour-bar button', { hasText: 'Back' }).click();
  await scanAt('guided mode, stepped back');

  await page.locator('#tour-bar button', { hasText: 'Exit tour' }).click();
  await expect(page.locator('#tour-bar')).toHaveCount(0);
  await scanAt('guided mode exited');

  // ── Exhibit 1: Perform ───────────────────────────────────────────────────
  const stage = page.locator('#stage-reveal');
  await stage.click();
  await expect(stage).toHaveText('Turn them back over');
  await scanAt('perform: cut and revealed — the faces, the read-off, the verdict');

  // Both bits on both sides, so every AND row renders at least once. The bit
  // buttons are 2 per player; pressing all four walks 1,1 -> 0,1 -> ... and each
  // combination changes the revealed row AND the output.
  await clickEach(page.locator('#panel-protocol .stage-bit .seg-btn'), 'perform: secret bit');

  // Every cut depth, live over a revealed row, then back to the random draw.
  await clickEach(page.locator('#panel-protocol .stage-cut .seg-btn'), 'perform: cut depth');

  await stage.click();
  await expect(stage).toHaveText('Cut and reveal');
  await scanAt('perform: turned back over — face down again after a reveal');

  await clickEach(page.locator('#panel-protocol .predict-opt'), 'perform: prediction option');

  await openDisclosures('protocol', 'perform');

  // The six-step walkthrough lives inside one of those disclosures and is now
  // open. Walk it forward, jump to the end, and reset.
  const nextStep = page.locator('#panel-protocol button', { hasText: 'Next step' });
  await page.locator('#hide-cut').click();
  await scanAt('perform: walkthrough, cut hidden');
  for (let i = 1; i <= 3; i++) {
    await nextStep.click();
    await scanAt(`perform: walkthrough advanced ${i} step(s)`);
  }
  await page.locator('#panel-protocol button', { hasText: 'Show all steps' }).click();
  await scanAt('perform: walkthrough, all six steps shown');
  await page.locator('#panel-protocol button', { hasText: 'Back to the start' }).click();
  await scanAt('perform: walkthrough reset to the start');

  // ── Exhibit 2: Correctness — reached by the keyboard, as a tablist must be ─
  await page.locator('#tab-protocol').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-why')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-why')).toBeVisible();
  await scanAt('correctness: reached by ArrowRight on the tablist');

  await page.locator('#panel-why .seg-wrap .seg-btn').first().click();
  await scanAt('correctness: one cut applied — a partial orbit');

  await page.locator('#panel-why button', { hasText: 'Apply all five' }).click();
  await scanAt('correctness: all five cuts applied — the orbit closes');

  await page.locator('#panel-why button', { hasText: 'Start over' }).click();
  await scanAt('correctness: start over');

  // Both starting groups: the orbit of a row whose spades touch and the orbit of
  // one where they are apart are the two halves of the correctness argument, and
  // only one of them is on screen at a time.
  await page.locator('#panel-why [data-start="SSHHH"]').click();
  await scanAt('correctness: switched to the touching-spades starting group');
  await page.locator('#panel-why button', { hasText: 'Apply all five' }).click();
  await scanAt('correctness: the other starting group, fully applied');

  await openDisclosures('why', 'correctness');

  const orbitRows = page.locator('#panel-why .orbit-row-btn');
  const orbitCount = await orbitRows.count();
  expect(orbitCount, 'the enumeration must list rows').toBeGreaterThan(0);
  await orbitRows.first().click();
  await scanAt('correctness: first enumerated row selected');
  await orbitRows.nth(orbitCount - 1).click();
  await scanAt('correctness: last enumerated row selected');

  // ── Exhibit 3: Privacy ───────────────────────────────────────────────────
  await page.locator('#tab-leak').click();
  await expect(page.locator('#panel-leak')).toBeVisible();
  await scanAt('privacy: opened');

  await clickEach(page.locator('#panel-leak .predict-opt'), 'privacy: prediction option');
  await clickEach(page.locator('#panel-leak .seg-wrap .seg-btn'), 'privacy: reveal scrubber');
  await openDisclosures('leak', 'privacy');

  // ── Exhibit 4: Break it ──────────────────────────────────────────────────
  await page.locator('#tab-break').click();
  await expect(page.locator('#panel-break')).toBeVisible();
  await scanAt('break it: opened on the honest uniform dealer');

  await clickEach(page.locator('#panel-break .predict-opt'), 'break it: prediction option');
  // Every preset dealer: the clean verdict and the leaking one are different
  // tones and only one of them exists at a time.
  await clickEach(page.locator('#panel-break .preset-btn'), 'break it: dealer preset');

  // A hand-built distribution, which is neither preset and reaches the
  // "custom" branch of the verdict.
  await page.locator('#cut-weight-0').fill('9');
  await page.locator('#cut-weight-0').dispatchEvent('input');
  await scanAt('break it: hand-built dealer distribution');

  await openDisclosures('break', 'break it');

  // The guessing game, both answers, so the right and the wrong feedback tones
  // are each scanned in the state that produced them.
  const deal = page.locator('#panel-break button', { hasText: 'Deal a round' });
  await deal.click();
  await scanAt('break it: a round dealt, awaiting a guess');
  await page.locator('#panel-break button', { hasText: 'Alice held 0' }).click();
  await scanAt('break it: guessed 0');
  await deal.click();
  await page.locator('#panel-break button', { hasText: 'Alice held 1' }).click();
  await scanAt('break it: guessed 1');
  await page.locator('#panel-break button', { hasText: 'Reset the score' }).click();
  await scanAt('break it: score reset');

  // ── Exhibit 5: Compare ───────────────────────────────────────────────────
  await page.locator('#tab-compare').click();
  await expect(page.locator('#panel-compare')).toBeVisible();
  await scanAt('compare: opened');

  // Across the crossover, so both the "both hold" and the "bound exhausted"
  // verdicts are rendered — and the chart is redrawn under each.
  await page.locator('#adversary-work').fill('20');
  await page.locator('#adversary-work').dispatchEvent('input');
  await scanAt('compare: attacker work below the crossover');

  await page.locator('#adversary-work').fill('300');
  await page.locator('#adversary-work').dispatchEvent('input');
  await scanAt('compare: attacker work past the crossover — the circuit bound is spent');

  await clickEach(page.locator('#panel-compare [data-kappa]'), 'compare: security parameter');
  await openDisclosures('compare', 'compare');

  // Every exit question, and both tones of its feedback.
  await clickEach(page.locator('#panel-compare .exit-q .check-opt'), 'compare: exit answer');

  // The matching task, deliberately misaligned first so the failing tone is
  // scanned, then a scan of the checked state.
  const selects = page.locator('#panel-compare .match-task select');
  const selectCount = await selects.count();
  expect(selectCount, 'the matching task must have selects').toBeGreaterThan(1);
  for (let i = 0; i < selectCount; i++) {
    await selects.nth(i).selectOption({ index: ((i + 1) % selectCount) + 1 });
  }
  await page.locator('#panel-compare button', { hasText: 'Check my answers' }).click();
  await scanAt('compare: matching task checked while deliberately misaligned');

  for (let i = 0; i < selectCount; i++) {
    await selects.nth(i).selectOption({ index: i + 1 });
  }
  await page.locator('#panel-compare button', { hasText: 'Check my answers' }).click();
  await scanAt('compare: matching task checked with the aligned answers');

  // ── Back to the first exhibit, to confirm a re-shown panel is not a new one ─
  await page.locator('#tab-protocol').click();
  await expect(page.locator('#panel-protocol')).toBeVisible();
  await scanAt('perform: re-opened, its earlier state preserved');
}
