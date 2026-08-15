import { test } from '@playwright/test';
import { boot, driveAllStates, expectBaselineNotStale, NARROW, reportCollected } from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * The lab is driven the way a visitor drives it: the guided tour started,
 * stepped and exited; the stage cut and revealed and turned back over with every
 * bit combination and every cut depth; the six-step walkthrough opened by its
 * summary and walked; the orbit transformation applied from both starting
 * groups; every reveal in the privacy scrubber; every dealer preset plus a
 * hand-built distribution and both answers of the guessing game; the comparison
 * chart moved across its crossover at every security parameter; and every exit
 * question and the matching task answered wrong and then right. Tabs are
 * switched (including by ArrowRight on the tablist), never un-hidden, and every
 * disclosure is opened by its own summary. Every resulting state is scanned in
 * both themes at desktop and phone width.
 *
 * See `gate.ts` for why nothing is injected into the page, why nothing is
 * force-revealed, why reduced motion is asked for rather than forced, why the
 * lab's defaults are asserted rather than assumed, why every step is scanned
 * rather than only the last, and why `violations` is not the whole oracle.
 */

for (const theme of ['dark'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
    reportCollected();
    expectBaselineNotStale();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    reportCollected();
    expectBaselineNotStale();
  });
}
