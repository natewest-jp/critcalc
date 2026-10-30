# Weapon Infusion

**Sources:** gcsim `pkg/core/player/infusion/infusion.go` (the handler),
`internal/template/character/character.go` (where an attack picks it up), and the ten
`AddWeaponInfuse` callers under `internal/characters/` (checkout `fcc117b31`,
2026-10-28); our own `src/lib/sim/infusions.ts` and `src/lib/utils/actionElement.ts`. KQM's
page, <https://library.keqingmains.com/combat-mechanics/elemental-effects/weapon-infusion>,
was not re-fetched for this doc.
**Game version reflected:** 6.x.
**See also:** [`elemental-reactions.md`](elemental-reactions.md) §7 (the stub this replaces)
and §1 (gauge), [`icd.md`](icd.md) (an infused swing spends the attack's own ICD slot).

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). This doc is gcsim-sourced throughout. `⚠️ NEEDS-CONFIRM` marks
> anything unsettled.

## What infusion is

An infusion turns a character's Normal, Charged and Plunging Attacks from Physical into an
element for a while. Three kinds of attack are elemental without one, and an infusion
doesn't change which element they carry:

- **Catalysts:** every Normal, Charged and Plunging Attack carries the wielder's element.
- **Bows:** a fully charged Aimed Shot carries the wielder's element (the partial shot is
  Physical).
- **Stances:** some kits make their attacks elemental for the stance's length (Cyno's
  Pactsworn Pathclearer, Xiao's Bane of All Evil, Hu Tao's Paramita Papilio, and so on).

An infusion is the fourth source: a **timed grant** from a cast or a passive, either to the
character itself (Chiori, Kazuha C6) or to whoever is on field (Bennett C6, Candace,
Chongyun).

## How gcsim models it

**One slot per character.** `infusion.Handler` keeps one `WeaponInfusion` per party slot:
`Key`, `Ele`, the attack `Tags` it applies to, an `Expiry` frame (`-1` = permanent) and
`CanBeOverridden`.

- **The newest grant replaces the current one.** `AddWeaponInfuse` overwrites the slot,
  unless the current infusion is unexpired and was added with `CanBeOverridden = false`.
  Every one of the ten callers passes `true`, so in practice the newest always wins.
- **Which attacks it reaches is per grant.** Nine callers list
  `AttackTagNormal, AttackTagExtra, AttackTagPlunge` (Normal, Charged, Plunging). Aloy's
  Rushing Ice lists `AttackTagNormal` only.
- **An attack picks it up when it snapshots.** The character template calls
  `Player.Infused(index, a.AttackTag)` and, if an element comes back, replaces
  `a.Element` with it. Nothing else changes: the attack keeps its own durability, ICD tag
  and ICD group.
- **A stance opts out.** A stance attack sets its element itself and carries
  `IgnoreInfusion: true`, which skips the lookup (Cyno, Clorinde, Flins, Kinich, Mavuika,
  Skirk, Xilonen and Zibai's attacks, and several plunges). So a granted infusion never
  overrides a stance's element.
- **Hitlag extends it.** `Player.ApplyHitlag` calls `ExtendInfusion`, which lengthens the
  on-field character's active, timed infusion by the hitlag it takes.
- **The weapon gate is the granter's.** Bennett C6, Candace and Chongyun each check the
  receiver's weapon class (claymore, polearm or sword) before calling `AddWeaponInfuse`;
  the handler itself checks nothing. Bennett C6 also needs the receiver's HP above the
  Burst's 70% threshold (no threshold from C1), the same condition as his ATK bonus.

The ten `AddWeaponInfuse` callers: Aloy (E), Bennett (C6), Candace (Q), Chiori (A1),
Chongyun (E), Dori (C6), Kaedehara Kazuha (C6), Kamisato Ayaka (dash), Keqing (A1) and
Lynette (C6). The corpus's other `infuse` holders (Emilie, Lohen, Navia and the two
Travelers, below) don't call it; how gcsim gives their attacks an element isn't surveyed
here.

## → Schema mapping & current state

There are **two primitives**, and they are different mechanisms
(`.claude/rules/sim.md` § Infusion):

- **`NormalAbility.infusion`** (`ability.ts`): an element on a stance's normal ability. The
  stance is the window, so nothing is tracked. An `ElementRef` object lets the team name the
  element (Varka's right-hand claymore). 21 character files carry one.
- **The `infuse` Effect** (`{ type: 'infuse', element, target, duration, … }`): a timed grant
  from a cast. `target` is `self` or `active`; a `team` target is an authoring error,
  because only the on-field character swings. Eleven characters carry one: Bennett (C6),
  Candace (Q), Chiori (A1), Chongyun (E), Dori (C6), Emilie (C6), Kaedehara Kazuha (C6),
  Lohen (E), Navia (A1), Traveler (Cryo) (a passive) and Traveler (Pyro) (C6).

What the planner does with them:

- **At the cast**, `registerInfusionsOnCast` (`sim/infusions.ts`) opens a window for each
  `infuse` the resolved ability, its passives and its constellations fire. It judges the
  holder's half of the conditions there (constellation) and drops the window only on a
  definitive `false`. A `procCooldown` on the effect is respected (Emilie C6's 12s).
- **At each swing**, `infusionAt` finds the newest window covering that instant, matching
  gcsim's newest-wins, and re-judges the receiver's half of the conditions (`weaponType`,
  and whether a Polestar Field stands). That is how Bennett C6 skips a catalyst on field.
- **A stance infusion wins over a granted one**, as gcsim's `IgnoreInfusion` does:
  `run.ts` resolves `NormalAbility.infusion` first and asks `infusionAt` only when there is
  none.
- **The element is per swing.** `resolveActionElement` (`utils/actionElement.ts`) stamps it
  on every Normal, Charged and Plunging action event, and the gauge and reactions read it
  from there. When a grant lapses partway through a string, the input block splits where
  the element changes.
- **A window is never cut short on swap.** Bennett's infusion is still there when you swap
  back inside its 14.1s.
- **The notation editor's tint** only knows catalysts and bows. It reads the eager index
  and doesn't run the sim, so it passes no infusion of either kind, and a stance's or a
  grant's attacks stay untinted.

Gaps:

- Four of gcsim's `AddWeaponInfuse` callers have no `infuse` in the corpus: Aloy's Rushing
  Ice, Keqing's A1 (her `_curatorNotes` say "Effect not yet authored"), Kamisato Ayaka's
  dash and Lynette's C6. Their attacks stay Physical in the planner.
- Aloy's grant reaches Normal Attacks only. `infuse` has no per-attack-class field, so
  authoring it today would also infuse her Charged and Plunging Attacks.
- gcsim's hitlag extension (`ExtendInfusion`) has no counterpart: the planner models no
  hitlag anywhere (`sim/run.ts` says so), so a long string of heavy hits can outlast a grant
  in game that the planner shows lapsing.

## Curator signal

- The kit says the character's **own** attacks become elemental **while a state lasts** →
  `NormalAbility.infusion` on that state's normal ability.
- The kit says a cast **grants** an infusion for a stated time, to itself or to the active
  character → an `infuse` Effect with that `duration`. Put the weapon-class gate in
  `conditions` (`weaponType`), never in prose.
- Check the gcsim caller's tag list: an infusion that skips Charged or Plunging Attacks
  can't be expressed yet. Flag it rather than authoring the wider grant.
