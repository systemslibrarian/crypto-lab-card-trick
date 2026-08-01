/** Tiny, dependency-free DOM helpers shared by the panels. */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined;

/** Hyperscript: h('button', { class: 'x', onclick: fn }, 'label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

/** The SVG namespace equivalent, for the ring diagram. */
export function svg(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

function applyAttrs(node: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      node.setAttribute('class', String(value));
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
}

function append(node: Element, children: Child[]): void {
  for (const c of children) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

export function clear(node: Element): void {
  node.replaceChildren();
}

/**
 * Bring an element into view, honouring the user's motion preference.
 *
 * `@media (prefers-reduced-motion)` sets `scroll-behavior: auto`, but a `behavior`
 * passed to scrollIntoView overrides the stylesheet — so the CSS says one thing and
 * the JS quietly does another. Asking matchMedia here is what actually keeps that
 * promise.
 */
export function scrollIntoCentre(target: Element): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * Text for assistive technology only.
 *
 * Used where a state is shown visually as an icon and a colour: WCAG 1.4.1 says
 * colour cannot be the only channel, and a bare glyph is not a word. `display: none`
 * would hide it from screen readers too, which is the opposite of the point.
 */
export function srOnly(text: string): HTMLElement {
  return h('span', { class: 'sr-only' }, text);
}

/**
 * A pass/fail/alarm verdict: icon + text + colour, never colour alone (WCAG 1.4.1).
 *
 * Colour here tracks the *integrity of the protocol*, not the value of the AND. A
 * run whose answer is 0 is not a failure, and a run that leaked Alice's bit is not a
 * success just because it produced the right answer — so `alarm` is reserved for
 * "the cards gave away something they should not have".
 */
export function verdict(
  state: 'pass' | 'fail' | 'alarm',
  text: string,
  word?: string,
): HTMLElement {
  const icon = state === 'pass' ? '✓' : state === 'alarm' ? '⚠' : '✕';
  const label = word ?? (state === 'pass' ? 'Secure' : state === 'alarm' ? 'Leaking' : 'Rejected');
  return h(
    'div',
    { class: `verdict verdict-${state}`, role: 'status' },
    h('span', { class: 'verdict-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'verdict-word' }, `${label}: `),
    h('span', {}, text),
  );
}

/** Section heading + intro paragraph(s) for a panel. */
export function panelIntro(title: string, ...paras: (string | HTMLElement)[]): HTMLElement {
  return h(
    'div',
    { class: 'panel-intro' },
    h('h2', {}, title),
    ...paras.map((p) => (typeof p === 'string' ? h('p', {}, p) : p)),
  );
}

/** A scoping / caveat / danger note. */
export function note(kind: 'info' | 'danger' | 'caveat', ...children: Child[]): HTMLElement {
  return h('p', { class: `callout callout-${kind}` }, ...children);
}

/** Inline code. */
export function code(text: string): HTMLElement {
  return h('code', {}, text);
}

/** A labelled read-only value. */
export function field(label: string, value: string | HTMLElement, sub?: string): HTMLElement {
  return h(
    'div',
    { class: 'field' },
    h(
      'span',
      { class: 'field-label' },
      label,
      sub ? h('span', { class: 'field-sub' }, ` ${sub}`) : null,
    ),
    typeof value === 'string' ? h('code', { class: 'field-value' }, value) : value,
  );
}

/** A big single number with a caption — the figures the break-it exhibit moves. */
export function statTile(
  label: string,
  value: string,
  caption: string,
  tone: 'ok' | 'alarm' | 'neutral' = 'neutral',
): HTMLElement {
  return h(
    'div',
    { class: `stat stat-${tone}` },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, value),
    h('span', { class: 'stat-caption' }, caption),
  );
}

/** An external link. */
export function extLink(href: string, text: string): HTMLElement {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
}

/** An external link to a sibling lab. */
export function labLink(slug: string, text = slug): HTMLElement {
  return extLink(`https://systemslibrarian.github.io/${slug}/`, text);
}

/** A collapsible details block. */
export function disclosure(summary: string, ...children: Child[]): HTMLElement {
  return h(
    'details',
    { class: 'disclose' },
    h('summary', {}, summary),
    h('div', { class: 'disclose-body' }, ...children),
  );
}

/** A scrollable region, wired for keyboard access as the a11y gate requires. */
export function scrollRegion(label: string, ...children: Child[]): HTMLElement {
  return h(
    'div',
    { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': label },
    ...children,
  );
}

/**
 * A "predict before you reveal" check: one misconception, a couple of choices, an
 * immediate explanation. No score or gamification; the lab is fully usable whether
 * or not it is answered.
 */
export function learnerCheck(
  question: string,
  options: { label: string; correct: boolean }[],
  explanation: string,
): HTMLElement {
  const feedback = h('div', { class: 'check-feedback', role: 'status', 'aria-live': 'polite' });
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost check-opt',
        onclick: () => {
          clear(feedback);
          feedback.append(
            h(
              'span',
              { class: `pill pill-${o.correct ? 'ok' : 'bad'}` },
              h('span', { 'aria-hidden': 'true' }, o.correct ? '✓ ' : '✕ '),
              o.correct ? 'Correct' : 'Not quite',
            ),
            h('p', { class: 'check-explain' }, explanation),
          );
        },
      },
      o.label,
    ),
  );
  return h(
    'details',
    { class: 'learner-check' },
    h('summary', {}, 'Quick check'),
    h(
      'div',
      { class: 'check-body' },
      h('p', { class: 'check-q' }, question),
      h('div', { class: 'input-row', role: 'group', 'aria-label': question }, ...buttons),
      feedback,
    ),
  );
}

// --------------------------------------------------------------- predictions
//
// The difference between testing recognition and testing understanding is WHEN the
// question is asked. A question after the reveal asks "did you read that?"; the same
// question before it asks "what do you expect, and why?" — and then the experiment
// either confirms or contradicts the learner, which is the moment learning happens.
//
// So a prediction is deliberately NOT graded at the point of answering. It is
// recorded, the experiment runs, and a debrief elsewhere on the page reports whether
// the learner was right. The two halves are linked by id.

interface Recorded {
  chosen: number;
  correct: boolean;
  label: string;
}

const predictions = new Map<string, Recorded>();
const predictionListeners = new Map<string, Set<() => void>>();

function notify(id: string): void {
  for (const fn of predictionListeners.get(id) ?? []) fn();
}

/** Clear every recorded prediction — used when the guided tour restarts. */
export function resetPredictions(): void {
  const ids = [...predictions.keys()];
  predictions.clear();
  for (const id of ids) notify(id);
}

/**
 * Ask before computing. Records the choice and acknowledges it, but does NOT say
 * whether it was right — that is the experiment's job, reported by `predictionDebrief`.
 */
export function prediction(
  id: string,
  question: string,
  options: { label: string; correct: boolean }[],
): HTMLElement {
  const status = h('div', { class: 'predict-status', role: 'status', 'aria-live': 'polite' });
  const buttons = options.map((o, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost predict-opt',
        onclick: () => {
          predictions.set(id, { chosen: i, correct: o.correct, label: o.label });
          for (const b of buttons) b.classList.toggle('predict-chosen', b === buttons[i]);
          clear(status);
          status.append(
            h('span', { class: 'pill pill-neutral' }, 'Prediction recorded'),
            h(
              'p',
              { class: 'help' },
              'Now run the experiment below. The result will tell you whether you were right.',
            ),
          );
          notify(id);
        },
      },
      o.label,
    ),
  ) as HTMLButtonElement[];

  return h(
    'div',
    { class: 'predict' },
    h('span', { class: 'predict-tag' }, 'PREDICT FIRST'),
    h('p', { class: 'predict-q' }, question),
    h('div', { class: 'predict-opts', role: 'group', 'aria-label': question }, ...buttons),
    status,
  );
}

