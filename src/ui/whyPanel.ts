/**
 * Exhibit 2 — why the cut cannot change the answer.
 *
 * The proof is a partition, so the exhibit is a partition: all ten legal rows, drawn
 * as two rings of five. A learner can click a row and watch it travel round its own
 * ring under the cut, and can look for a cut that moves it to the other ring and
 * fail to find one, because there isn't one.
 *
 * The complete 4 × 5 protocol table sits underneath, recomputed in the browser and
 * checked against the hand-written vectors — the honest substitute for a KAT file
 * that does not exist for a protocol made of cardboard.
 */

import { ALL_INPUTS, ALL_SHIFTS, type Sequence } from '../cards/types.js';
import { cut, fromKey, layout, run, toKey } from '../cards/protocol.js';
import { orbits, spadeGap } from '../cards/necklace.js';
import { PROTOCOL_VECTORS } from '../cards/vectors.js';
import { ringEl, rowEl } from './cards.js';
import {
  TERMS,
  bridge,
  clear,
  code,
  disclosure,
  h,
  learnerCheck,
  note,
  panelIntro,
  scrollRegion,
  termAside,
  verdict,
} from './dom.js';

export function renderWhyPanel(root: HTMLElement): void {
  root.replaceChildren(
    panelIntro(
      'Why the cut cannot change the answer',
      'There are only ten ways to lay two spades among three hearts. Cutting the deck shuffles those ten arrangements among themselves — and it turns out they fall into exactly two groups, with no cut that ever gets you from one group to the other.',
      'That is the whole proof. The protocol’s job is just to make sure your inputs land in the right group.',
    ),
    termAside(TERMS.orbit),
    orbitSection(),
    counterSection(),
    note(
      'info',
      'Notice what makes five work: with two spades among five positions, the gap between them is 1 or 2 — and nothing else, because a gap of 3 is a gap of 2 measured the other way round. Two possible gaps, two groups, one output bit. A different deck size needs a different argument, not a bigger version of this one.',
    ),
    tableSection(),
    learnerCheck(
      'Could a cut ever turn a row where the spades are apart into one where they touch?',
      [
        { label: 'Yes, if you cut far enough', correct: false },
        { label: 'No — never, for any cut', correct: true },
        { label: 'Only for some starting rows', correct: false },
      ],
      'A cut rotates the ring. Rotating a ring moves every card, but it moves them all together, so who is standing next to whom never changes. The two groups above are closed: every row of one group cuts to another row of the same group, and the fifty combinations in the table below are the exhaustive check.',
    ),
    bridge(
      'The cut moves a row around inside its own group of five and can never leave it, so the answer is safe from the cut.',
      'The answer is safe from the cut — but is the learner’s SECRET safe from the row? Three different input pairs produce the “apart” group. Does the row say which one it was?',
      {
        label: 'See exactly what the row gives away →',
        onClick: () => document.getElementById('tab-leak')?.click(),
      },
    ),
  );
}

// ------------------------------------------------------------------- orbits

function orbitSection(): HTMLElement {
  const host = h('div', { class: 'orbit-grid' });
  const found = orbits();

  for (const orbit of found) {
    const rowsHost = h('div', { class: 'orbit-rows' });
    const ringHost = h('div', { class: 'orbit-ring' });
    let selected = 0;

    const paint = (): void => {
      clear(ringHost);
      ringHost.append(
        ringEl(orbit.rows[selected], { size: 190, showVerdict: true }),
        h(
          'p',
          { class: 'help' },
          `Row ${selected + 1} of 5 in this group. Gap between the spades: ${spadeGap(orbit.rows[selected])}.`,
        ),
      );
      for (const [i, btn] of buttons.entries()) {
        btn.setAttribute('aria-pressed', String(i === selected));
      }
    };

    const buttons = orbit.rows.map((row, i) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn seg-btn orbit-row-btn',
          'aria-pressed': String(i === 0),
          onclick: () => {
            selected = i;
            paint();
          },
        },
        toKey(row),
      ),
    );
    rowsHost.append(
      h(
        'div',
        { class: 'seg-wrap', role: 'group', 'aria-label': `Rows in the ${orbit.name} group` },
        ...buttons,
      ),
    );

    host.append(
      h(
        'section',
        { class: `orbit-card orbit-${orbit.name}` },
        h(
          'h3',
          {},
          orbit.name === 'adjacent' ? 'Group A — the spades touch' : 'Group B — the spades are apart',
          h('span', { class: `pill pill-${orbit.name === 'adjacent' ? 'ok' : 'neutral'}` }, `reads ${orbit.output}`),
        ),
        h(
          'p',
          { class: 'panel-sub' },
          `Five rows. Cut any of them by any amount and you land on another row of this same five — click through them and watch the ring turn without the picture changing shape.`,
        ),
        ringHost,
        rowsHost,
      ),
    );
    paint();
  }

  return h(
    'div',
    { class: 'orbit-section' },
    h('h3', { class: 'section-h' }, 'The ten rows, in their two groups'),
    host,
  );
}

// --------------------------------------------------- the exhaustive closure check

