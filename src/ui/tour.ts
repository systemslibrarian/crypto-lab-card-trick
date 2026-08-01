/**
 * A guided path through the five exhibits.
 *
 * The exhibits are an argument, not a menu: the protocol establishes that the answer
 * survives the cut, the orbit picture says why, the leak table asks what the row
 * costs, the broken dealer shows what the guarantee was resting on, and the
 * comparison says why any of it matters. Read out of order they are five unrelated
 * pages. The tour exists so a newcomer gets the argument, and it stays entirely
 * optional so an expert can ignore it.
 *
 * Progress lives in sessionStorage: it survives a reload, and it dies with the tab.
 */

import { clear, h, resetPredictions, scrollIntoCentre, srOnly } from './dom.js';

export type PanelKey = 'protocol' | 'why' | 'leak' | 'break' | 'compare';

interface Stop {
  key: PanelKey;
  label: string;
  blurb: string;
}

const STOPS: readonly Stop[] = [
  {
    key: 'protocol',
    label: 'Deal the cards',
    blurb:
      'Set the two secret bits, choose how far to cut, and step through the protocol. Then look at all five cuts at once and notice that the answer never moves.',
  },
  {
    key: 'why',
    label: 'See why the cut is harmless',
    blurb:
      'Ten possible rows, two groups, and no cut that ever crosses between them. This is the whole proof, and you can click every case in it.',
  },
  {
    key: 'leak',
    label: 'Ask what the row costs',
    blurb:
      'The answer survived the cut — but did the secrets? Compare the probability tables for the three input pairs that give the same answer.',
  },
  {
    key: 'break',
    label: 'Break the dealer',
    blurb:
      'All of that rested on one word: uniform. Move the sliders and watch a protocol with no computational assumptions fall apart anyway.',
  },
  {
    key: 'compare',
    label: 'Place it next to a computer',
    blurb:
      'Why does anyone study a protocol that computes one gate? Because of what its security does not depend on.',
  },
];

const KEY = 'card-trick-tour';

interface TourApi {
  mount: (host: HTMLElement) => void;
  /** Called by main.ts when the learner changes tab by hand. */
  onPanelShown: (key: PanelKey) => void;
}

export function createTour(select: (key: PanelKey) => void): TourApi {
  let stop = load();
  let host: HTMLElement | null = null;

  const save = (): void => {
    try {
      if (stop === null) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, String(stop));
    } catch {
      // Private-mode storage refusal is not a reason to break the tour.
    }
  };

  const paint = (): void => {
    if (!host) return;
    clear(host);
    if (stop === null) {
      host.append(invite());
      paintTabMap(null);
      return;
    }
    host.append(bar());
    paintTabMap(stop);
  };

  const go = (next: number | null): void => {
    stop = next;
    save();
    paint();
    if (next !== null) {
      select(STOPS[next].key);
      const el = document.getElementById(`panel-${STOPS[next].key}`);
      if (el) scrollIntoCentre(el);
    }
  };

  const invite = (): HTMLElement =>
    h(
      'aside',
      { class: 'tour-invite', id: 'tour-invite', 'aria-label': 'Guided tour' },
      h(
        'div',
        { class: 'tour-invite-main' },
        h('p', { class: 'tour-invite-title' }, 'New to this? The five exhibits are one argument.'),
        h(
          'p',
          { class: 'tour-invite-promise' },
          'Five stops, in order: deal the cards, see why the cut is harmless, ask what the reveal costs, break it yourself, then place it next to how computers do the same job. You can leave at any point and everything stays where it is.',
        ),
      ),
      h(
        'div',
        { class: 'tour-invite-actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary tour-start-btn',
            onclick: () => {
              resetPredictions();
              go(0);
            },
          },
          'Start the guided tour',
        ),
        h('span', { class: 'help' }, `${STOPS.length} stops · no account, nothing stored`),
      ),
    );

  const bar = (): HTMLElement => {
    const at = stop as number;
    const spec = STOPS[at];
    const last = at === STOPS.length - 1;
    return h(
      'aside',
      { class: 'tour-bar', id: 'tour-bar', 'aria-label': 'Guided tour' },
      h(
        'div',
        { class: 'tour-head' },
        h('span', { class: 'tour-tag' }, `STOP ${at + 1} OF ${STOPS.length}`),
        h('span', { class: 'tour-label' }, spec.label),
        h(
          'div',
          { class: 'tour-actions' },
          at > 0
            ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(at - 1) }, 'Back')
            : null,
          h(
            'button',
            { type: 'button', class: 'btn btn-primary', onclick: () => go(last ? null : at + 1) },
            last ? 'Finish' : 'Continue',
          ),
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(null) }, 'Exit tour'),
        ),
      ),
      h('p', { class: 'tour-blurb' }, spec.blurb),
      h(
        'div',
        { class: 'tour-dots', role: 'img', 'aria-label': `Stop ${at + 1} of ${STOPS.length}` },
        ...STOPS.map((_, i) =>
          h('span', { class: `tour-dot ${i < at ? 'tour-dot-done' : i === at ? 'tour-dot-now' : ''}` }),
        ),
      ),
    );
  };

  /** While the tour runs, the tab strip doubles as the lesson map. */
  const paintTabMap = (at: number | null): void => {
    for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
      const idx = STOPS.findIndex((s) => s.key === tab.dataset.panel);
      const done = at !== null && idx >= 0 && idx < at;
      tab.classList.toggle('tab-done', done);
      const existing = tab.querySelector('.tab-tick');
      if (done && !existing) {
        tab.append(
          h('span', { class: 'tab-tick', 'aria-hidden': 'true' }, ' ✓'),
          srOnly(' (visited on the tour)'),
        );
      } else if (!done && existing) {
        existing.remove();
        tab.querySelector('.sr-only')?.remove();
      }
    }
  };

  return {
    mount(el: HTMLElement) {
      host = el;
      paint();
      if (stop !== null) select(STOPS[stop].key);
    },
    onPanelShown(key: PanelKey) {
      // Jumping ahead by hand advances the tour rather than fighting it.
      if (stop === null) return;
      const idx = STOPS.findIndex((s) => s.key === key);
      if (idx >= 0 && idx !== stop) {
        stop = idx;
        save();
        paint();
      }
    },
  };
}

function load(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < STOPS.length ? n : null;
  } catch {
    return null;
  }
}
