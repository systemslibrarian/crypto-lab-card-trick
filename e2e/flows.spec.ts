/**
 * Functional end-to-end flows, asserted through roles and visible text.
 *
 * The unit suite proves the protocol. These prove the *page* — that each exhibit
 * actually renders its result, that the leak/no-leak semantics reach the DOM, and
 * that the interactions the copy tells a learner to perform do what it claims.
 *
 * This is the layer that catches the class of bug unit tests structurally cannot: a
 * panel that throws on render, a verdict label that contradicts its own colour, a
 * control wired to nothing.
 */
import { expect, test, type Page } from '@playwright/test';

const noPageErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

const btn = (page: Page, scope: string, label: string) =>
  page.locator(`${scope} button`, { hasText: label }).first();

test.describe('the protocol walkthrough', () => {
  test('steps through six stages and ends with the cards agreeing with AND', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');

    await expect(page.locator('#panel-protocol .step-progress')).toHaveText('Step 1 of 6');
    await expect(page.locator('#panel-protocol .step-card')).toHaveCount(1);

    await btn(page, '#panel-protocol', 'Next step').click();
    await expect(page.locator('#panel-protocol .step-progress')).toHaveText('Step 2 of 6');
    await expect(page.locator('#panel-protocol .step-card')).toHaveCount(2);

    await btn(page, '#panel-protocol', 'Show all steps').click();
    await expect(page.locator('#panel-protocol .step-card')).toHaveCount(6);
    await expect(btn(page, '#panel-protocol', 'Next step')).toBeDisabled();

    // The default is a=1, b=1, so the spades touch and the read-off is 1.
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');
    await expect(page.locator('#panel-protocol .verdict-pass').first()).toContainText(
      'the cards and the truth table agree',
    );

    expect(errors).toEqual([]);
  });

  test('every cut gives the same answer while showing a different row', async ({ page }) => {
    await page.goto('.');
    const pills = page.locator('#panel-protocol .cut-cell .pill');
    await expect(pills).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(pills.nth(i)).toContainText('reads 1');
    await expect(page.locator('#panel-protocol .aha .verdict-pass')).toContainText(
      'all five cuts read 1',
    );

    // The five rows really are different rows, not the same picture five times.
    const rows = await page.locator('#panel-protocol .cut-cell .card-row').all();
    const labels = await Promise.all(rows.map((r) => r.getAttribute('aria-label')));
    expect(new Set(labels).size).toBe(5);
  });

  test('changing a bit changes the answer the cards read', async ({ page }) => {
    await page.goto('.');
    await btn(page, '#panel-protocol', 'Show all steps').click();
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');

    // Bob switches to 0: the AND must fall to 0 and the spades must come apart.
    await page.locator('#panel-protocol .control-grid .control').nth(1).getByRole('button', { name: '0', exact: true }).click();
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('0');
    await expect(page.locator('#panel-protocol .ring-legend').first()).toContainText('the read-off says 0');
  });

  test('choosing a cut by hand moves the row but not the answer', async ({ page }) => {
    await page.goto('.');
    await btn(page, '#panel-protocol', 'Show all steps').click();
    const revealed = page.locator('#panel-protocol .step-card').last().locator('.card-row').first();
    const before = await revealed.getAttribute('aria-label');

    await page.locator('#panel-protocol [data-depth="4"]').click();
    const after = await revealed.getAttribute('aria-label');
    expect(after).not.toBe(before);
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');
  });

  test('“play it honestly” stops the page printing the cut depth', async ({ page }) => {
    await page.goto('.');
    await btn(page, '#panel-protocol', 'Show all steps').click();
    await expect(page.locator('#panel-protocol .peek').first()).toBeVisible();
    await page.locator('#hide-cut').check();
    await expect(page.locator('#panel-protocol .peek')).toHaveCount(0);
    await expect(page.locator('#panel-protocol .cut-side').last()).toContainText(
      'an amount you asked not to see',
    );
  });
});

