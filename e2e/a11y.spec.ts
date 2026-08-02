import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Put EVERY exhibit into its post-interaction state before scanning.
 *
 * Axe only checks what is in the DOM, and this lab renders each tab lazily and fills
 * dynamic regions on click — so an unscanned state is an ungated state. This driver
 * walks all five exhibits: reveals the stage and re-cuts it live, exercises both bit
 * controls, opens the six-step walkthrough, drives the orbit transformation from both
 * starting groups, scrubs every reveal in the reading rule and the posterior, runs
 * every broken dealer, plays a round of the guessing game both ways, moves the
 * comparison chart across its crossover, answers all three exit questions and the
 * matching task, and opens every disclosure and learner check so the feedback live
 * regions are populated too.
 */
async function driveDemos(page: Page): Promise<void> {
  const click = async (selector: string, nth = 0): Promise<void> => {
    await page
      .locator(selector)
      .nth(nth)
      .click({ timeout: 3000 })
      .catch(() => {});
  };

  // --- Guided mode: its bar, dots and cross-tab jumps are real UI -----------
  await clickByText(page, '#tour-invite', 'Guided mode');
  await page.waitForTimeout(120);
  await clickByText(page, '#tour-bar', 'Continue');
  await clickByText(page, '#tour-bar', 'Continue');
  await clickByText(page, '#tour-bar', 'Back');
  await clickByText(page, '#tour-bar', 'Exit tour');
  await page.waitForTimeout(120);

  // --- Exhibit 1: the stage, then the walkthrough behind it ----------------
  await click('#tab-protocol');
  await page.locator('#panel-protocol').waitFor({ timeout: 10_000 });
  // The stage in both of its states — face down and revealed.
  await click('#stage-reveal');
  // Both bit values on both sides, so every layout renders at least once.
  for (const el of await page.locator('#panel-protocol .stage-bit .seg-btn').all()) {
    await el.click({ timeout: 1500 }).catch(() => {});
  }
  // Every cut depth plus the random draw, live over a revealed row.
  for (const el of await page.locator('#panel-protocol [data-depth]').all()) {
    await el.click({ timeout: 1500 }).catch(() => {});
  }
  for (const el of await page.locator('#panel-protocol .predict-opt').all()) {
    await el.click({ timeout: 1500 }).catch(() => {});
  }
  // The six-step walkthrough now lives in a disclosure; open it and drive it.
  await page.getByText('Explain each step').click({ timeout: 3000 }).catch(() => {});
  await click('#hide-cut');
  await clickByText(page, '#panel-protocol', 'Next step');
  await click('#hide-cut');
  for (let i = 0; i < 3; i++) await clickByText(page, '#panel-protocol', 'Next step');
  await clickByText(page, '#panel-protocol', 'Show all steps');
  await clickByText(page, '#panel-protocol', 'Back to the start');
  await clickByText(page, '#panel-protocol', 'Show all steps');
  await page.waitForTimeout(150);

  // --- Exhibit 2: the orbit transformation ---------------------------------
  await click('#tab-why');
  await page.locator('#panel-why').waitFor({ timeout: 10_000 });
  // One cut at a time (partial state), then the full sweep, then the other group.
  await clickByText(page, '#panel-why', 'cut 0');
  await clickByText(page, '#panel-why', 'Apply all five');
  await clickByText(page, '#panel-why', 'Start over');
  await clickByText(page, '#panel-why', 'Start from a row where the spades touch');
  await clickByText(page, '#panel-why', 'Apply all five');
  // The finished enumeration is behind a disclosure; open it and click through it.
  await page.getByText('Show all 10 rows').click({ timeout: 3000 }).catch(() => {});
  for (const el of await page.locator('#panel-why .orbit-row-btn').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  await page.waitForTimeout(150);

  // --- Exhibit 3: privacy --------------------------------------------------
  await click('#tab-leak');
  await page.locator('#panel-leak').waitFor({ timeout: 10_000 });
  for (const el of await page.locator('#panel-leak .predict-opt').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  // Every reveal in the reading-rule scrubber, then every row in the posterior.
  for (const el of await page.locator('#panel-leak .seg-wrap .seg-btn').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  await page.waitForTimeout(150);

  // --- Exhibit 4: break the shuffle ----------------------------------------
  await click('#tab-break');
  await page.locator('#panel-break').waitFor({ timeout: 10_000 });
  for (const el of await page.locator('#panel-break .predict-opt').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  // Every preset dealer: the clean verdict and the leaking one both need scanning.
  for (const el of await page.locator('#panel-break .preset-btn').all()) {
    await el.click({ timeout: 1500 }).catch(() => {});
  }
  // A hand-built distribution via the sliders.
  await page.locator('#cut-weight-0').fill('9').catch(() => {});
  await page.locator('#cut-weight-3').press('ArrowRight').catch(() => {});
  // The bits, the bystander and the full table live behind a disclosure now.
  await page.getByText('More detail — leakage in bits').click({ timeout: 3000 }).catch(() => {});
  await page.getByText('Why the answer is exactly').click({ timeout: 3000 }).catch(() => {});
  // Play a round, both answers, so the right and wrong feedback are both rendered.
  await clickByText(page, '#panel-break', 'Deal a round');
  await clickByText(page, '#panel-break', 'Alice held 0');
  await clickByText(page, '#panel-break', 'Deal a round');
  await clickByText(page, '#panel-break', 'Alice held 1');
  await clickByText(page, '#panel-break', 'Reset the score');
  await clickByText(page, '#panel-break', 'Deal a round');
  await page.waitForTimeout(150);

  // --- Exhibit 5: cards vs circuits ----------------------------------------
  await click('#tab-compare');
  await page.locator('#panel-compare').waitFor({ timeout: 10_000 });
  // Across the crossover, so both the "both hold" and "bound exhausted" verdicts run.
  await page.locator('#adversary-work').fill('20').catch(() => {});
  await page.locator('#adversary-work').fill('300').catch(() => {});
  for (const el of await page.locator('#panel-compare [data-kappa]').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  await page.getByText('Where the research went next').click({ timeout: 3000 }).catch(() => {});
  // All three exit questions, right answers and wrong ones.
  for (const el of await page.locator('#panel-compare .exit-q .check-opt').all()) {
    await el.click({ timeout: 1200 }).catch(() => {});
  }
  // The matching task, deliberately misaligned so match-ok and match-bad both render.
  const selects = await page.locator('#panel-compare .match-task select').all();
  for (let i = 0; i < selects.length; i++) {
    await selects[i].selectOption({ index: i === 0 ? 2 : i + 1 }).catch(() => {});
  }
  await clickByText(page, '#panel-compare', 'Check my answers');
  await page.waitForTimeout(150);

  // Reveal every panel and open every disclosure so all states are in the DOM.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true));
    document.querySelectorAll<HTMLElement>('[hidden]').forEach((el) => el.removeAttribute('hidden'));
  });
  // Now that everything is visible, populate every check's feedback region — both the
  // correct and the incorrect styling.
  for (const el of await page.locator('.check-opt').all()) {
    await el.click({ timeout: 1500, force: true }).catch(() => {});
  }
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}`,
  });
  await page.waitForTimeout(250);
}

/**
 * Click the first button inside `scope` whose visible text starts with `label`.
 *
 * Visibility is checked first so a button that is absent or collapsed costs
 * milliseconds rather than a full click timeout.
 */
async function clickByText(page: Page, scope: string, label: string): Promise<void> {
  const btn = page.locator(`${scope} button`, { hasText: label }).first();
  if (!(await btn.isVisible().catch(() => false))) return;
  await btn.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(50);
}

async function scan(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    })),
  ).toEqual([]);
}

async function minimumControlBoundaryRatio(page: Page): Promise<number> {
  return page.locator('.mono-input').evaluateAll((elements) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (parts: number[]) => {
      const c = parts.map((part) => {
        const value = part / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    return Math.min(...elements.map((el) => {
      const style = getComputedStyle(el);
      const border = luminance(rgb(style.borderTopColor));
      const fill = luminance(rgb(style.backgroundColor));
      return (Math.max(border, fill) + 0.05) / (Math.min(border, fill) + 0.05);
    }));
  });
}

test('no WCAG A/AA violations — dark theme', async ({ page }) => {
  await page.goto('.');
  expect(await minimumControlBoundaryRatio(page)).toBeGreaterThanOrEqual(3);
  await driveDemos(page);
  await scan(page);
});

test('no WCAG A/AA violations — light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await minimumControlBoundaryRatio(page)).toBeGreaterThanOrEqual(3);
  await driveDemos(page);
  await scan(page);
});