/**
 * The other half: after the experiment has run, say whether the prediction held and
 * why. Renders nothing conclusive until a prediction exists, so it never spoils it.
 */
export function predictionDebrief(id: string, explanation: string): HTMLElement {
  const box = h('div', { class: 'predict-debrief', role: 'status', 'aria-live': 'polite' });
  const paint = (): void => {
    clear(box);
    const got = predictions.get(id);
    if (!got) {
      box.append(
        h(
          'p',
          { class: 'help' },
          'You did not record a prediction for this one — scroll up and commit to an answer before running it again; being wrong on purpose is how the idea sticks.',
        ),
      );
      return;
    }
    box.append(
      h(
        'span',
        { class: `pill pill-${got.correct ? 'ok' : 'bad'}` },
        h('span', { 'aria-hidden': 'true' }, got.correct ? '✓ ' : '✕ '),
        got.correct ? 'Your prediction was right' : 'Your prediction was wrong',
      ),
      h('p', { class: 'check-explain' }, `You predicted: ${got.label}`),
      h('p', { class: 'check-explain' }, explanation),
    );
  };
  const set = predictionListeners.get(id) ?? new Set();
  set.add(paint);
  predictionListeners.set(id, set);
  paint();
  return box;
}

/**
 * A visible question — unlike `learnerCheck`, which hides in a disclosure. Used for
 * the exit check, where the whole point is that the learner cannot skip past it.
 */
