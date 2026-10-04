// scripts/gcsim-dump/main.go
//
// Reads gcsim as a LIBRARY and dumps, per character and per ability:
//
//   1. the exact action-cancel slice  — `action.Info.Frames(next)` for every next
//      action, plus the animation length at `action.InvalidAction`
//   2. the elemental-application schedule — every `damage` and `element` log event
//      that follows the cast, with its frame offset
//
// ⚓ Both come out of the same call, which is why the gauge round's C4b insists on
// ONE re-extraction pass. See docs/gauge-round-L4.md.
//
// ⚓ `action.InvalidAction` is index 0 of the slice and BOTH of gcsim's constructors
// fill it with the `animation` argument — `InitAbilSlice(animation)` fills every slot,
// `InitNormalCancelSlice(hitmark, animation)` fills every slot then overrides the six
// cancel slots with `hitmark`. That is how gcsim itself reads the animation length back
// out (`AnimationLength: skillFrames[action.InvalidAction]`), and it is what makes our
// fallback observable rather than inferred.
//
// ⛔ This is a review-candidate generator against an external source, never an
// auto-fixer — the same contract as audit-genshin-db-diff.mjs. It writes JSON to
// stdout and touches nothing.
//
// Build: not directly. `scripts/lib/gcsim-dump.mjs` materialises a shim Go module
// into scratch/ (this file + a go.mod derived from gcsim's own + a `replace`), builds
// it offline against the module cache, and runs it.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"

	"github.com/genshinsim/gcsim/pkg/avatar"
	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/action"
	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/event"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/keys"
	"github.com/genshinsim/gcsim/pkg/core/player"
	"github.com/genshinsim/gcsim/pkg/core/player/character"
	"github.com/genshinsim/gcsim/pkg/enemy"
	_ "github.com/genshinsim/gcsim/pkg/simulation"
	"github.com/genshinsim/gcsim/pkg/testhelper"
)

// ---------------------------------------------------------------------------
// Our ActionKey vocabulary → gcsim's action enum
// ---------------------------------------------------------------------------

// ⚠️ `A` (aim) and `lP` (low plunge) are dumped for completeness but our FrameMap has
// no key for either: a bow's aimed shot resolves through `chargeHits` and we do not
// model low plunges separately.
var nextKeys = []struct {
	name string
	act  action.Action
}{
	{"anim", action.InvalidAction},
	{"N", action.ActionAttack},
	{"C", action.ActionCharge},
	{"E", action.ActionSkill},
	{"Q", action.ActionBurst},
	{"D", action.ActionDash},
	{"J", action.ActionJump},
	{"P", action.ActionHighPlunge},
	{"A", action.ActionAim},
	{"swap", action.ActionSwap},
}

// ---------------------------------------------------------------------------
// The driver table
// ---------------------------------------------------------------------------

// Step is one action executed before the ability under test, to reach a mode the
// default (grounded, out-of-stance, resource-free) capture cannot see.
type Step struct {
	Action string         `json:"action"`
	Params map[string]int `json:"params,omitempty"`
	Repeat int            `json:"repeat,omitempty"`
}

// CaptureSet is a labelled group of abilities captured behind a shared prerequisite.
// The unlabelled default set always runs; driver entries ADD sets, they never replace
// it — an in-stance normal is a second reading of the same character, not a correction
// of the first.
type CaptureSet struct {
	Label    string   `json:"label"`
	Prereq   []Step   `json:"prereq"`
	Captures []string `json:"captures"`
}

