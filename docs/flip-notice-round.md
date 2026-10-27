# The flip notice: 2026-10-27

The returning-visitor dialog and the What's new entry for the flip, shaped with Nate in one session, then the flip itself merged. `feat/flip-notice` merged as `f65dd3f7`, `release/flip` as `bcc38c25`. **Live 2026-10-27** (pushed `0e25d360`; see §5). Gates on `bcc38c25`: vitest 2620, check, lint (tracked files), build, e2e chrome + webkit 160 passed (⚠ the fixture pins the OLD layout, `'0'`, so the new default is covered by vitest and the browser sweeps, not e2e).

✅ **Live 2026-10-27.** The pre-flip check, one fix and the push are in §5. What is left lives on the to-do list, not here.

## 1. What shipped

- **The dialog is a CLICK-THROUGH** (`FlipNoticeDialog.svelte`, ⚓ Nate, Genshin's "new feature" language): four pages, one per change, each a looping clip Nate recorded in a 512×384 box edge to edge under the title; dots, Back/Next, ←/→, Escape; **Got it** on the last page with a quiet "See everything in What's new" link. The title and the lead-in sit above the clip on every page.
- **Every page renders stacked in one grid cell**, so the dialog takes the tallest page's height (659px at desktop with the final copy) and Next never moves.
- **A clip loads only once its page or the one before it is reached**: the dialog shows once per browser, so nobody pays for pages they never open.
- **Reduced motion shows each clip's still** (`.webp`, one frame of it, also the video's poster).
- **A phone (below `compact`, or a short view) gets one screen**: the lead-in and the four pages as a list, no media, **What's new** + **Got it**. Decided at mount and held.
- **The What's new entry** (`Changelog.svelte`), Nate's rewrite: profiles, Theorycraft, one document per tool with Compare beside the bench, saving and the Trash, then "My profile" for returning visitors. Dated October 27.
- **The conflicts with main** were both additive (`Meta.returnToProfileId` beside `flipNotice`; the scene layout's two import sets) and kept both sides.

## 2. Rulings (⚓ Nate)

- One page per change with the lead-in above the first change, ⛔ no welcome page of its own; then the lead-in moved ABOVE the clip, and Claude kept it on every page so the clip box does not move between pages. It spans the panel (`max-width: none` over `.note`'s 56ch).
- Clips recorded pre-flip; 4:3; zoomed into the relevant area. Nate edits in DaVinci Resolve.
- Phones: text only (Nate first leaned to an image, then saw the phone's layout is different). ⛔ No phone screenshots.
- What's new is a quiet link on the last page only.
- The Theorycraft clip shows a profile SWITCH, not a pasted link (a localhost address bar does not belong in a clip); it also shows where profiles change.
- Copy (Nate's final words in the file): Theorycraft is "a built-in profile", ⛔ not "the default" — a returning visitor, this dialog's only reader, lands in My profile. **Move to a profile** is left out of What's new: Theorycraft already saves, and the move is found on the link that needs it. The profile name "My account" visible in Nate's clips is accepted.

## 3. The clip recipe

Nate exports a **ProRes 422 HQ master** into the gitignored `assets-src/whats-new/<name>.mov` (sRGB timeline, Rec.709-A output tag, 1024×768, 30 fps). Claude encodes the delivery file:

```sh
ffmpeg -i assets-src/whats-new/<name>.mov -map 0:v -an -dn -write_tmcd 0 -map_metadata -1 \
  -c:v libx264 -preset veryslow -tune animation -crf 22 -pix_fmt yuv420p -color_range tv \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart \
  static/assets/whats-new/<name>.mp4
ffmpeg -i assets-src/whats-new/<name>.mov -vf "select=eq(n\,<frame>)" -frames:v 1 \
  -c:v libwebp -quality 85 static/assets/whats-new/<name>.webp
```

| Clip                  | Length | MP4    | SSIM to master | Still                                        |
| --------------------- | ------ | ------ | -------------- | -------------------------------------------- |
| `flip-save-v1`        | 6.0s   | 160 KB | 0.9961         | frame 110, "Saved"                           |
| `flip-notabs-v1`      | 7.0s   | 336 KB | 0.9956         | frame 69, the Library under the Planner door |
| `flip-teams-v1`       | 8.0s   | 425 KB | 0.9953         | frame 140, the Teams grid                    |
| `flip-theorycraft-v1` | 6.0s   | 219 KB | 0.9951         | frame 105, the profile menu                  |

Checks per master: `ffprobe` (size, tags, frame count), `blackdetect`, first vs last frame for the loop, a 3×3 contact sheet to pick the still.

## 4. Traps

- **Resolve's own H.264 is ~10× heavier** than x264 at the same quality (1.74 MB vs 160 KB for the save clip, and x264 was closer to the master). Its hardware encoder; always encode from the ProRes master.
- **Resolve's sRGB H.264 export left the transfer tag `unknown`**; the Rec.709-A ProRes master carries `bt709` on all three, and the encode states them explicitly. ffprobe reads 709-A as plain bt709 — the "A" changes Resolve's pixel conversion, not the tag. ⏭ Nobody has yet compared a clip against the live site in REAL Safari.
- **A render range one frame long ends on BLACK** (the first no-tabs master: 211 frames, the last black). `blackdetect` finds it; trim with `-frames:v`.
- **`/assets` is immutable for a year**: a re-cut clip after deploy ships as `-v2`, ⛔ never an overwrite (before deploy, overwriting `-v1` is fine).
- **`npm run lint` from the main checkout fails while agent worktrees exist** under `.claude/worktrees` (Prettier sweeps them: 2222 files). Not a code problem: check tracked files with `git ls-files -z | xargs -0 npx prettier --check --ignore-unknown` and `npx eslint . --ignore-pattern '.claude/**'`.
- **An untracked copy of a file a branch adds blocks the merge**: the save clip was copied into the main checkout for Nate to view; it had to be removed (byte-identical, checked with `cmp`) before merging.
- **Ghostty does not always open a terminal path link** (seen for `/private/tmp`): put anything Nate must open in the repo, or `open -R` it.
- **Copy:** a dialog page body is a plain string, so control names in it (**Saved**, **Teams**) are not bold; splitting the sentence to bold them would break the whole-sentence rule (style guide §3.1).

## 5. The pre-flip check and go-live (2026-10-27, evening)

- **Gates on `d7a87898`:** vitest 2620, check, build, eslint. Prettier failed only on this file's clip table (reformatted). e2e was not rerun; the only commit after `bcc38c25` (green, 160) was docs. Nothing in the dependencies, adapter, `_headers` or `_redirects` had changed since the last push.
- **Browser sweep of the production build** (headless Chromium, 1440×900 and 390×844), all passed: a fresh visitor loads all 23 sitemap routes cold with no errors and writes nothing of the old layout to localStorage; a returning visitor migrates into "My profile" (tabs, saved rotations, roster), sees the dialog once, and the migration toast waits for it; `?next` and `?next=0` do nothing in production while a stored `'0'` still gives the old layout; `?r=` links open for both visitors.
- **The old-layout first paint is never seen** (flip-readiness §3): the prerendered HTML is the old shell, but at 4× CPU throttle the scene's veil covers it until `data-next` is set, then fades onto the new layout. Nate checked real Safari: fine.
- **One bug, fixed before the push** (`fix/flip-notice-phone-media`, merged `0e25d360`): the dialog chose its phone form in `onMount`, so the first render built the desktop form and a phone fetched two clips and four stills (~640 KB) it never shows. The form is now decided at init.
- **Rulings (⚓ Nate):** a first-visit shared link that releases the "Opened in Theorycraft" dialog and the migration toast together, after the flip dialog, is accepted. The Planner inspector should show the rotation's constellation, not the roster's (queued on the to-do list).
- **Deploy:** live about 90 seconds after the push; the clips serve with `immutable` caching. ⛔ Fix forward rather than a Cloudflare rollback: post-flip edits live in IndexedDB, which the old bundle cannot read, and the migration runs once, so edits made during a rollback would not carry forward.
