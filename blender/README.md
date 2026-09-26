# Robô mascote (Blender)

Três versões do mesmo robô, todas testadas no Blender 5.0.1:

| Arquivo | O que é |
|---|---|
| `robot_glb.blend` | Modelo gerado por IA (`models/robot_ai.glb`) já de frente, em escala, com plástico brilhante, olhos/anéis/base emitindo luz e estúdio montado. **Mais fiel à imagem de referência.** |
| `robot_parts.blend` | O mesmo modelo do `.glb` **separado em peças** (cabeça, visor, fones, pescoço, corpo, faixa preta, base, ombros, braços, mãos), com pivôs nas articulações e hierarquia pronta para posar/animar. |
| `robot_procedural.blend` | Robô modelado por código (`cute_robot.py`): peças separadas e limpas, fácil de editar/animar. |

Abra qualquer `.blend` no Blender e aperte F12 para renderizar (Cycles).

## Scripts

- `import_robot_glb.py`: importa um `.glb`, gira/escala, melhora materiais
  (máscara de brilho tirada da própria textura) e monta luzes, câmera e bloom.
- `separate_robot_parts.py`: corta a malha única do `.glb` em peças pela
  posição e pela cor da textura, tapa os cortes com "encaixes" pretos e monta
  a hierarquia `Robot > Head/Body_White/Shoulder > Arm > Hand`. Olhos, boca e
  logo são pintura na textura, então ficam no `Visor` e no `Body_White`.
- `cute_robot.py`: gera o robô peça por peça (cabeça superelipsoide, visor
  curvo com rosto "impresso", corpo torneado, logo, braços, fones).

Os scripts funcionam colados na ferramenta `execute_blender_code` do Blender MCP
(no `import_robot_glb.py`, ajuste `GLB_PATH` para o caminho no seu PC), ou pela
linha de comando:

```
blender -b -P blender/import_robot_glb.py -- blender/models/robot_ai.glb --render blender/renders/glb --save blender/robot_glb.blend
blender -b -P blender/separate_robot_parts.py -- blender/models/robot_ai.glb --render blender/renders/parts --save blender/robot_parts.blend
blender -b -P blender/cute_robot.py -- --render blender/renders/procedural --save blender/robot_procedural.blend
```

## Renders

| | Frente | 3/4 | Lado | Costas |
|---|---|---|---|---|
| GLB | ![](renders/glb_front.png) | ![](renders/glb_three_quarter.png) | ![](renders/glb_side.png) | ![](renders/glb_back.png) |
| Procedural | ![](renders/procedural_front.png) | ![](renders/procedural_three_quarter.png) | ![](renders/procedural_side.png) | ![](renders/procedural_back.png) |

Peças separadas (vista explodida):

| Frente | 3/4 |
|---|---|
| ![](renders/parts_exploded_front.png) | ![](renders/parts_exploded_three_quarter.png) |
