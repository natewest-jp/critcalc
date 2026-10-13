/**
 * src/routes/(scene)/(tools)/lib/deepLinkUrl.ts
 *
 * Strip a consumed deep-link param out of the address bar.
 *
 * All three tools take one: the planner's `?r=` (a shared rotation), the Team
 * Builder's `?team=` / `?b=` / `?swap=` (a hand-off, including the planner's
 * ⇄ into swap mode), and the Visualizers' `?i=`. Each reads its param in
 * `afterNavigate` and then wants the URL clean, so a refresh or a re-share does
 * not replay a link that has already been applied and a bad one does not linger
 * where a reader will copy it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔⛔ NATIVE `history.replaceState`, AND ⛔ NEVER `$app/navigation`'s.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SvelteKit warns about exactly this in dev — "Avoid using
 * `history.pushState(...)` and `history.replaceState(...)` … Use the
 * `pushState` and `replaceState` imports from `$app/navigation` instead" — and
 * for this call site the advice is WRONG. Taking it breaks every shared link.
 *
 * ⚓ MEASURED, not reasoned (2026-08-17, SvelteKit 2.52.2). Swapping this for
 * `replaceState` from `$app/navigation` and cold-loading a `?r=` link throws:
 *
 *     Error: Cannot call replaceState(...) before router is initialized
 *       at replaceState (client.js:2321)
 *       at +page.svelte  ← our afterNavigate callback
 *       at Set.forEach
 *       at initialize (client.js:616)
 *       at async _hydrate
 *
 * ⚠️⚠️ AND THE DAMAGE IS NOT THE THROW. It aborts the `afterNavigate` callback
 * before the param is decoded, so the rotation is never imported: the address
 * bar keeps `?r=`, the timeline keeps whatever tab was stored, and the user is
 * told nothing. A share link silently does nothing.
 *
 * The cause is one line of SvelteKit's own ordering (client.js ~616):
 *
 *     after_navigate_callbacks.forEach((fn) => fn(navigation));  // we run here
 *     started = true;                                            // …one line later
 *
 * So on HYDRATION — a pasted link, i.e. the whole point of a share URL — the
 * router is not "initialized" yet by `$app/navigation`'s own test, even though
 * `afterNavigate` has fired. ⚠️ The guard is `if (DEV)`, so a production build
 * would not throw; the failure is dev-only, which makes it self-revealing but
 * also means a "fix" can look clean in prod.
 *
 * ⛔ TWO ESCAPES CONSIDERED AND REJECTED, so they are not re-proposed:
 *
 *   · Strip AFTER the first `await` (by then `started` is true, so the
 *     sanctioned API is legal and the warning goes away). It buys a clean
 *     console with a dependency on undocumented internal ordering — if
 *     SvelteKit ever awaits its callbacks or moves the flag, this breaks again,
 *     and in prod it breaks silently. It would also let a bad link linger in
 *     the address bar, which is the behaviour the strip exists to prevent.
 *   · Capture the unpatched `history.replaceState` before SvelteKit wraps it.
 *     That defeats the warning for every future caller too, including the ones
 *     it should catch.
 *
 * ⚠️ The warning therefore STAYS, once per dev session, and that is the
 * accepted outcome rather than an outstanding defect. It is the reason this
 * lives in one file: the three call sites used to carry three different amounts
 * of explanation — the Visualizers had the full reason, the planner had none at
 * this line, and the Team Builder had a bare call with nothing at all, which is
 * precisely the one somebody would have "cleaned up".
 */

/**
 * Rewrite the current history entry to `url` without its query string.
 *
 * ⚠️ Pass `nav.to.url`, never `window.location` — location can lag the router
 * (the same rule that puts these reads in `afterNavigate` rather than
 * `onMount`). The hash is preserved; only the search is dropped.
 */
export function stripDeepLinkParams(url: URL): void {
	history.replaceState(history.state, '', url.pathname + url.hash);
}