function counterSection(): HTMLElement {
  // Every row × every cut: does anything ever change group? Computed, not claimed.
  let crossings = 0;
  let checks = 0;
  for (const orbit of orbits()) {
    const members = new Set(orbit.rows.map(toKey));
    for (const row of orbit.rows) {
      for (const s of ALL_SHIFTS) {
        checks++;
        if (!members.has(toKey(cut(row, s)))) crossings++;
      }
    }
  }

  const escape = h('div', { class: 'escape-out', role: 'status', 'aria-live': 'polite' });
  const tryEscape = (): void => {
    const start = fromKey('HSHSH') as Sequence;
    const results = ALL_SHIFTS.map((s) => ({ s, row: cut(start, s) }));
    clear(escape);
    escape.append(
      h(
        'ul',
        { class: 'facts' },
        ...results.map((r) =>
          h(
            'li',
            {},
            code(`cut ${r.s} → ${toKey(r.row)}`),
            ` — gap ${spadeGap(r.row)}, still group B`,
          ),
        ),
      ),
      verdict('pass', 'no cut escaped the group; there was never one to find', 'Closed'),
    );
  };

  return h(
    'section',
    { class: 'aha' },
    h('h3', {}, 'Try to escape a group'),
    h(
      'p',
      { class: 'panel-sub' },
      'Start from ♥♠♥♠♥ — spades apart — and apply every cut there is. If even one of them landed in the touching group, the protocol would be wrong.',
    ),
    h(
      'div',
      { class: 'action-row' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: tryEscape }, 'Try all five cuts'),
    ),
    escape,
    h(
      'p',
      { class: 'help' },
      `Checked on load across every row and every cut: ${checks} combinations, ${crossings} of them changing group.`,
    ),
    crossings === 0
      ? verdict('pass', `all ${checks} row-and-cut combinations stayed in their own group`, 'Closed')
      : verdict('fail', `${crossings} combinations escaped their group`, 'Broken'),
  );
}

// --------------------------------------------------------- the complete table

function tableSection(): HTMLElement {
  const byKey = new Map(PROTOCOL_VECTORS.map((v) => [`${v.a}${v.b}${v.shift}`, v]));
  let mismatches = 0;

  const rows = ALL_INPUTS.flatMap((inputs) =>
    ALL_SHIFTS.map((s) => {
      const r = run(inputs, s);
      const expected = byKey.get(`${inputs.a}${inputs.b}${s}`);
      const ok = expected !== undefined && expected.revealed === toKey(r.revealed) && expected.output === r.output;
      if (!ok) mismatches++;
      return h(
        'tr',
        { class: r.output === 1 ? 'kat-row-one' : undefined },
        h('td', {}, `${inputs.a}, ${inputs.b}`),
        h('td', {}, String(s)),
        h('td', {}, code(toKey(r.beforeCut))),
        h('td', {}, code(toKey(r.revealed))),
        h('td', {}, r.adjacent ? 'touching' : 'apart'),
        h('td', {}, String(r.output)),
        h(
          'td',
          {},
          h(
            'span',
            { class: `pill pill-${ok ? 'ok' : 'bad'}` },
            h('span', { 'aria-hidden': 'true' }, ok ? '✓ ' : '✕ '),
            ok ? 'matches' : 'differs',
          ),
        ),
      );
    }),
  );

  return h(
    'section',
    { class: 'kat-group' },
    h('h3', {}, 'Every case there is — computed here, checked against the paper'),
    h(
      'p',
      { class: 'panel-sub' },
      'den Boer’s protocol is physical, so there is no published vector file to download. The honest equivalent is the entire table: four input pairs by five cuts. The right-hand column compares what this browser just computed against a hand-written transcription of the paper’s construction that shares no code with it.',
    ),
    scrollRegion(
      'The complete protocol table',
      h(
        'table',
        { class: 'kat-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, 'a, b'),
            h('th', { scope: 'col' }, 'cut'),
            h('th', { scope: 'col' }, 'before'),
            h('th', { scope: 'col' }, 'revealed'),
            h('th', { scope: 'col' }, 'spades'),
            h('th', { scope: 'col' }, 'reads'),
            h('th', { scope: 'col' }, 'vs. paper'),
          ),
        ),
        h('tbody', {}, ...rows),
      ),
    ),
    mismatches === 0
      ? verdict('pass', `all ${rows.length} cases match the hand-written vectors`, 'Verified')
      : verdict('fail', `${mismatches} of ${rows.length} cases disagree with the vectors`, 'Broken'),
    disclosure(
      'Read the table the other way',
      h(
        'p',
        {},
        'Collect the five revealed rows for each input pair and sort them. The three pairs whose answer is 0 give the same five rows; the pair whose answer is 1 gives five rows that appear nowhere else.',
      ),
      h(
        'ul',
        { class: 'facts' },
        ...ALL_INPUTS.map((inputs) =>
          h(
            'li',
            {},
            code(`a=${inputs.a} b=${inputs.b}`),
            ': ',
            code(
              ALL_SHIFTS.map((s) => toKey(run(inputs, s).revealed))
                .sort()
                .join(' '),
            ),
          ),
        ),
      ),
      h(
        'p',
        {},
        'Sets being equal is a stronger statement than a picture: it means no row exists that one of the three could have produced and another could not. The next exhibit turns that into probabilities.',
      ),
    ),
    disclosure(
      'The layout, written out',
      h('p', {}, 'For reference, the four starting rows before any cut:'),
      h(
        'div',
        { class: 'layout-list' },
        ...ALL_INPUTS.map((inputs) =>
          h(
            'div',
            { class: 'layout-item' },
            h('span', { class: 'layout-label' }, `a=${inputs.a}, b=${inputs.b}`),
            rowEl(layout(inputs), {
              showOwners: true,
              ariaLabel: `Layout for a equals ${inputs.a} and b equals ${inputs.b}: ${toKey(layout(inputs))}`,
            }),
          ),
        ),
      ),
    ),
  );
}
