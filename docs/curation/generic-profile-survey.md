# Generic-character profile survey

_Read-only survey. Corpus: 123 characters, 116 curated (framed)._
_Scope: normals, charges, and skill/burst timings all drawn from the 76 sword/polearm/catalyst users (the on-field-DPS archetype)._

## 1 · Normal attack profile

Hit-count histogram (sword/polearm/catalyst): 5→28 4→23 3→20 6→4 1→1
**Modal hit count → 5** (max observed 6)

Per-position medians — `key=frames(n samples)`; `·below` = under the ~30% support threshold, so it falls back to `swap` rather than entering the generic map:

- **N1** swap=13(n76) N=19(n69) C=23(n64) E=13(n3 ·below) Q=11(n3 ·below) D=12(n3 ·below) J=13(n3 ·below)
- **N2** swap=13(n75) N=22(n70) C=26(n60) E=16(n3 ·below) Q=16(n3 ·below) D=16(n3 ·below) J=16(n3 ·below)
- **N3** swap=22(n75) N=36(n64) C=36(n55) E=32(n3 ·below) Q=33(n3 ·below) D=32(n3 ·below) J=34(n3 ·below)
- **N4** swap=27(n55) N=40(n47) C=42(n30) E=31(n2 ·below) Q=31(n2 ·below) D=31(n2 ·below) J=31(n2 ·below)
- **N5** swap=26(n32) N=66(n27) C=33(n5 ·below) E=26(n1 ·below) Q=26(n1 ·below) D=16(n2 ·below) J=16(n2 ·below)
- **N6** swap=34(n4) N=65(n4) C=55(n1 ·below)

## 2 · Charged attack profile

Full-charge length median 47f, MAD 10.5 across 76 in-scope chargeFrames.
Outliers trimmed (>3.5 MAD): klee(swap=104, 5.4·MAD) lisa(swap=90, 4.1·MAD) varesa(swap=139, 8.8·MAD) yae_miko(swap=94, 4.5·MAD)
Per-key medians over 72 survivors:

- **CA** swap=46(n72) N=55(n52) C=75(n4 ·below) E=48(n59) Q=49(n62) D=26(n65) J=26(n65)

## 3 · Skill (E) profile

Cast animation (`frames.swap`): **median 37f ≈ 0.62s** (n76). Current parser constant: 30f (0.50s).

Cooldown — mode **12s** · 12s→11 16s→9 6s→8 15s→8 10s→7 9s→5 4s→3 5s→3

Duration — 16/76 abilities carry one; mode **10s** · 10s→5 9s→4 6s→2 5s→1 7.5s→1 12s→1 12.57s→1 22s→1

_No energy cost on this ability type._

## 4 · Burst (Q) profile

Cast animation (`frames.swap`): **median 93f ≈ 1.55s** (n76). Current parser constant: 60f (1.00s).

Cooldown — mode **15s** · 15s→34 20s→19 18s→13 12s→6 13.5s→3 22s→1

Duration — 10/76 abilities carry one; mode **12s** · 12s→2 15s→2 2.8s→1 4s→1 5s→1 7s→1 11.87s→1 18s→1

Energy — mode **60** · 60→32 80→20 70→12 40→6 50→4 90→2

## 5 · Recommended generic profile

```json
{
	"normalHitCount": 5,
	"normalHits": [
		{
			"swap": 13,
			"N": 19,
			"C": 23
		},
		{
			"swap": 13,
			"N": 22,
			"C": 26
		},
		{
			"swap": 22,
			"N": 36,
			"C": 36
		},
		{
			"swap": 27,
			"N": 40,
			"C": 42
		},
		{
			"swap": 26,
			"N": 66
		}
	],
	"chargeFrames": {
		"swap": 46,
		"N": 55,
		"E": 48,
		"Q": 49,
		"D": 26,
		"J": 26
	},
	"skill": {
		"castSwap": 37,
		"cooldown": 12
	},
	"burst": {
		"castSwap": 93,
		"cooldown": 15,
		"energy": 60
	}
}
```

_Values are frames unless suffixed; cast animation feeds the parser fallback (replacing E_CAST_S/Q_CAST_S), cooldown/duration/energy are for authoring Blank as a "typical" kit. Eyeball before baking in._
