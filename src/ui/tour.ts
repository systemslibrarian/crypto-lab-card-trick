/**
 * The lesson path through the five exhibits.
 *
 * The exhibits are an argument, not a menu: perform the trick, prove it is correct,
 * prove it is private, break the assumption it rests on, then place it beside how
 * computers do the same job. Read out of order they are five unrelated pages.
 *
 * The tour used to announce itself with a panel the size of the interaction it was
 * introducing, which pushed the cards below three screenfolds on a phone. It is now a
 * single control beside the tabs: off by default, one click to follow the path, and
 * one click to leave. Starting it focuses the first *action* rather than merely
 * selecting a tab, so "guided" means the learner is standing in front of the cards.
 *
 * Progress lives in sessionStorage: it survives a reload, and it dies with the tab.
 */

import { clear, h, resetPredictions, scrollIntoCentre, srOnly } from './dom.js';

export type PanelKey = 'protocol' | 'why' | 'leak' | 'break' | 'compare';

interface Stop {
  key: PanelKey;
  label: string;
  blurb: string;
  /** The one control this stop wants the learner's hands on. */
  focus?: string;
}

const STOPS: readonly Stop[] = [
  {
    key: 'protocol',
    label: 'Perform it',
    blurb:
      'Set the two secret bits, cut, and reveal. Then change the cut and watch the row move under an answer that does not.',
    focus: 'stage-reveal',
  },
  {
    key: 'why',
    label: 'Prove it is correct',
    blurb:
      'Ten possible rows, two groups, and no cut that ever crosses between them. Apply every cut to one row and fail to escape.',
  },
  {
    key: 'leak',
    label: 'Prove it is private',
    blurb:
      'The answer survived the cut — but did the secrets? Compare the three input pairs that give the same answer, one reveal at a time.',
  },
  {
    key: 'break',
    label: 'Break the assumption',
    blurb:
      'All of that rested on one word: uniform. Make the dealer sloppy and watch a protocol with no computational assumptions fall apart anyway.',
  },
  {
    key: 'compare',
    label: 'Compare the models',
    blurb:
      'Why study a protocol that computes one gate? Because of what its security does not depend on.',
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
    host.append(stop === null ? invite() : bar());
    paintTabMap(stop);
  };

  const go = (next: number | null): void => {
    stop = next;
    save();
    paint();
    if (next === null) return;
    select(STOPS[next].key);
    // Focus the action, not the panel: a guided learner should find their hands on
    // the control the stop is about, which is also what makes the tour usable from
    // the keyboard alone.
    const target = STOPS[next].focus ? document.getElementById(STOPS[next].focus!) : null;
    if (target) {
      target.focus();
      scrollIntoCentre(target);
    } else {
      const el = document.getElementById(`panel-${STOPS[next].key}`);
      if (el) scrollIntoCentre(el);
    }
  };

  const invite = (): HTMLElement =>
    h(
      'div',
      { class: 'tour-invite', id: 'tour-invite' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost tour-toggle',
          'aria-pressed': 'false',
          onclick: () => {
            resetPredictions();
            go(0);
          },
        },
        h('span', { class: 'tour-toggle-icon', 'aria-hidden': 'true' }, '▸ '),
        'Guided mode',
      ),
      h('span', { class: 'tour-invite-hint' }, 'walks the five exhibits in order'),
    );

  const bar = (): HTMLElement => {
    const at = stop as number;
    const spec = STOPS[at];
    const last = at === STOPS.length - 1;
    return h(
      'aside',
      { class: 'tour-bar', id: 'tour-bar', 'aria-label': 'Guided mode' },
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