export function exitQuestion(
  question: string,
  options: { label: string; correct: boolean }[],
  explanation: string,
): HTMLElement {
  const feedback = h('div', { class: 'check-feedback', role: 'status', 'aria-live': 'polite' });
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost check-opt',
        onclick: () => {
          clear(feedback);
          feedback.append(
            h(
              'span',
              { class: `pill pill-${o.correct ? 'ok' : 'bad'}` },
              h('span', { 'aria-hidden': 'true' }, o.correct ? '✓ ' : '✕ '),
              o.correct ? 'Correct' : 'Not quite',
            ),
            h('p', { class: 'check-explain' }, explanation),
          );
        },
      },
      o.label,
    ),
  );
  return h(
    'div',
    { class: 'exit-q' },
    h('p', { class: 'check-q' }, question),
    h('div', { class: 'input-row', role: 'group', 'aria-label': question }, ...buttons),
    feedback,
  );
}

/**
 * Match each claim to the thing that actually supports it — including the row where
 * the honest answer is "nothing in this protocol does".
 *
 * Selects rather than drag-and-drop: a native control is keyboard-operable, works on
 * a phone, and needs no custom accessibility work to be correct.
 */
export function matchingTask(opts: {
  idPrefix: string;
  rows: { threat: string; correct: string }[];
  choices: string[];
}): HTMLElement {
  const selects: HTMLSelectElement[] = [];
  const feedback = h('div', { class: 'check-feedback', role: 'status', 'aria-live': 'polite' });

  const body = opts.rows.map((row, i) => {
    const id = `${opts.idPrefix}-${i}`;
    const select = h('select', { id, class: 'mono-input styled-select' }) as HTMLSelectElement;
    select.append(h('option', { value: '' }, 'Choose an answer…') as HTMLOptionElement);
    for (const c of opts.choices) select.append(h('option', { value: c }, c) as HTMLOptionElement);
    selects.push(select);
    return h(
      'div',
      { class: 'match-row' },
      h('label', { for: id, class: 'match-threat' }, row.threat),
      select,
    );
  });

  const check = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        clear(feedback);
        const wrong = opts.rows.filter((row, i) => selects[i].value !== row.correct);
        const unanswered = selects.filter((sel) => sel.value === '').length;
        selects.forEach((sel, i) => {
          sel.classList.toggle('match-ok', sel.value !== '' && sel.value === opts.rows[i].correct);
          sel.classList.toggle('match-bad', sel.value !== '' && sel.value !== opts.rows[i].correct);
        });
        feedback.append(
          h(
            'span',
            { class: `pill pill-${wrong.length === 0 ? 'ok' : 'bad'}` },
            h('span', { 'aria-hidden': 'true' }, wrong.length === 0 ? '✓ ' : '✕ '),
            wrong.length === 0
              ? `All ${opts.rows.length} matched`
              : `${wrong.length} of ${opts.rows.length} not matched yet${unanswered ? ` (${unanswered} left blank)` : ''}`,
          ),
          ...wrong.map((row) =>
            h('p', { class: 'check-explain' }, `“${row.threat}” → ${row.correct}`),
          ),
        );
      },
    },
    'Check my answers',
  );

  return h(
    'div',
    { class: 'match-task' },
    ...body,
    h('div', { class: 'action-row' }, check),
    feedback,
  );
}

