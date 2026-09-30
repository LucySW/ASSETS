# Circuito de Conhecimentos 3D (low poly)

Maquete navegável em Three.js do Circuito de Conhecimentos (Unimontes / FAPEMIG), feita a partir das 12 fotos de referência.

## Como abrir

Abra `index.html` em qualquer navegador moderno (o Three.js vem do jsDelivr). Se o navegador bloquear arquivos locais, rode um servidor simples na pasta:

```
python3 -m http.server 8000
# depois abra http://localhost:8000
```

A cena abre na vista **Frente (foto 10)**: quem sai pelos arcos coloridos, de costas para o Circuito, olhando o prédio dos murais do outro lado da rua. **Direita (foto 11)** e **Esquerda (foto 12)** são as vistas laterais a partir desse mesmo ponto: o prédio das varandas redondas e a rua das motos com o arco no canto. Os outros botões levam às demais fotos, e **Caminhar** ativa o modo primeira pessoa (W A S D, Shift corre, Esc sai). Também dá para abrir direto numa vista com `?view=`: `frente`, `direita`, `esquerda`, `entrada`, `fachada`, `panorama`, `aerea`, `geral`, `patio13`, `blocos45`, `corredor`, `bloco8`.

## Escala e medidas

1 unidade = 1 metro. A planta foi medida na foto aérea (girada 24,6° para alinhar o eixo do Circuito, com carros de 4,4 m como régua):

| Elemento | Medida usada |
| --- | --- |
| Blocos (cada barra) | 5,4 a 14,4 m × 4,5 m, altura 4,3 m, marquise escura a 3 m |
| Fileiras | duas, alinhadas, com corredor de 7,5 m entre as fachadas de vidro |
| Módulo A (blocos 1, 2, 3) | x −2,2 a 11,2 (2 e 1 separados por uma passagem de 2 m) |
| Módulo B (blocos 4 e 5) | x −24,5 a −10,9 |
| Módulo C (blocos 6, 7, 8) | x −45,4 a −31 |
| Arco arco-íris | 9 pórticos a cada 0,62 m, vão de 6,2 m, 3,8 a 4,35 m de altura |
| Rua em frente ao arco (fotos 10 a 12) | 8 m de largura, sai da ponta da ilha para o noroeste, 17° à esquerda |
| Prédio dos murais | 12 m × 17 m (com a ala recuada), 3,5 m de parede, em frente à saída do arco |

Eixos: +X aponta para o arco de entrada (nordeste), +Z para a rua sudeste e o prédio das varandas.

## O que está modelado

- Os 8 blocos em duas fileiras alinhadas, com os números virados para quem entra pelo arco (só o 8 fica na ponta do fundo, virado ao contrário), vitrines de vidro com faixa jateada, chapas onduladas coloridas, marquises, câmeras e as coberturas de ligação com luminárias.
- Arco arco-íris com os pórticos em L (azul e verdes de um lado, roxos e azul-claro do outro) e completos (vermelho e laranjas), como aparece na aérea.
- Fachada da entrada: totem azul texturizado da FAPEMIG/Unimontes atrás da placa branca grossa com o infinito ilustrado, "CIRCUITO DE" em roxo e "CONHECIMENTOS" em verde, sobre grama com meio-fio branco.
- Placa PELD, armário com trepadeira, carteira escolar, tenda branca, jardins rentes ao chão, bancos de concreto no corredor, o canteiro elevado em L da entrada e a floreira redonda com bancos curvos sob a cobertura do módulo A (os dois únicos elevados, como nas fotos), piso intertravado em espinha de peixe e piso tátil amarelo.
- Estacionamentos em ângulo, rua de saída com motos dos dois lados, prédio vermelho no fim da rua, prédio dos murais com placa de motos, prédio branco com varandas redondas, muro de blocos, árvores e palmeiras.

## Pontos inferidos

- A posição do 2 é inferida: ele está na segunda sala da fileira da esquerda, antes do 4, junto à cobertura do módulo A.
- A tenda branca só aparece nas fotos do evento, não na aérea; ela foi mantida porque aparece nas fotos 5 e 6.
- Os prédios ao fundo (torres cinza e rosada) são volumes aproximados, só para compor o horizonte.

`renders/` tem capturas de cada vista.