test.describe('why it works', () => {
  test('shows two orbits of five and reports the closure check', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-why').click();

    await expect(page.locator('#panel-why .orbit-card')).toHaveCount(2);
    await expect(page.locator('#panel-why .orbit-card').first().locator('.orbit-row-btn')).toHaveCount(5);
    await expect(page.locator('#panel-why .aha .verdict-pass')).toContainText(
      '50 row-and-cut combinations stayed in their own group',
    );

    await btn(page, '#panel-why', 'Try all five cuts').click();
    await expect(page.locator('#panel-why .escape-out .verdict-pass')).toContainText(
      'no cut escaped the group',
    );
    expect(errors).toEqual([]);
  });

  test('checks all twenty computed cases against the hand-written vectors', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-why').click();
    await expect(page.locator('#panel-why .kat-table tbody tr')).toHaveCount(20);
    await expect(page.locator('#panel-why .kat-group .verdict-pass')).toContainText(
      'all 20 cases match the hand-written vectors',
    );
    await expect(page.locator('#panel-why .kat-table .pill-bad')).toHaveCount(0);
  });
});

test.describe('what leaks', () => {
  test('reports the three answer-0 rows as indistinguishable', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-leak').click();

    await expect(page.locator('#panel-leak .prob-table tbody tr')).toHaveCount(4);
    await expect(page.locator('#panel-leak .aha .verdict-pass')).toContainText('distance exactly 0');
    expect(errors).toEqual([]);
  });

  test('separates what the cards leak from what the answer implies', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-leak').click();
    const cards = page.locator('#panel-leak .sig-card');
    await expect(cards.nth(0)).toContainText('50.0%');
    await expect(cards.nth(0).locator('.verdict-pass')).toContainText('the cards told Bob nothing');
    await expect(cards.nth(1)).toContainText('forced by the AND itself');
  });

  test('the posterior leaves the three candidates equally likely', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-leak').click();
    const values = page.locator('#panel-leak .posterior-out .bar-value');
    await expect(values).toHaveCount(4);
    await expect(values.nth(0)).toHaveText('33.3%');
    await expect(values.nth(3)).toHaveText('0.0%');

    // A row where the spades touch pins the input pair down completely — and that is
    // the answer arriving, not a leak.
    await page.locator('#panel-leak .seg-wrap .seg-btn').nth(5).click();
    await expect(page.locator('#panel-leak .posterior-out .bar-value').nth(3)).toHaveText('100.0%');
  });
});

test.describe('breaking the shuffle', () => {
  test('starts clean and reports zero leakage', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-break').click();

    await expect(page.locator('#panel-break .break-out .verdict-pass')).toContainText('No leak');
    await expect(page.locator('#panel-break .break-out .stat').nth(0)).toContainText('50.0%');
    await expect(page.locator('#panel-break .break-out .stat').nth(2)).toContainText('0.000 bits');
    expect(errors).toEqual([]);
  });

  test('a lazy dealer hands Alice’s bit over completely', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Lazy dealer').click();

    await expect(page.locator('#panel-break .break-out .verdict-alarm')).toContainText('Leaking');
    await expect(page.locator('#panel-break .break-out .stat').nth(0)).toContainText('100.0%');
    await expect(page.locator('#panel-break .leak-table-host .verdict-alarm')).toContainText(
      'Separable',
    );
  });

  test('an almost-uniform dealer still leaks — “nearly right” is not secure', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Almost uniform').click();
    await expect(page.locator('#panel-break .break-out .stat').nth(0)).toContainText('62.5%');
    await expect(page.locator('#panel-break .break-out .verdict-alarm')).toBeVisible();
  });

  test('the guessing game deals a row and scores a call', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Deal a round').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toBeVisible();

    await btn(page, '#panel-break', 'Alice held 0').click();
    await expect(page.locator('#panel-break .guess-verdict')).toContainText('Running score: ');
    await expect(page.locator('#panel-break .guess-out')).toContainText('The ceiling for this dealer is 50.0%');
  });

  test('changing the dealer folds a round in progress', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Deal a round').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toBeVisible();
    await btn(page, '#panel-break', 'No cut at all').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toHaveCount(0);
    await expect(btn(page, '#panel-break', 'Deal a round')).toBeVisible();
  });
});

