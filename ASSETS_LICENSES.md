# ASSETS_LICENSES — Ở tù online 3d-v8

All shipped 3D assets are free for commercial use. Prefer CC0. Gameplay code © project.

## Summary

| Pack | License | Role |
|---|---|---|
| Quaternius Ultimate Modular Men | CC0 1.0 | Rigged humanoids + Idle/Walk/Run/Wave/Interact |
| Kenney.nl (Furniture, Food, Nature, etc.) | CC0 1.0 | Props, furniture, kitchen, garden, tools |
| Three.js | MIT | Engine |
| Google Draco | Apache-2.0 | Mesh compression decoder (wasm/js) |
| Procedural fallback meshes | Project | Used if GLB load fails |

**Not used:** Mixamo (redistribution for web games restricted) — not shipped.

**Not used:** Poly Pizza non-CC0 packs — only CC0 sources considered.


## Characters

Source: [Quaternius](https://quaternius.com/) — Ultimate Modular Men (CC0).

Processed: Draco-compressed GLB; in-game tint/recolor + number patch + police cap.

- `public/assets/characters/guard_swat.glb` — 904.9 KB — CC0 Quaternius
- `public/assets/characters/prisoner_casual.glb` — 886.6 KB — CC0 Quaternius
- `public/assets/characters/prisoner_worker.glb` — 890.3 KB — CC0 Quaternius

### Tint mapping

- `prisoner_worker.glb` → orange jumpsuit (+ number patch)
- `prisoner_casual.glb` → black/white stripe tint (+ number patch)
- `guard_swat.glb` → olive VN-police style + red collar accents + olive/red cap

## Props

Source: [Kenney.nl](https://kenney.nl/) CC0 asset packs (Furniture Kit, Food Kit, Nature Kit, and related).

Mirrored during fetch via public GitHub mirrors when kenney.nl CDN blocked.

- `public/assets/props/barrel.glb` — 33.5 KB — CC0 Kenney
- `public/assets/props/bedBunk.glb` — 39.8 KB — CC0 Kenney
- `public/assets/props/bedSingle.glb` — 18.2 KB — CC0 Kenney
- `public/assets/props/bench.glb` — 10.5 KB — CC0 Kenney
- `public/assets/props/bookcaseOpen.glb` — 17.6 KB — CC0 Kenney
- `public/assets/props/box-large.glb` — 7.3 KB — CC0 Kenney
- `public/assets/props/box-small.glb` — 7.3 KB — CC0 Kenney
- `public/assets/props/box.glb` — 13.7 KB — CC0 Kenney
- `public/assets/props/bucket.glb` — 7.6 KB — CC0 Kenney
- `public/assets/props/cabinetBedDrawer.glb` — 15.7 KB — CC0 Kenney
- `public/assets/props/cardboardBoxClosed.glb` — 5.3 KB — CC0 Kenney
- `public/assets/props/chair.glb` — 10.5 KB — CC0 Kenney
- `public/assets/props/chairDesk.glb` — 38.1 KB — CC0 Kenney
- `public/assets/props/cog-a.glb` — 13.3 KB — CC0 Kenney
- `public/assets/props/cooking-knife.glb` — 5.3 KB — CC0 Kenney
- `public/assets/props/cooking-spatula.glb` — 6.0 KB — CC0 Kenney
- `public/assets/props/crop_carrot.glb` — 12.4 KB — CC0 Kenney
- `public/assets/props/crop_pumpkin.glb` — 10.6 KB — CC0 Kenney
- `public/assets/props/crop_turnip.glb` — 14.0 KB — CC0 Kenney
- `public/assets/props/crops_cornStageC.glb` — 11.7 KB — CC0 Kenney
- `public/assets/props/crops_dirtRow.glb` — 4.6 KB — CC0 Kenney
- `public/assets/props/desk.glb` — 14.7 KB — CC0 Kenney
- `public/assets/props/flower_redA.glb` — 6.9 KB — CC0 Kenney
- `public/assets/props/kitchenCabinet.glb` — 10.2 KB — CC0 Kenney
- `public/assets/props/kitchenFridge.glb` — 19.6 KB — CC0 Kenney
- `public/assets/props/kitchenFridgeLarge.glb` — 29.9 KB — CC0 Kenney
- `public/assets/props/kitchenSink.glb` — 22.9 KB — CC0 Kenney
- `public/assets/props/kitchenStove.glb` — 53.1 KB — CC0 Kenney
- `public/assets/props/lampRoundFloor.glb` — 6.4 KB — CC0 Kenney
- `public/assets/props/loungeDesignSofa.glb` — 8.9 KB — CC0 Kenney
- `public/assets/props/loungeSofa.glb` — 9.4 KB — CC0 Kenney
- `public/assets/props/pan.glb` — 19.5 KB — CC0 Kenney
- `public/assets/props/plantSmall1.glb` — 8.0 KB — CC0 Kenney
- `public/assets/props/plant_bush.glb` — 4.3 KB — CC0 Kenney
- `public/assets/props/plate.glb` — 8.3 KB — CC0 Kenney
- `public/assets/props/pot.glb` — 18.5 KB — CC0 Kenney
- `public/assets/props/rugRectangle.glb` — 3.1 KB — CC0 Kenney
- `public/assets/props/sideTable.glb` — 8.6 KB — CC0 Kenney
- `public/assets/props/table.glb` — 8.0 KB — CC0 Kenney
- `public/assets/props/tableCoffee.glb` — 8.1 KB — CC0 Kenney
- `public/assets/props/televisionModern.glb` — 6.2 KB — CC0 Kenney
- `public/assets/props/tree_default.glb` — 9.2 KB — CC0 Kenney
- `public/assets/props/utensil-knife.glb` — 3.4 KB — CC0 Kenney
- `public/assets/props/washer.glb` — 47.0 KB — CC0 Kenney
- `public/assets/props/workbench-anvil.glb` — 29.4 KB — CC0 Kenney
- `public/assets/props/workbench.glb` — 25.5 KB — CC0 Kenney

## Manifest zones (lazy load)

- **labor**: carrot, pumpkin, turnip, corn, dirtRow, workbench, anvil, crateLarge, crateSmall, barrel, bucket, cog
- **kitchen**: fridge, fridgeLarge, sink, stove, kitchenCabinet, pan, pot, plate, spatula, knife
- **happiness**: sofa, sofaDesign, lamp, plant, rug, tv, tableCoffee, flower
- **canteen**: table, chair, bench
- **quarantine**: bedBunk, bedSingle, desk, chairDesk, cabinet

## Vendor / runtime

- `public/vendor/three.module.js` — Three.js r160.1 (MIT)
- `public/vendor/jsm/loaders/GLTFLoader.js`, `DRACOLoader.js` — Three examples (MIT)
- `public/vendor/jsm/utils/SkeletonUtils.js`, `BufferGeometryUtils.js` — Three examples (MIT)
- `public/assets/draco/*` — Draco decoder (Apache-2.0)

## Attribution (in-game)

Credits page: toolbar 🎨 button → overlay. This file is the canonical license record.

## Budget

- Characters+props GLB total: 3.29 MB
- With Draco decoder + Three module: see `du` at ship time (~6–7 MB assets+vendor before gzip).
- Target download budget: ~10–15 MB uncompressed game assets.

