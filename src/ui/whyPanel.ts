/**
 * Exhibit 2 — why the cut cannot change the answer.
 *
 * The proof is that the cut's orbits partition the ten legal rows into two blocks, so
 * the exhibit is a *transformation* rather than two lists: one row in the middle, five
 * cut buttons around it, and two buckets that fill as the learner applies them. Every
 * result lands in the bucket it started in, and the learner discovers that by trying to
 * make it not happen.
 *
 * The completed enumeration is still here — all ten rows, both orbits — but behind a
 * disclosure, because a finished table is what you check *after* you believe the claim,
 * not how you come to believe it.
 */

import { ALL_INPUTS, ALL_SHIFTS, type Sequence, type Shift } from '../cards/types.js';
import { cut, fromKey, layout, run, toKey } from '../cards/protocol.js';
import { orbitName, orbits, spadeGap } from '../cards/necklace.js';
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
  srOnly,
  termAside,
  verdict,
} from './dom.js';

/**
 * The two blocks, named by shape rather than by colour.
 *
 * `♠♠` and `♠♥♠` survive greyscale, deuteranopia, a printout and a screen reader —
 * which a green border and a red border do not. The colours are still there; they are
 * just no longer the only thing carrying the distinction.
 */
const GROUP = {
  adjacent: { glyph: '♠♠', title: 'Group A — the spades touch', reads: 1 },
  separated: { glyph: '♠♥♠', title: 'Group B — the spades are apart', reads: 0 },
} as const;

const STARTS: readonly { key: string; label: string }[] = [
  { key: 'HSHSH', label: 'a row where the spades are apart' },
  { key: 'SSHHH', label: 'a row where the spades touch' },
];

export function renderWhyPanel(root: HTMLElement): void {
  root.replaceChildren(
    panelIntro(
      'Why the cut cannot change the answer',
      'There are only ten ways to lay two spades among three hearts. Cutting the deck shuffles those ten arrangements among themselves — and they fall into exactly two groups, with no cut that ever gets you from one group to the other.',
    ),
    termAside(TERMS.orbit),
    transformSection(),
    disclosure(
      'Show all 10 rows — the complete two-group enumeration',
      h(
        'p',
        {},
        'Both groups in full, with every row reachable from every other row of its own group. This is the finished partition; the experiment above is how you find it.',
      ),
      orbitSection(),
    ),
    note(
      'info',
      'Notice what makes five work: with two spades among five positions the gap between them is 1 or 2, and nothing else, because a gap of 3 is a gap of 2 measured the other way round. Two possible gaps, two groups, one output bit. A different deck size needs a different argument, not a bigger version of this one.',
    ),
    tableSection(),
    learnerCheck(
      'Could a cut ever turn a row where the spades are apart into one where they touch?',
      [
        { label: 'Yes, if you cut far enough', correct: false },
        { label: 'No — never, for any cut', correct: true },
        { label: 'Only for some starting rows', correct: false },
      ],
      'A cut rotates the ring. Rotating a ring moves every card, but it moves them all together, so who is standing next to whom never changes. The two groups are closed: every row of one group cuts to another row of the same group, and the fifty combinations checked above are the exhaustive version of that sentence.',
    ),
    bridge(
      'The cut moves a row around inside its own group of five and can never leave it, so the answer is safe from the cut.',
      'The answer is safe from the cut — but is the SECRET safe from the row? Three different input pairs produce the “apart” group. Does the row say which one it was?',
      {
        label: 'See exactly what the row gives away →',
        onClick: () => document.getElementById('tab-leak')?.click(),
      },
    ),
  );
}

// ------------------------------------------------------- the transformation

