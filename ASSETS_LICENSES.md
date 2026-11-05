# ASSETS_LICENSES — Ở tù online 3d-v9

All shipped 3D assets are free for commercial use. Prefer CC0. Gameplay code © project.

## Summary

| Pack | License | Role |
|---|---|---|
| Quaternius Ultimate Modular Men | CC0 1.0 | Male bodies + Idle/Walk/Run/Wave/Interact |
| Quaternius Ultimate Modular Women | CC0 1.0 | Female bodies + same anim set |
| Kenney.nl (Furniture, Food, Nature, etc.) | CC0 1.0 | Props, furniture, kitchen, garden, tools |
| Three.js | MIT | Engine |
| Google Draco | Apache-2.0 | Mesh compression decoder (wasm/js) |
| Procedural fallback meshes | Project | Used if GLB load fails |

**Not used:** Mixamo (redistribution for web games restricted) — not shipped.

## Characters (3d-v9)

Source: [Quaternius](https://quaternius.com/) — Ultimate Modular Men + Women (CC0).

Processed: Draco-compressed GLB; canvas fabric textures (vertical stripes / solid / police green) mapped on clothing UVs; number patch; VN peaked police cap + shoulder boards for guards. Prisoners never wear hats.

| File | Role |
|---|---|
| `prisoner_worker.glb` / `prisoner_casual.glb` | Male prisoners |
| `prisoner_f_casual.glb` / `_worker` / `_punk` / `_formal` | Female prisoners (hair-style variants) |
| `guard_swat.glb` | Guards / promoted players (recolored VN police green) |

### Country → uniform

- **Việt Nam (`vn`)**: shirt+pants, vertical black/white stripes, no hat
- **Mỹ (`us`)**: full orange jumpsuit, no hat
- **Trung Quốc (`cn`)**: blue/white vertical stripes, no hat
- **Khác (`other`)**: solid brown full set, no hat
- **Quản giáo**: green VN police shirt+pants, peaked cap (red band + gold emblem), shoulder boards

### Gender

- **Nam** → male Quaternius body
- **Nữ** → female Quaternius body
- **LGBT** → either body (picker) + optional rainbow badge

Country + gender persist in Supabase `players.data.appearance` JSON (no schema migration).

## Props

Source: [Kenney.nl](https://kenney.nl/) CC0 — see prior v8 inventory under `public/assets/props/`.

## Vendor / runtime

- `public/vendor/three.module.js` — Three.js r160.1 (MIT)
- `public/vendor/jsm/**` — Three examples (MIT)
- `public/assets/draco/*` — Draco decoder (Apache-2.0)

## Budget

- Target download budget: ~10–15 MB uncompressed game assets.
- Characters ~6 MB Draco GLB; props ~0.85 MB; total assets folder ~8 MB.
