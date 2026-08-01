/**
 * Functional end-to-end flows, asserted through roles and visible text.
 *
 * The unit suite proves the protocol. These prove the *page* — that each exhibit
 * actually renders its result, that the leak/no-leak semantics reach the DOM, and
 * that the interactions the copy tells a learner to perform do what it claims.
 *
 * This is the layer that catches the class of bug unit tests structurally cannot: a
 * panel that throws on render, a verdict label that contradicts its own colour, a
 * control wired to nothing — and, since the redesign, a first screen that stops doing
 * the teaching.
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

test.describe('the stage — the first screen', () => {
  /**
   * The demo's whole premise is that you perform the trick before reading about it.
   * Before the redesign the first card sat 2688px down a 844px phone screen; this is
   * the guard that keeps it above the fold, and it is deliberately strict.
   *
   * The font is pinned to a deliberately WIDE stack rather than left to `system-ui`.
   * A phone screen's budget is spent on wrapped lines, and system-ui is narrow on
   * macOS and wide on the Linux CI runner — a 44px difference, which is most of the
   * headroom. Measuring the worst case everywhere means this passes or fails for the
   * same reason on a laptop as in CI, instead of only failing after a push.
   */
  test('a full card row and the primary action are inside the first viewport at 390x844', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('.');
    await page.addStyleTag({ content: ':root{--sans:Verdana,"DejaVu Sans",sans-serif !important}' });
    const box = async (sel: string) => {
      const b = await page.locator(sel).first().boundingBox();
      expect(b, `${sel} should be laid out`).not.toBeNull();
      return b!;
    };
    const cards = await box('#panel-protocol .stage-table');
    // The main action is the reveal button itself. The cut selector beside it wraps
    // below on a touch phone, where 44px targets make everything taller — that is a
    // deliberate accessibility cost, and it is not what has to be above the fold.
    const action = await box('#stage-reveal');
    expect(cards.y + cards.height).toBeLessThan(844);
    expect(action.y + action.height).toBeLessThan(844);
    // A whole row, not a truncated one.
    await expect(page.locator('#panel-protocol .stage-table .card')).toHaveCount(5);
  });

  test('deals face down, reveals on demand, and agrees with the truth table', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');

    await expect(page.locator('#panel-protocol .stage-table .card-back')).toHaveCount(5);
    await expect(page.locator('#panel-protocol .output-bit')).toHaveCount(0);

    await page.locator('#stage-reveal').click();
    await expect(page.locator('#panel-protocol .stage-table .card-back')).toHaveCount(0);
    // Default is a=1, b=1, so the spades touch and the read-off is 1.
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');
    await expect(page.locator('#panel-protocol .stage-result .verdict-pass')).toContainText(
      'the cards and the truth table agree',
    );
    expect(errors).toEqual([]);
  });

  test('changing a bit changes the answer the cards read', async ({ page }) => {
    await page.goto('.');
    await page.locator('#stage-reveal').click();
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');

    await page
      .locator('#panel-protocol .stage-bit')
      .nth(1)
      .getByRole('button', { name: '0', exact: true })
      .click();
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('0');
    await expect(page.locator('#panel-protocol .readoff-shape')).toHaveText('♠♥♠');
  });

  test('re-cutting moves the row and leaves the answer where it is', async ({ page }) => {
    await page.goto('.');
    await page.locator('#stage-reveal').click();
    const row = page.locator('#panel-protocol .stage-table .card-row');
    const before = await row.getAttribute('aria-label');

    await page.locator('#panel-protocol [data-depth="4"]').click();
    expect(await row.getAttribute('aria-label')).not.toBe(before);
    await expect(page.locator('#panel-protocol .output-bit')).toHaveText('1');
  });
});

