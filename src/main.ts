import './style.css';
import { note, panelIntro, verdict } from './ui/dom.js';
import { type PanelKey, createTour } from './ui/tour.js';
import { renderProtocolPanel } from './ui/protocolPanel.js';
import { renderWhyPanel } from './ui/whyPanel.js';
import { renderLeakPanel } from './ui/leakPanel.js';
import { renderBreakPanel } from './ui/breakPanel.js';
import { renderComparePanel } from './ui/comparePanel.js';

const renderers: Record<PanelKey, (root: HTMLElement) => void> = {
  protocol: renderProtocolPanel,
  why: renderWhyPanel,
  leak: renderLeakPanel,
  break: renderBreakPanel,
  compare: renderComparePanel,
};

const rendered = new Set<PanelKey>();

function panelEl(key: PanelKey): HTMLElement {
  return document.getElementById(`panel-${key}`) as HTMLElement;
}

/**
 * Render a panel, and say so out loud if it cannot be rendered.
 *
 * Without this a throwing exhibit leaves an empty tab and a message only in the
 * devtools console — the learner sees a blank page and has no idea whether that is
 * the demo or their browser. The panel is marked rendered either way, so a failure
 * costs one blank exhibit rather than re-throwing on every tab switch.
 */
function ensureRendered(key: PanelKey): void {
  if (rendered.has(key)) return;
  const el = panelEl(key);
  try {
    renderers[key](el);
  } catch (err) {
    console.error(`panel "${key}" failed to render`, err);
    el.replaceChildren(
      panelIntro(
        'This exhibit could not run',
        'Something in this panel threw while rendering. That is a bug in this page or a capability its browser is missing — not a property of the five-card trick, and not a result you should read anything into.',
      ),
      verdict('fail', (err as Error)?.message ?? String(err), 'Error'),
      note(
        'caveat',
        'The most likely cause is a browser without WebCrypto, which this lab uses to draw the cut. It is unavailable on pages served over plain HTTP from anything other than localhost; reloading over HTTPS usually fixes it.',
      ),
    );
  }
  rendered.add(key);
}

const tour = createTour((key) => selectTab(key, false));

function selectTab(key: PanelKey, notifyTour = true): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
    const isActive = tab.dataset.panel === key;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    tab.classList.toggle('active', isActive);
    panelEl(tab.dataset.panel as PanelKey).hidden = !isActive;
  }
  ensureRendered(key);
  if (notifyTour) tour.onPanelShown(key);
}

function wireTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.panel as PanelKey));
    // Roving-tabindex arrow-key navigation across the tablist (WAI-ARIA pattern).
    tab.addEventListener('keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next >= 0) {
        e.preventDefault();
        tabs[next].focus();
        selectTab(tabs[next].dataset.panel as PanelKey);
      }
    });
  });
}

function start(): void {
  wireTabs();
  selectTab('protocol', false);
  const host = document.getElementById('tour-host');
  if (host) tour.mount(host);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
