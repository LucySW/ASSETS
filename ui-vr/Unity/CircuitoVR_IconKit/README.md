# CircuitoVR_IconKit

Copie esta pasta para `Assets/`. Documentação completa em `ui-vr/README.md`.

| Pasta | Conteúdo |
| --- | --- |
| `Sprites/Icons` | `<id>_idle.png`, `<id>_hover.png` (512 px) |
| `Sprites/Icons/HoverSheets` | `<id>_hover_sheet.png`, flipbook 4×4 (256 px/quadro, laço de 1,33 s) |
| `Sprites/Illustrations` | ilustrações dos cards do seletor (+ `HoverSheets`) |
| `Sprites/Plates` | `<tipo>_<estilo>_<estado>.png` e `<tipo>_<estilo>_glow.png`, 9-slice |
| `Sprites/Buttons` | botões prontos `btn_*_<normal/hover/pressed/disabled>.png` |
| `Models` | `<id>.glb` com clipe `hover` (requer glTFast) |
| `Scripts` | `VRIconButton` (UI), `VRIcon3D` (GLB), `Editor/IconKitImporter` |

Bordas de 9-slice (px): `square` 148 · `pill` 104 · `card` 100 · `badge` 56.