test.describe('the invariant', () => {
  test('shows five different rows all reading the same answer', async ({ page }) => {
    await page.goto('.');
    const pills = page.locator('#panel-protocol .cut-cell .pill');
    await expect(pills).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(pills.nth(i)).toContainText('reads 1');
    await expect(page.locator('#panel-protocol .invariant .verdict-pass')).toContainText(
      'all five cuts read 1',
    );

    const rows = await page.locator('#panel-protocol .cut-cell .card-row').all();
    const labels = await Promise.all(rows.map((r) => r.getAttribute('aria-label')));
    expect(new Set(labels).size).toBe(5);
  });

  test('the six-step walkthrough is still there, behind its disclosure', async ({ page }) => {
    await page.goto('.');
    // The steps render into the closed disclosure, so they are present but hidden —
    // which is what keeps them out of the first screen without losing them.
    await expect(page.locator('#panel-protocol .step-card').first()).not.toBeVisible();
    await page.getByText('Explain each step').click();
    await expect(page.locator('#panel-protocol .step-progress')).toHaveText('Step 1 of 6');
    await btn(page, '#panel-protocol', 'Show all steps').click();
    await expect(page.locator('#panel-protocol .step-card')).toHaveCount(6);
    await expect(btn(page, '#panel-protocol', 'Next step')).toBeDisabled();
  });

  test('“play it honestly” stops the page printing the cut depth', async ({ page }) => {
    await page.goto('.');
    await page.getByText('Explain each step').click();
    await btn(page, '#panel-protocol', 'Show all steps').click();
    await expect(page.locator('#panel-protocol .peek').first()).toBeVisible();
    await page.locator('#hide-cut').check();
    await expect(page.locator('#panel-protocol .peek')).toHaveCount(0);
  });
});

test.describe('correctness', () => {
  test('no cut escapes its group, and the buckets say so', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-why').click();

    await expect(page.locator('#panel-why .bucket')).toHaveCount(2);
    await expect(page.locator('#panel-why .bucket-adjacent .bucket-empty')).toBeVisible();

    await btn(page, '#panel-why', 'Apply all five').click();
    // All five results landed in the group the row started in; none in the other.
    await expect(page.locator('#panel-why .bucket-separated .bucket-row')).toHaveCount(5);
    await expect(page.locator('#panel-why .bucket-adjacent .bucket-row')).toHaveCount(0);
    await expect(page.locator('#panel-why .transform-status .verdict-pass')).toContainText(
      'every cut landed back in the same group',
    );
    expect(errors).toEqual([]);
  });

  test('starting from the other group mirrors the result', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-why').click();
    await btn(page, '#panel-why', 'Start from a row where the spades touch').click();
    await btn(page, '#panel-why', 'Apply all five').click();
    await expect(page.locator('#panel-why .bucket-adjacent .bucket-row')).toHaveCount(5);
    await expect(page.locator('#panel-why .bucket-separated .bucket-row')).toHaveCount(0);
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

test.describe('privacy', () => {
  test('the reading rule shows three aligned probabilities for every reveal', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-leak').click();

    const buttons = page.locator('#panel-leak .aha').first().locator('.seg-btn');
    await expect(buttons).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await buttons.nth(i).click();
      const values = page.locator('#panel-leak .reading-col-value');
      await expect(values).toHaveCount(3);
      for (let j = 0; j < 3; j++) await expect(values.nth(j)).toHaveText('20%');
      await expect(page.locator('#panel-leak .reading-out .verdict-pass')).toContainText('Aligned');
    }
    expect(errors).toEqual([]);
  });

  test('reports the three answer-0 rows as indistinguishable', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-leak').click();
    await expect(page.locator('#panel-leak .prob-table tbody tr')).toHaveCount(4);
    await expect(page.locator('#panel-leak .compare-list')).toBeVisible();
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

    await page.locator('#panel-leak .break-it .seg-btn').nth(5).click();
    await expect(page.locator('#panel-leak .posterior-out .bar-value').nth(3)).toHaveText('100.0%');
  });
});