function transformSection(): HTMLElement {
  let startKey = STARTS[0].key;
  const applied = new Set<Shift>();

  const stage = h('div', { class: 'transform-stage' });
  const bucketHost = h('div', { class: 'bucket-grid' });
  const status = h('p', { class: 'transform-status', role: 'status', 'aria-live': 'polite' });
  const cutButtons: HTMLButtonElement[] = [];

  const paint = (): void => {
    const start = fromKey(startKey) as Sequence;
    const home = orbitName(start);

    clear(stage);
    stage.append(
      h('span', { class: 'transform-caption' }, 'The row on the table'),
      ringEl(start, { size: 168, showVerdict: true }),
      rowEl(start, { markSpades: true, ariaLabel: `The starting row ${startKey}` }),
      h(
        'span',
        { class: 'group-chip' },
        h('span', { class: 'group-glyph', 'aria-hidden': 'true' }, GROUP[home].glyph),
        GROUP[home].title,
      ),
    );

    clear(bucketHost);
    for (const name of ['adjacent', 'separated'] as const) {
      const landed = [...applied]
        .map((s) => ({ s, row: cut(start, s) }))
        .filter((r) => orbitName(r.row) === name);
      bucketHost.append(
        h(
          'section',
          { class: `bucket bucket-${name}` },
          h(
            'h4',
            {},
            h('span', { class: 'group-glyph', 'aria-hidden': 'true' }, GROUP[name].glyph),
            GROUP[name].title,
            h('span', { class: 'pill pill-neutral' }, `reads ${GROUP[name].reads}`),
          ),
          landed.length === 0
            ? h('p', { class: 'bucket-empty' }, 'Nothing has landed here yet.')
            : h(
                'div',
                { class: 'bucket-rows' },
                ...landed.map((r) =>
                  h(
                    'div',
                    { class: 'bucket-row reveal' },
                    h('span', { class: 'bucket-row-label' }, `cut ${r.s}`),
                    rowEl(r.row, {
                      markSpades: true,
                      ariaLabel: `Cut ${r.s} gives ${toKey(r.row)}`,
                    }),
                  ),
                ),
              ),
        ),
      );
    }

    for (const b of cutButtons) {
      const s = Number(b.dataset.shift) as Shift;
      b.setAttribute('aria-pressed', String(applied.has(s)));
    }

    const crossed = [...applied].filter((s) => orbitName(cut(start, s)) !== home).length;
    clear(status);
    if (applied.size === 0) {
      status.append(
        h(
          'span',
          {},
          'Apply a cut and watch where the result lands. To break the protocol you would need one that crosses to the other group.',
        ),
      );
    } else {
      status.append(
        h(
          'span',
          {},
          `${applied.size} of 5 cuts applied. ${applied.size - crossed} stayed in ${GROUP[home].title.split('—')[0].trim()}; ${crossed} crossed.`,
        ),
      );
      if (applied.size === 5) {
        status.append(
          crossed === 0
            ? verdict('pass', 'every cut landed back in the same group — there was never one to find', 'Closed')
            : verdict('fail', `${crossed} cuts escaped the group`, 'Broken'),
        );
      }
    }
  };

  for (const s of ALL_SHIFTS) {
    cutButtons.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn seg-btn',
          'data-shift': String(s),
          'aria-pressed': 'false',
          onclick: () => {
            applied.add(s);
            paint();
          },
        },
        `cut ${s}`,
      ) as HTMLButtonElement,
    );
  }

  const startButtons = STARTS.map((opt) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost',
        'aria-pressed': String(opt.key === startKey),
        onclick: () => {
          startKey = opt.key;
          applied.clear();
          for (const b of startButtons) {
            b.setAttribute('aria-pressed', String(b.dataset.start === opt.key));
          }
          paint();
        },
        'data-start': opt.key,
      },
      `Start from ${opt.label}`,
    ),
  ) as HTMLButtonElement[];

  paint();

  return h(
    'section',
    { class: 'aha' },
    h('h3', {}, 'Try to escape the group'),
    h(
      'p',
      { class: 'panel-sub' },
      'Take one row and apply every cut there is. If even one result landed in the other group, the answer would depend on how the deck was cut — and the protocol would be wrong.',
    ),
    h(
      'div',
      { class: 'preset-row', role: 'group', 'aria-label': 'Choose the starting row' },
      ...startButtons,
    ),
    h(
      'div',
      { class: 'transform-layout' },
      stage,
      h(
        'div',
        { class: 'transform-controls' },
        h('span', { class: 'control-label', id: 'apply-cut-label' }, 'Apply a cut'),
        h(
          'div',
          { class: 'seg-wrap', role: 'group', 'aria-labelledby': 'apply-cut-label' },
          ...cutButtons,
        ),
        h(
          'div',
          { class: 'action-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary',
              onclick: () => {
                for (const s of ALL_SHIFTS) applied.add(s);
                paint();
              },
            },
            'Apply all five',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-ghost',
              onclick: () => {
                applied.clear();
                paint();
              },
            },
            'Start over',
          ),
        ),
      ),
    ),
    bucketHost,
    status,
    exhaustiveNote(),
  );
}

/** The machine check behind the hand experiment: every row, every cut, on load. */
function exhaustiveNote(): HTMLElement {
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
  return h(
    'p',
    { class: 'help' },
    `Checked exhaustively when this page loaded, not just for the row above: all ${checks} combinations of a legal row and a cut, `,
    h('strong', {}, `${crossings} of them changing group`),
    '.',
  );
}

// ---------------------------------------------------- the finished enumeration

function orbitSection(): HTMLElement {
  const host = h('div', { class: 'orbit-grid' });

  for (const orbit of orbits()) {
    const rowsHost = h('div', { class: 'orbit-rows' });
    const ringHost = h('div', { class: 'orbit-ring' });
    let selected = 0;

    const paint = (): void => {
      clear(ringHost);
      ringHost.append(
        ringEl(orbit.rows[selected], { size: 180, showVerdict: true }),
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
        { class: 'seg-wrap', role: 'group', 'aria-label': `Rows in ${GROUP[orbit.name].title}` },
        ...buttons,
      ),
    );

    host.append(
      h(
        'section',
        { class: `orbit-card bucket-${orbit.name}` },
        h(
          'h4',
          {},
          h('span', { class: 'group-glyph', 'aria-hidden': 'true' }, GROUP[orbit.name].glyph),
          GROUP[orbit.name].title,
          h('span', { class: 'pill pill-neutral' }, `reads ${orbit.output}`),
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
    host,
    h(
      'p',
      { class: 'help' },
      'Each group is closed under the cut: pick any row and its five cuts are the five rows of that same group, in some order. ',
      code('orbitOf'),
      ' in necklace.ts computes exactly that, and the tests assert both groups have five rows and share none.',
    ),
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
      const ok =
        expected !== undefined && expected.revealed === toKey(r.revealed) && expected.output === r.output;
      if (!ok) mismatches++;
      return h(
        'tr',
        { class: r.output === 1 ? 'kat-row-one' : undefined },
        h('td', {}, `${inputs.a}, ${inputs.b}`),
        h('td', {}, String(s)),
        h('td', {}, code(toKey(r.beforeCut))),
        h('td', {}, code(toKey(r.revealed))),
        h(
          'td',
          {},
          h('span', { class: 'group-glyph', 'aria-hidden': 'true' }, r.adjacent ? GROUP.adjacent.glyph : GROUP.separated.glyph),
          srOnly(r.adjacent ? 'spades touching' : 'spades apart'),
        ),
        h('td', {}, String(r.output)),
        h(
          'td',
          {},
          h(
            'span',
            { class: `pill pill-${ok ? 'ok' : 'bad'}` },
            h('span', { 'aria-hidden': 'true' }, ok ? '✓' : '✕'),
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
      'The four starting layouts, before any cut',
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
