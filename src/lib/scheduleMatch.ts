/**
 * Schedule-label matchers.
 *
 * Schedule entry labels are free text, but several consumers (dashboard
 * "Next Show" footer, recommended-departure math, future exports) need to
 * identify the load-in and doors rows. Keeping the matchers in one place
 * means a label-convention change happens here, not in N scattered regexes.
 *
 * Word boundaries (`\b`) anchor each match so we don't get false positives
 * on composite words — "Loading dock", "Doorman contact", "Backdoor code".
 *
 * The band's performance row is identified by the `is_band` flag on the
 * entry, not by label text — see CLAUDE.md ("Never infer the band's row
 * from the label text — use the flag"). No matcher is exported for it.
 */

/**
 * Matches load-in variants: "Load In", "Load-in", "LOADIN", "Load  In",
 * "Band Load-In", "Load In:", etc. Does NOT match "Loading", "Load Out",
 * "Upload in venue".
 */
export function isLoadInLabel(label: string): boolean {
  return /\bload[-\s]*in\b/i.test(label);
}

/**
 * Matches "Door" / "Doors" variants: "Doors", "doors open", "VIP Doors",
 * "Doors (GA)". Does NOT match "Doorman", "Backdoor", "Frontdoor".
 */
export function isDoorsLabel(label: string): boolean {
  return /\bdoors?\b/i.test(label);
}

/**
 * Matches load-out variants: "Load Out", "Load-out", "LOADOUT", "Load  Out",
 * "Band Load-Out", "Load Out:". Does NOT match "Load In" or "Loading".
 */
export function isLoadOutLabel(label: string): boolean {
  return /\bload[-\s]*out\b/i.test(label);
}