type DriverEntry struct {
	// Abilities the default pass should not attempt (gcsim hard-errors on them for a
	// reason we already understand, and the error is noise rather than a finding).
	Skip []string     `json:"skip,omitempty"`
	Sets []CaptureSet `json:"sets,omitempty"`
	// Steps run before ONE capture of the default set, keyed by capture key — the
	// state a reading NEEDS, stated rather than inherited (ICD cap round follow-up,
	// 2026-10-04). Until pass A got a fresh core per capture, the capture ORDER
	// supplied it silently: Yelan's `hA` was read after `A` had spent the
	// Breakthrough Barb, Lauma's `Q` after a `C` had spent the deer.
	Before map[string][]Step `json:"before,omitempty"`
	Note   string            `json:"note,omitempty"`
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

type Application struct {
	Frame int    `json:"frame"`
	Abil  string `json:"abil"`
	Tag   string `json:"tag"`
	// Element as gcsim reports it on the DAMAGE event — present for every hit,
	// applied or ICD-suppressed. "physical" means it applies nothing.
	Element string `json:"element"`
	// Durability of the application, when one actually landed. ⚠️ Absent means the
	// hit was ICD-suppressed, NOT that it carries no gauge (C4: the authored value is
	// the nominal cap, not the applied rate).
	Durability *float64 `json:"durability,omitempty"`
	Applied    bool     `json:"applied"`
	// The CADENCE gcsim gates this hit by — see IcdInfo. Absent means the probe saw
	// no `OnEnemyDamage` for this hit; ⛔ never read that as "no ICD".
	Icd *IcdInfo `json:"icd,omitempty"`
	// The entry of the group's sequence this hit read (`ele icd check`'s `val`):
	// 0 means its ICD blocked it. Absent when no check ran — an `ICDTagNone` hit, or
	// one with no gauge to gate — so ⚓ absent-and-not-applied is NO GAUGE, ⛔ never
	// "blocked".
	IcdVal *float64 `json:"icdVal,omitempty"`
	// The counter's position BEFORE this hit (`ele icd check`'s `counter`). ⚓ A
	// capture's first hit reading > 0 means something before the cast — its
	// prerequisite — had already advanced the counter: a counter shared ACROSS
	// casts, which the planner's per-cast isolation does not model (Nilou's Dance
	// and her steps; ICD cap round follow-up, 2026-10-04).
	IcdCounter *int `json:"icdCounter,omitempty"`
}

// ---------------------------------------------------------------------------
// gcsim's element-application ICD, as NUMBERS
// ---------------------------------------------------------------------------

// IcdInfo is gcsim's element-application ICD for one hit, reduced to the numbers
// that carry all of it. ⛔ IT DELIBERATELY CARRIES NO GROUP NAME: gcsim has 58 of
// them, that is a taxonomy we would have to maintain, and its entire content is
// the fields below (docs/icd-group-round.md §6a).
//
// gcsim's model (`pkg/target/icd.go`, `WillApplyEle`): state is keyed
// `(character, ICDTag)` — the TAG, never the group. The GROUP contributes exactly
// two table lookups, both exported `var`s in
// `pkg/core/attacks/icd_groups.dm.go`:
//
//	ICDGroupResetTimer[grp]              a reset window, in frames
//	ICDGroupEleApplicationSequence[grp]  a per-hit multiplier on the durability
//
// A hit reads `seq[counter]`, increments the counter, and past the end of the
// array reads the LAST entry rather than zero. The counter is zeroed by a
// one-shot task at first-hit + `timer − 1`, not by a sliding window.
//
// ⚠️ There is a second, parallel pair (`ICDGroupDamageSequence`,
// `GroupTagDamageMult`) for reaction-damage ICD. ⛔ Not ours; not read here.
type IcdInfo struct {
	// gcsim's `ICDTagNone`: `WillApplyEle` returns 1 before it so much as looks
	// at the group, so every number below is meaningless when this is set.
	None bool `json:"none"`
	// `ICDGroupResetTimer[grp]`, in FRAMES.
	Timer int `json:"timer"`
	// How many hits apart applications fall inside the window — the index of the
	// SECOND non-zero entry of the sequence. **0 means there is no second one**,
	// i.e. only the window's first hit applies. ⚓ This is `IcdWindow.every`.
	Period int `json:"period"`
	// How many hits of the window apply at all: non-zero entries in the
	// sequence. ⚠️ NOT always `ceil(len/period)` — four groups apply two or
	// three times at a regular period and then stop for the rest of the window,
	// which `(timer, period)` alone cannot say. Emitted so the report can flag
	// them rather than silently rounding them off.
	Applies int `json:"applies"`
	// The multiplier the FIRST application of the window carries — `seq[0]`.
	// 1 for every group but one, which carries 1.5. ⚓ A gauge STRENGTH, which
	// belongs beside the application in `units`, ⛔ never in a cadence model.
	Mult float64 `json:"mult"`
	// Whether the sequence's non-zero entries are evenly spaced at `Period` all
	// the way to the last one. False is the `Applies` caveat above.
	Regular bool `json:"regular"`
	// The sequence's LAST entry is non-zero, so a hit past its end still applies
	// (gcsim reads past the end as the last entry). Only the two reaction groups.
	// ⚓ False is what makes `Applies` a CAP — the window stops applying (ICD cap
	// round, 2026-10-04).
	Open bool `json:"open,omitempty"`
	// WHICH counter the hit spends: gcsim keys ICD state `(character, tag, group)`,
	// so two hits share a counter exactly when both numbers match. ⚠️ An opaque
	// IDENTITY, compared only for equality — ⛔ never read as a name (the no-taxonomy
	// rule above). Without it two abilities on separate counters with the same
	// numbers read as one stream (ICD cap round, 2026-10-04).
	Counter string `json:"counter,omitempty"`
}

func icdInfoFor(tag attacks.ICDTag, grp attacks.ICDGroup) IcdInfo {
	if tag == attacks.ICDTagNone {
		return IcdInfo{None: true}
	}
	out := IcdInfo{Counter: fmt.Sprintf("%d/%d", int(tag), int(grp))}
	if int(grp) >= 0 && int(grp) < len(attacks.ICDGroupResetTimer) {
		out.Timer = attacks.ICDGroupResetTimer[grp]
	}
	if int(grp) < 0 || int(grp) >= len(attacks.ICDGroupEleApplicationSequence) {
		return out
	}
	seq := attacks.ICDGroupEleApplicationSequence[grp]
	if len(seq) == 0 {
		return out
	}
	out.Mult = seq[0]
	out.Open = seq[len(seq)-1] > 0
	var hits []int
	for i, v := range seq {
		if v > 0 {
			hits = append(hits, i)
		}
	}
	out.Applies = len(hits)
	if len(hits) > 1 {
		out.Period = hits[1] - hits[0]
		out.Regular = true
		for i := 1; i < len(hits); i++ {
			if hits[i]-hits[i-1] != out.Period {
				out.Regular = false
				break
			}
		}
	} else {
		// One application per window is regular by construction.
		out.Regular = true
	}
	return out
}

// appKey names the hits gcsim logs under one ability string in one frame. ⚠️ It is
// a BUCKET, never an identity: Chevreuse's Burst lands two shells at frame 101 under
// one string, and a map keyed by it married both to one reading — the audit showed
// both applying when gcsim applied one (ICD cap round, 2026-10-04). Hits inside a
// bucket are paired by ORDINAL.
type appKey struct {
	frame int
	abil  string
}

// probeHit is one hit as the target saw it once its frame's damage was applied.
type probeHit struct {
	icd IcdInfo
	// Whether the hit put gauge on the target: gcsim's own `applyDamage` condition
	// (post-ICD durability, not physical) or a reaction — ⚠️ a reaction can consume
	// the durability to zero, and a hit that reacted had passed its ICD check.
	applied bool
	reacted bool
	// Post-ICD durability. Exact for a hit that did not react — the value the
	// deferred `application` log line records.
	dur float64
}

// icdProbe records every hit the core lands, in the order the core lands them.
//
// ⚓⚓ SUBSCRIBED IN THE SHIM, AND IT HAS TO BE. gcsim's debug log does NOT carry
// the tag or the group: `pkg/enemy/attack.go`'s damage event writes `target` /
// `attack-tag` / `ele` / `damage` / `crit` / `amp` / `cata` / `abil` /
// `source_frame` and nothing more, so there is no log column to parse. Linking
// gcsim as a LIBRARY is what makes the live `AttackInfo` reachable — ⛔ do not
// patch the checkout to log the fields; it is a `replace` target and a fork is a
// maintenance liability.
//
// ⚠️ `OnEnemyDamage` rather than `OnEnemyHit`: the latter is emitted at
// `attack.go:32` behind `grpMult > 0`, the REACTION-damage group's multiplier, so
// it silently skips the later hits of a window on the eight groups whose damage
// sequence zeroes them (Yelan's Breakthrough, Cyno's bolts, Ayaka's and Yae's
// charged groups…). Those hits still emit a `damage` log line, so keying off the
// gated event would leave holes exactly where a cadence is most interesting.
//
// ⚓ ORDER IS THE PAIRING. `HandleAttack` writes the damage log line and queues a
// zero-delay task that emits `OnEnemyDamage`; tasks drain FIFO and re-entrant
// additions run inside the same `Tick`, so within one (frame, abil) bucket the
// n-th callback is the n-th damage line. ⚠️ The element `application` line can't
// be paired that way — a plain attach is logged from that deferred task, a reacted
// one synchronously — which is why `applied` is read off the live attack instead.
type icdProbe struct {
	m map[appKey][]probeHit
	n int
}

func subscribeIcd(c *core.Core) *icdProbe {
	p := &icdProbe{m: map[appKey][]probeHit{}}
	c.Events.Subscribe(event.OnEnemyDamage, func(args ...any) {
		atk, ok := args[1].(*info.AttackEvent)
		if !ok {
			return
		}
		p.n++
		k := appKey{c.F, atk.Info.Abil}
		phys := atk.Info.Element == attributes.Physical
		p.m[k] = append(p.m[k], probeHit{
			icd:     icdInfoFor(atk.Info.ICDTag, atk.Info.ICDGroup),
			applied: !phys && (atk.Reacted || atk.Info.Durability > 0),
			reacted: atk.Reacted,
			dur:     float64(atk.Info.Durability),
		})
	}, "critcalc-icd-probe")
	return p
}

type AbilityDump struct {
	Key           string         `json:"key"`
	Action        string         `json:"action"`
	Params        map[string]int `json:"params,omitempty"`
	Prereq        []Step         `json:"prereq,omitempty"`
	Frames        map[string]int `json:"frames,omitempty"`
	AnimLength    int            `json:"animationLength,omitempty"`
	CanQueueAfter int            `json:"canQueueAfter,omitempty"`
	Applications  []Application  `json:"applications"`
	Err           string         `json:"error,omitempty"`
}

type CharDump struct {
	NormalHitNum int           `json:"normalHitNum"`
	Weapon       string        `json:"weapon"`
	Abilities    []AbilityDump `json:"abilities"`
}

// ---------------------------------------------------------------------------
// Core construction
// ---------------------------------------------------------------------------

func makeCore(k keys.Char, cons int) (*core.Core, *character.CharWrapper, error) {
	c, err := core.New(core.Opt{Seed: 1, Debug: true})
	if err != nil {
		return nil, nil, err
	}
	a := avatar.New(c, info.Point{X: 0, Y: 0}, 1)
	c.Combat.SetPlayer(a)
	e := enemy.New(c, info.EnemyProfile{
		Level:  100,
		Resist: make(map[attributes.Element]float64),
		Pos:    info.Coord{X: 0, Y: 0, R: 1},
	})
	c.Combat.AddEnemy(e)
	c.Combat.DefaultTarget = e.Key()

	// ⚠️ DullBlade for everyone, deliberately: a 1★ sword has no passive at all, so
	// nothing in the weapon slot can apply an element, trigger a reaction, reset a
	// cooldown or infuse an attack. gcsim does not validate weapon TYPE here, which is
	// what makes one inert weapon enough. Same reasoning as INERT_WEAPONS in
	// scripts/lib/gcsim.mjs — this is the stricter version of it.
	prof := testhelper.DefaultProfile(k, keys.DullBlade)
	prof.Base.Cons = cons
	prof.Talents = info.TalentProfile{Attack: 9, Skill: 9, Burst: 9}
	idx, err := c.AddChar(prof)
	if err != nil {
		return nil, nil, fmt.Errorf("addchar: %w", err)
	}
	c.Player.SetActive(idx)
	if err := c.Init(); err != nil {
		return nil, nil, fmt.Errorf("init: %w", err)
	}
	// ⚠️ The dumper calls ability functions DIRECTLY, bypassing Player.Exec — no
	// cooldown, energy or stamina gate. That is what makes it exhaustive; it also
	// means a resource-dependent branch dumps its resource-free reading.
	c.Flags.IgnoreBurstEnergy = true
	return c, c.Player.ActiveChar(), nil
}

func actionByName(name string) (action.Action, bool) {
	switch name {
	case "attack":
		return action.ActionAttack, true
	case "charge":
		return action.ActionCharge, true
	case "aim":
		return action.ActionAim, true
	case "skill":
		return action.ActionSkill, true
	case "burst":
		return action.ActionBurst, true
	case "dash":
		return action.ActionDash, true
	case "jump":
		return action.ActionJump, true
	case "high_plunge":
		return action.ActionHighPlunge, true
	case "low_plunge":
		return action.ActionLowPlunge, true
	}
	return action.InvalidAction, false
}

func abilityFunc(ch *character.CharWrapper, t action.Action) func(map[string]int) (action.Info, error) {
	switch t {
	case action.ActionCharge:
		return ch.ChargeAttack
	case action.ActionDash:
		return ch.Dash
	case action.ActionJump:
		return ch.Jump
	case action.ActionAim:
		return ch.Aimed
	case action.ActionSkill:
		return ch.Skill
	case action.ActionBurst:
		return ch.Burst
	case action.ActionAttack:
		return ch.Attack
	case action.ActionHighPlunge:
		return ch.HighPlungeAttack
	case action.ActionLowPlunge:
		return ch.LowPlungeAttack
	default:
		return ch.Walk
	}
}

// ---------------------------------------------------------------------------
// The default capture list
// ---------------------------------------------------------------------------

type spec struct {
	key    string
	action string
	params map[string]int
}

// ⚠️ `travel: 0` on every aimed shot — and, since §1.K stage 2 (2026-09-20), on every
// NORMAL and CHARGED attack too — is deliberate. The swing captures went unpinned
// while nothing read their damage frames; `FrameMap.lands` is authored from them now,
// and unpinned, all 87 bow normals and the projectile catalysts read release + 10.
// A melee `attack` ignores the key. The reason, as first written for the aimed shot:
//
// ⚠️ `travel: 0` is deliberate. gcsim's `travel` default of 10 is
// a SIMULATION POLICY, not game data (76 sites), and it lands inside the observed
// hitmark. Pinning it to zero measures "frames until the arrow leaves the bow", which
// is the distance-independent number. ⛔ Never ingest a travel-inclusive figure as
// measured frame data.
func defaultSpecs(normalHitNum int) []spec {
	out := make([]spec, 0, normalHitNum+9)
	for i := range normalHitNum {
		out = append(out, spec{fmt.Sprintf("N%d", i+1), "attack", map[string]int{"travel": 0}})
	}
	return append(out,
		spec{"C", "charge", map[string]int{"travel": 0}},
		spec{"A", "aim", map[string]int{"travel": 0}},
		spec{"hA", "aim", map[string]int{"hold": 1, "travel": 0}},
		spec{"P", "high_plunge", map[string]int{"collision": 0}},
		spec{"lP", "low_plunge", map[string]int{"collision": 0}},
		spec{"E", "skill", map[string]int{}},
		spec{"hE", "skill", map[string]int{"hold": 1}},
		spec{"h2E", "skill", map[string]int{"hold": 2}},
		spec{"Q", "burst", map[string]int{}},
	)
}

// ---------------------------------------------------------------------------
// Pass A — the cancel slice
// ---------------------------------------------------------------------------
//
// One core per capture set, abilities called back to back with NO clock advance.
// ⚓ `Attack()` advances NormalCounter via `defer`, and `frames.NewAttackFunc` captures
// the counter in the return statement — so calling it N times walks the combo and each
// reading is the right index. A gcsim refactor of that idiom would silently shift every
// normal by one; the audit's match rate against the authored corpus is the canary.

// ⚠️ NAMED RETURN, and it is load-bearing. With a bare `return d` the deferred recover
// mutates a local the caller never sees, so a panicking ability came back as the ZERO
// AbilityDump — no key, no error — and the audit reported it as "not captured" rather
// than as the gcsim panic it was. Three characters were mis-classified that way.
func captureFrames(ch *character.CharWrapper, c *core.Core, s spec) (d AbilityDump) {
	d = AbilityDump{Key: s.key, Action: s.action, Params: s.params, Applications: []Application{}}
	t, ok := actionByName(s.action)
	if !ok {
		d.Err = "unknown action " + s.action
		return d
	}
	defer func() {
		if r := recover(); r != nil {
			d = AbilityDump{Key: s.key, Action: s.action, Params: s.params,
				Applications: []Application{}, Err: fmt.Sprintf("panic: %v", r)}
		}
	}()
	if t == action.ActionHighPlunge || t == action.ActionLowPlunge {
		_ = c.Player.SetAirborne(player.AirborneXianyun)
	}
	evt, err := abilityFunc(ch, t)(s.params)
	if err != nil {
		d.Err = err.Error()
		return d
	}
	d.Frames = map[string]int{}
	for _, nk := range nextKeys {
		d.Frames[nk.name] = evt.Frames(nk.act)
	}
	d.AnimLength = evt.AnimationLength
	d.CanQueueAfter = evt.CanQueueAfter
	return d
}

// ---------------------------------------------------------------------------
// Pass B — the application schedule
// ---------------------------------------------------------------------------
//
// A FRESH core per ability: execute the prerequisites, then the ability, then advance
// the clock. ⚓ Because only one ability under test ever ran, every event after its cast
// frame belongs to it by construction — which is what dissolves L0's attribution
// heuristic. Summon ticks are still in the stream (they belong to the cast too); the
// audit separates them by `abil` string against the authored summon names.

type logEvent struct {
	Event string         `json:"event"`
	Frame int            `json:"frame"`
	Msg   string         `json:"msg"`
	Logs  map[string]any `json:"logs"`
}

func advance(c *core.Core, n int) {
	for range n {
		c.F++
		c.Tick()
	}
}

// runStep executes one prerequisite and advances the clock by the CANCEL window for
// whatever comes next — not by the full animation.
//
// ⚠️ The distinction is load-bearing for normals: gcsim resets NormalCounter after an
// idle timeout, so walking a combo at animation cadence can silently drop back to N1
// and every "N4" reading would really be an N1. Advancing by `Frames(next)` is both the
// realistic cadence and the one that keeps the combo alive.
func runStep(c *core.Core, ch *character.CharWrapper, st Step, next action.Action) error {
	t, ok := actionByName(st.Action)
	if !ok {
		return fmt.Errorf("unknown prereq action %q", st.Action)
	}
	reps := max(st.Repeat, 1)
	for i := range reps {
		if t == action.ActionHighPlunge || t == action.ActionLowPlunge {
			_ = c.Player.SetAirborne(player.AirborneXianyun)
		}
		evt, err := abilityFunc(ch, t)(st.Params)
		if err != nil {
			return err
		}
		c.Player.SetActionUsed(c.Player.Active(), t, &evt)
		// Intermediate repeats chain into themselves; the last one chains into `next`.
		chain := t
		if i == reps-1 {
			chain = next
		}
		advance(c, evt.Frames(chain))
	}
	return nil
}

// runPrereq walks a capture set's prerequisite chain, recovering from a panic rather
// than taking the whole roster down with it. ⚠️ gcsim panics rather than errors on some
// impossible states (`unexpected charges less than 0`), and a dumper that dies on one
// character's driver row is a dumper nobody can iterate with.
func runPrereq(c *core.Core, ch *character.CharWrapper, steps []Step, after action.Action) (fail string) {
	defer func() {
		if r := recover(); r != nil {
			fail = fmt.Sprintf("prereq panic: %v", r)
		}
	}()
	for i, st := range steps {
		next := after
		if i < len(steps)-1 {
			next, _ = actionByName(steps[i+1].Action)
		}
		if err := runStep(c, ch, st, next); err != nil {
			return "prereq " + st.Action + ": " + err.Error()
		}
	}
	return ""
}

// comboPrefix: reaching N4 means swinging N1–N3 first. ⚓ Pass B uses a FRESH core per
// ability — that is what makes attribution exact — so the combo index has to be walked
// rather than inherited from pass A.
func comboPrefix(key string) int {
	var n int
	if _, err := fmt.Sscanf(key, "N%d", &n); err == nil && n > 1 {
		return n - 1
	}
	return 0
}

func captureApplications(k keys.Char, cons int, prereq []Step, s spec, horizon int) (out []Application, fail string) {
	out = []Application{}
	c, ch, err := makeCore(k, cons)
	if err != nil {
		return out, err.Error()
	}
	// ⚓ Only pass B subscribes. Pass A never advances the clock, so nothing there
	// ever lands a hit for the probe to see.
	icd := subscribeIcd(c)
	t, ok := actionByName(s.action)
	if !ok {
		return out, "unknown action " + s.action
	}
	func() {
		defer func() {
			if r := recover(); r != nil {
				fail = fmt.Sprintf("panic: %v", r)
			}
		}()
		c.F = 0
		c.Tick()
		steps := append([]Step{}, prereq...)
		if n := comboPrefix(s.key); n > 0 {
			steps = append(steps, Step{Action: "attack", Params: map[string]int{"travel": 0}, Repeat: n})
		}
		if msg := runPrereq(c, ch, steps, t); msg != "" {
			fail = msg
			return
		}
		if t == action.ActionHighPlunge || t == action.ActionLowPlunge {
			_ = c.Player.SetAirborne(player.AirborneXianyun)
		}
		castFrame := c.F
		evt, err := abilityFunc(ch, t)(s.params)
		if err != nil {
			fail = err.Error()
			return
		}
		c.Player.SetActionUsed(c.Player.Active(), t, &evt)
		advance(c, horizon)

		raw, derr := c.Log.Dump()
		if derr != nil {
			fail = "log dump: " + derr.Error()
			return
		}
		var events []logEvent
		if err := json.Unmarshal(raw, &events); err != nil {
			fail = "log parse: " + err.Error()
			return
		}
		// ⚓ The DAMAGE stream is the NOMINAL hit schedule — gcsim emits it even when
		// ICD zeroes the application — and the probe says which of those hits put
		// gauge on. C3 authors from the first; C4's post-ICD contract is served by icd.ts.
		//
		// The log is in creation order, and one `HandleAttack` writes its damage line,
		// then its `ele icd check` (only for a tagged hit with gauge), then — if it
		// reacted — its `application` line, all synchronously. So the ICD check and a
		// reacted hit's durability belong to the LAST damage line before them. ⚠️ A
		// plain attach's `application` line is written later, from a deferred task,
		// and is never read here.
		hits := []Application{}
		cursor := map[appKey]int{}
		last := -1
		for _, e := range events {
			if e.Frame < castFrame {
				continue
			}
			switch {
			case e.Event == "damage":
				abil, _ := e.Logs["abil"].(string)
				ele, _ := e.Logs["ele"].(string)
				tagf, _ := e.Logs["attack-tag"].(float64)
				app := Application{
					Frame:   e.Frame - castFrame,
					Abil:    abil,
					Tag:     tagName(int(tagf)),
					Element: ele,
				}
				k := appKey{e.Frame, abil}
				if i := cursor[k]; i < len(icd.m[k]) {
					ph := icd.m[k][i]
					cursor[k] = i + 1
					v := ph.icd
					app.Icd = &v
					app.Applied = ph.applied
					if ph.applied && !ph.reacted {
						d := ph.dur
						app.Durability = &d
					}
				}
				hits = append(hits, app)
				last = len(hits) - 1
			case e.Event == "icd" && e.Msg == "ele icd check" && last >= 0 && hits[last].Frame == e.Frame-castFrame && hits[last].IcdVal == nil:
				if v, ok := e.Logs["val"].(float64); ok {
					hits[last].IcdVal = &v
				}
				if n, ok := e.Logs["counter"].(float64); ok {
					ni := int(n)
					hits[last].IcdCounter = &ni
				}
			case e.Event == "element" && e.Msg == "application" && last >= 0 && hits[last].Applied && hits[last].Durability == nil && hits[last].Frame == e.Frame-castFrame:
				// A reacted hit's pre-reaction durability, written synchronously.
				if d, ok := e.Logs["dur"].(float64); ok {
					hits[last].Durability = &d
				}
			}
		}
		sort.SliceStable(hits, func(i, j int) bool { return hits[i].Frame < hits[j].Frame })
		out = hits
	}()
	return out, fail
}

func tagName(t int) string {
	switch t {
	case 1:
		return "normal"
	case 2:
		return "charged"
	case 3:
		return "plunge"
	case 4:
		return "skill"
	case 6:
		return "burst"
	}
	return fmt.Sprint(t)
}

// ---------------------------------------------------------------------------

type options struct {
	Cons    int                    `json:"cons"`
	Horizon int                    `json:"horizon"`
	Only    string                 `json:"only"`
	Drivers map[string]DriverEntry `json:"drivers"`
	// Skip pass B entirely — pass A alone answers the FrameMap question and runs in
	// well under a second for the whole roster.
	FramesOnly bool `json:"framesOnly"`
}

func main() {
	var opt options
	opt.Horizon = 900
	if len(os.Args) > 1 {
		if err := json.Unmarshal([]byte(os.Args[1]), &opt); err != nil {
			fmt.Fprintln(os.Stderr, "bad options json:", err)
			os.Exit(2)
		}
	}
	if opt.Horizon <= 0 {
		opt.Horizon = 900
	}

	out := map[string]*CharDump{}
	var names []keys.Char
	for k := range core.NewCharFuncMap {
		names = append(names, k)
	}
	sort.Slice(names, func(i, j int) bool { return names[i].String() < names[j].String() })

	for _, k := range names {
		name := k.String()
		if opt.Only != "" && name != opt.Only {
			continue
		}
		drv := opt.Drivers[name]
		skip := map[string]bool{}
		for _, s := range drv.Skip {
			skip[s] = true
		}

		probe, ch, err := makeCore(k, opt.Cons)
		if err != nil {
			out[name] = &CharDump{Abilities: []AbilityDump{{Key: "-", Err: err.Error()}}}
			continue
		}
		cd := &CharDump{NormalHitNum: ch.NormalHitNum, Weapon: ch.Weapon.Key.String()}
		_ = probe

		// The unlabelled default set always runs; driver entries ADD sets.
		sets := append([]CaptureSet{{Label: "", Prereq: nil}}, drv.Sets...)
		for _, set := range sets {
			// ⚠️ The combo length is the PREREQUISITE'S: a stance lengthens it (Mavuika's
			// Nightsoul N5), so it is read off a core that has run the set's steps.
			hitNum := cd.NormalHitNum
			if len(set.Prereq) > 0 {
				if pc, pch, perr := makeCore(k, opt.Cons); perr == nil && runPrereq(pc, pch, set.Prereq, action.ActionAttack) == "" {
					hitNum = pch.NormalHitNum
				}
			}
			specs := defaultSpecs(hitNum)
			if len(set.Captures) > 0 {
				want := map[string]bool{}
				for _, w := range set.Captures {
					want[w] = true
				}
				filtered := specs[:0:0]
				for _, s := range specs {
					if want[s.key] {
						filtered = append(filtered, s)
					}
				}
				specs = filtered
			}

			for _, s := range specs {
				if skip[s.key] {
					continue
				}
				// ⚓ A FRESH core per capture, as pass B has always had (ICD cap round
				// follow-up, 2026-10-04). One core per SET let every capture inherit the
				// state the previous one left: Durin's `E` opened his window and spent
				// the only charge, `hE` read the in-window RECAST and closed it, and
				// `h2E` was a fresh cast whose SetCD drove the charges below zero —
				// gcsim's "unexpected charges less than 0" panic, which also skipped the
				// application capture (pass B runs only on a clean pass A).
				// ⚠️ Prerequisites advance the clock, in BOTH passes. A no-advance version
				// looked tempting (a mode flag is set at execution, not later) and panics:
				// Ayato's second Skill inside the same frame drives his charge count below
				// zero. Advancing by the cancel window is short enough that no stance
				// window expires under it.
				c, ch, err := makeCore(k, opt.Cons)
				if err != nil {
					cd.Abilities = append(cd.Abilities, AbilityDump{Key: s.key, Err: err.Error()})
					continue
				}
				prereq := set.Prereq
				if set.Label == "" {
					prereq = append(append([]Step{}, prereq...), drv.Before[s.key]...)
				}
				// ⚠️ The last step chains into the action UNDER CAPTURE, as pass B's does —
				// an attack cancel let Xianyun's leap state lapse before her second leap.
				capAct, _ := actionByName(s.action)
				prereqErr := runPrereq(c, ch, prereq, capAct)
				// ⚠️ The shared core used to walk the combo FOR us — N2 was read after N1
				// had advanced gcsim's NormalCounter — so a fresh core must walk it
				// itself. Same-frame calls with no clock advance, exactly the reading
				// the shared core gave (pass B walks its prefix at cancel cadence).
				for range comboPrefix(s.key) {
					if _, err := abilityFunc(ch, action.ActionAttack)(nil); err != nil {
						break
					}
				}
				d := captureFrames(ch, c, s)
				if set.Label != "" {
					d.Key = s.key + "@" + set.Label
					d.Prereq = set.Prereq
				}
				if prereqErr != "" && d.Err == "" {
					d.Err = prereqErr
				}
				if !opt.FramesOnly && d.Err == "" {
					apps, aerr := captureApplications(k, opt.Cons, prereq, s, opt.Horizon)
					d.Applications = apps
					if aerr != "" {
						d.Err = "applications: " + aerr
					}
				}
				cd.Abilities = append(cd.Abilities, d)
			}
		}
		out[name] = cd
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", " ")
	if err := enc.Encode(out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