/**
 * The closing line of a panel: what this established, and what it makes you ask next.
 * Without these the exhibits read as five peers rather than one argument.
 */
export function bridge(
  established: string,
  next: string,
  action?: { label: string; onClick: () => void },
): HTMLElement {
  return h(
    'aside',
    { class: 'bridge', 'aria-label': 'Where this leads' },
    h(
      'p',
      { class: 'bridge-line' },
      h('span', { class: 'bridge-label' }, 'What this established: '),
      established,
    ),
    h(
      'p',
      { class: 'bridge-line' },
      h('span', { class: 'bridge-label' }, 'What it makes you ask: '),
      next,
    ),
    action
      ? h(
          'button',
          { type: 'button', class: 'btn btn-primary bridge-btn', onclick: action.onClick },
          action.label,
        )
      : null,
  );
}

/**
 * The one term a stage actually needs, shown beside that stage.
 *
 * A definition list rather than an `aside` on purpose: scaffolding, not a landmark,
 * so it adds nothing for a screen reader to navigate past.
 */
export function termAside(entry: { term: string; plain: string; formal?: string }): HTMLElement {
  return h(
    'dl',
    { class: 'term-aside' },
    h('dt', {}, h('span', { class: 'term-aside-tag' }, 'TERM'), entry.term),
    h(
      'dd',
      {},
      entry.plain,
      entry.formal ? h('span', { class: 'glossary-formal' }, ` ${entry.formal}`) : null,
    ),
  );
}

/**
 * Jargon scaffolding: a collapsed definition list a newcomer can open the moment a
 * term stops making sense, without the terms being pre-chewed for readers who
 * already know them.
 */
export function glossary(entries: { term: string; plain: string; formal?: string }[]): HTMLElement {
  return h(
    'details',
    { class: 'disclose glossary' },
    h('summary', {}, 'Glossary — the words this page uses'),
    h(
      'dl',
      { class: 'glossary-body' },
      ...entries.flatMap((e) => [
        h('dt', {}, e.term),
        h(
          'dd',
          {},
          e.plain,
          e.formal ? h('span', { class: 'glossary-formal' }, ` ${e.formal}`) : null,
        ),
      ]),
    ),
  );
}

/** The terms this lab uses, defined once and shared by the glossary and the asides. */
export const TERMS: Record<string, { term: string; plain: string; formal?: string }> = {
  mpc: {
    term: 'Secure multi-party computation (MPC)',
    plain:
      'Two or more people jointly compute an answer from private inputs, and nobody learns anything except the answer.',
    formal: 'The five-card trick is a two-party MPC protocol for a single AND gate.',
  },
  itSecure: {
    term: 'Information-theoretically secure',
    plain:
      'Safe even against an opponent with unlimited time and unlimited computers — because there is literally nothing in what they see to work from.',
    formal: 'Formally: the adversary’s view has the same distribution for every secret.',
  },
  commitment: {
    term: 'Commitment',
    plain:
      'Fixing a value now without revealing it, so you cannot change your mind later. Here: two face-down cards whose order is the secret.',
  },
  cut: {
    term: 'Random cut',
    plain:
      'Lifting some number of cards off the top and putting them underneath, so the ring of cards is rotated by an amount nobody knows.',
    formal: 'The uniform distribution over the cyclic group Z5 acting on the five positions.',
  },
  tv: {
    term: 'Total variation distance',
    plain:
      'How different two random outcomes look. 0 means no test whatsoever can tell them apart; 1 means one glance settles it.',
    formal: 'TV(P,Q) = ½·Σ|P(x) − Q(x)|; the optimal distinguisher succeeds with probability ½ + TV/2.',
  },
  orbit: {
    term: 'Orbit',
    plain:
      'All the arrangements you can reach from one arrangement by cutting. The cut can move you around inside an orbit and never out of it.',
    formal: 'The orbits of the Z5 action on the ten legal rows: two of them, five rows each.',
  },
  garbled: {
    term: 'Garbled circuit',
    plain:
      'The standard way computers do this job: encrypt a Boolean circuit gate by gate so the other side can evaluate it without learning the inputs.',
    formal: 'Yao 1986; secure under a computational assumption, not an information-theoretic one.',
  },
};