test.describe('cards vs circuits', () => {
  test('the card line stays at zero as the attacker outgrows the circuit bound', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-compare').click();

    await expect(page.locator('#panel-compare .stat').nth(0)).toContainText('0.000');
    await expect(page.locator('#panel-compare .verdict-pass')).toContainText('Both hold');

    await page.locator('#adversary-work').fill('300');
    await expect(page.locator('#panel-compare .verdict-alarm')).toContainText('Bound exhausted');
    // The card trick is untouched by the same move.
    await expect(page.locator('#panel-compare .stat').nth(0)).toContainText('0.000');
    expect(errors).toEqual([]);
  });

  test('the security parameter moves the crossover, not the card line', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-compare').click();
    await page.locator('#adversary-work').fill('160');
    await expect(page.locator('#panel-compare .verdict-alarm')).toBeVisible();
    await page.locator('#panel-compare [data-kappa="256"]').click();
    await expect(page.locator('#panel-compare .verdict-pass')).toContainText('Both hold');
    await expect(page.locator('#panel-compare .stat').nth(0)).toContainText('0.000');
  });

  test('the exit check marks a right and a wrong answer', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-compare').click();
    const first = page.locator('#panel-compare .exit-q').first();
    await first.getByRole('button', { name: /uniform over all five depths/ }).click();
    await expect(first.locator('.pill-ok')).toContainText('Correct');

    const second = page.locator('#panel-compare .exit-q').nth(1);
    await second.getByRole('button', { name: 'It needs more cards' }).click();
    await expect(second.locator('.pill-bad')).toContainText('Not quite');
  });

  test('links out to the Cipher Museum’s Solitaire exhibit', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-compare').click();
    const link = page.getByRole('link', { name: 'Cipher Museum' }).first();
    await expect(link).toHaveAttribute('href', 'https://ciphermuseum.com/ciphers/solitaire.html');
  });
});

test.describe('the page as a whole', () => {
  test('has exactly one h1, one banner and the scripture footer', async ({ page }) => {
    await page.goto('.');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('[role="banner"]')).toHaveCount(1);
    await expect(page.locator('.scripture-footer')).toContainText('1 Corinthians 10:31');
  });

  test('the guided tour walks the exhibits in order and can be left', async ({ page }) => {
    await page.goto('.');
    await btn(page, '#tour-invite', 'Start the guided tour').click();
    await expect(page.locator('#tour-bar')).toContainText('STOP 1 OF 5');
    await btn(page, '#tour-bar', 'Continue').click();
    await expect(page.locator('#tour-bar')).toContainText('STOP 2 OF 5');
    await expect(page.locator('#tab-why')).toHaveAttribute('aria-selected', 'true');
    await btn(page, '#tour-bar', 'Exit tour').click();
    await expect(page.locator('#tour-invite')).toBeVisible();
  });

  /**
   * A regression guard, not a style preference.
   *
   * The wide probability tables scroll inside their own box, but the visually-hidden
   * spans in their empty cells are `position: absolute` — without a positioned
   * ancestor they escape that box and stretch the document, so a phone gets a
   * horizontally scrolling page caused by text nobody can see. It is invisible in
   * every screenshot and trivially reintroduced.
   */
  test('no exhibit scrolls the page sideways at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('.');
    for (const tab of ['protocol', 'why', 'leak', 'break', 'compare']) {
      await page.locator(`#tab-${tab}`).click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${tab} overflows horizontally`).toBe(0);
    }
  });

  test('the theme toggle reaches light and the page still renders', async ({ page }) => {
    await page.goto('.');
    await page.locator('#cl-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#panel-protocol .card-row').first()).toBeVisible();
  });
});