test.describe('breaking the shuffle', () => {
  test('starts clean: Bob at 50% and no row worth watching', async ({ page }) => {
    const errors = noPageErrors(page);
    await page.goto('.');
    await page.locator('#tab-break').click();

    await expect(page.locator('#panel-break .dealer-col-live .dealer-figure')).toHaveText('50.0%');
    await expect(page.locator('#panel-break .headline-host .verdict-pass')).toContainText('No leak');
    await expect(page.locator('#panel-break .evidence-host .verdict-pass')).toContainText(
      'Nothing to read',
    );
    await expect(page.locator('#panel-break .evidence-card')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('a lazy dealer hands Alice’s bit over, and names the rows that did it', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Lazy dealer').click();

    await expect(page.locator('#panel-break .dealer-col-live .dealer-figure')).toHaveText('100.0%');
    // The reference column never moves — that is what makes the comparison legible.
    await expect(page.locator('#panel-break .dealer-col-ref .dealer-figure')).toHaveText('50.0%');
    await expect(page.locator('#panel-break .headline-host .verdict-alarm')).toContainText('Leaking');
    // Every reachable row is conclusive under this dealer.
    await expect(page.locator('#panel-break .evidence-proof')).toHaveCount(4);
    await expect(page.locator('#panel-break .evidence-host .verdict-alarm')).toContainText(
      'settle Alice’s bit outright',
    );
  });

  test('an almost-uniform dealer still leaks — “nearly right” is not secure', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Almost uniform').click();
    await expect(page.locator('#panel-break .dealer-col-live .dealer-figure')).toHaveText('62.5%');
    await expect(page.locator('#panel-break .headline-host .verdict-alarm')).toBeVisible();
  });

  test('the bits and the bystander are available, one disclosure away', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await expect(page.locator('#panel-break .detail-host .stat')).toHaveCount(3);
    await page.getByText('More detail — leakage in bits').click();
    await expect(page.locator('#panel-break .detail-host .stat').first()).toContainText('0.000 bits');
    await expect(page.locator('#panel-break .prob-table tbody tr')).toHaveCount(4);
  });

  test('the guessing game deals a row and scores a call', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Deal a round').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toBeVisible();

    await btn(page, '#panel-break', 'Alice held 0').click();
    await expect(page.locator('#panel-break .guess-verdict')).toContainText('Running score: ');
    await expect(page.locator('#panel-break .guess-out')).toContainText(
      'The ceiling for this dealer is 50.0%',
    );
  });

  test('changing the dealer folds a round in progress', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-break').click();
    await btn(page, '#panel-break', 'Deal a round').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toBeVisible();
    await btn(page, '#panel-break', 'No cut at all').click();
    await expect(page.locator('#panel-break .guess-out .card-row')).toHaveCount(0);
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
    await expect(page.locator('#panel-compare .verdict-alarm')).toContainText('Bound eroding');
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

  test('the conclusion points back at what the learner did', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-compare').click();
    const backs = page.locator('#panel-compare .conclusion-back');
    await expect(backs).toHaveCount(3);
    await expect(backs.nth(0)).toContainText('You watched');
    await expect(backs.nth(2)).toContainText('You broke');
  });

  test('the applied transfer question marks the right and wrong answers', async ({ page }) => {
    await page.goto('.');
    await page.locator('#tab-compare').click();
    const applied = page.locator('#panel-compare .exit-q').nth(2);
    await applied.getByRole('button', { name: 'Alice held 0, with certainty' }).click();
    await expect(applied.locator('.pill-ok')).toContainText('Correct');

    const first = page.locator('#panel-compare .exit-q').first();
    await first.getByRole('button', { name: 'Yes — a thorough shuffle is what matters' }).click();
    await expect(first.locator('.pill-bad')).toContainText('Not quite');
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

  test('the tabs read as a lesson path but keep their full accessible names', async ({ page }) => {
    await page.goto('.');
    await expect(page.locator('#tab-protocol')).toHaveText('Perform');
    await expect(page.locator('#tab-protocol')).toHaveAttribute(
      'aria-label',
      /Perform it .* protocol/,
    );
    await expect(page.locator('#tab-break')).toHaveText('Break it');
  });

  test('guided mode is a control, walks the path, and focuses the first action', async ({ page }) => {
    await page.goto('.');
    await btn(page, '#tour-invite', 'Guided mode').click();
    await expect(page.locator('#tour-bar')).toContainText('STOP 1 OF 5');
    // "Guided" means standing in front of the cards, not merely on the right tab.
    await expect(page.locator('#stage-reveal')).toBeFocused();

    await btn(page, '#tour-bar', 'Continue').click();
    await expect(page.locator('#tour-bar')).toContainText('STOP 2 OF 5');
    await expect(page.locator('#tab-why')).toHaveAttribute('aria-selected', 'true');
    await btn(page, '#tour-bar', 'Exit tour').click();
    await expect(page.locator('#tour-invite')).toBeVisible();
  });

  /**
   * A regression guard, not a style preference.
   *
   * Two separate causes have already produced a sideways-scrolling phone here: the
   * visually-hidden spans inside the wide tables escaping their scroll container, and
   * a padded control strip measuring `max-width: 100%` against its content box. Both
   * are invisible in a screenshot.
   */
  test('no exhibit scrolls the page sideways, at 320px or at 200% zoom', async ({ page }) => {
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('.');
      for (const tab of ['protocol', 'why', 'leak', 'break', 'compare']) {
        await page.locator(`#tab-${tab}`).click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${tab} overflows horizontally at ${width}px`).toBe(0);
      }
    }
  });

  test('the theme toggle reaches light and the page still renders', async ({ page }) => {
    await page.goto('.');
    await page.locator('#cl-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#panel-protocol .stage-table .card').first()).toBeVisible();
  });
});
