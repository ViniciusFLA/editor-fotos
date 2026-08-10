# SPEC.md

# Product Specification — Creative Editor

---

# 1. VISÃO DO PRODUTO

Construir uma aplicação web profissional para criação, edição, adaptação e reconstrução de criativos publicitários.

O produto combina:

1. editor gráfico semelhante conceitualmente a Canva/Figma;
2. gerenciamento de criativos;
3. ferramentas específicas para mídia paga;
4. futuras funcionalidades de inteligência artificial para desmontagem e reconstrução de criativos.

---

# 2. USO PRINCIPAL

O usuário poderá importar uma imagem ou começar com um canvas vazio.

Depois poderá:

* adicionar imagens;
* adicionar textos;
* adicionar formas;
* mover elementos;
* redimensionar;
* rotacionar;
* alterar transparência;
* organizar camadas;
* bloquear;
* esconder;
* agrupar;
* copiar;
* colar;
* duplicar;
* aplicar efeitos;
* criar múltiplos formatos;
* salvar;
* exportar.

---

# 3. DESMONTAR CRIATIVO

Em uma fase posterior haverá:

`Desmontar Criativo com IA`

Entrada:

PNG / JPG / WEBP achatado.

Objetivo:

reconstruir aproximadamente componentes independentes.

Exemplo:

INPUT

criativo.jpg

OUTPUT APROXIMADO

* Background
* Pessoa
* Produto
* Logo
* Headline
* Subheadline
* Preço
* Badge
* CTA

Esses elementos passarão a ser manipuláveis separadamente.

---

# 4. LIMITAÇÃO FUNDAMENTAL

Arquivos raster achatados não contêm necessariamente:

* layers;
* texto original;
* fonte original;
* objetos independentes;
* estrutura semântica.

Portanto, `Desmontar Criativo` é uma reconstrução.

Nunca apresentar o resultado como recuperação perfeita do arquivo-fonte original.

---

# 5. STACK

Frontend:

* Next.js;
* React;
* TypeScript;
* Tailwind;
* shadcn/ui.

Canvas:

* Fabric.js.

State:

* Zustand.

Validação:

* Zod.

Persistência futura:

* PostgreSQL;
* Prisma.

---

# 6. LAYOUT PRINCIPAL

Desktop-first.

Estrutura:

---

## TOP TOOLBAR

## LEFT SIDEBAR | CANVAS | RIGHT PROPERTIES

## PAGES / STATUS / ZOOM

---

# 7. TOP TOOLBAR

Deverá comportar progressivamente:

* nome do projeto;
* undo;
* redo;
* tamanho;
* zoom;
* preview;
* save state;
* export.

---

# 8. LEFT SIDEBAR

Categorias previstas:

* Uploads;
* Text;
* Elements;
* Images;
* Layers;
* AI.

Nem todas precisam existir desde a primeira etapa.

Somente mostrar recursos funcionais.

---

# 9. CANVAS

Canvas central com tamanho lógico independente do tamanho visual na tela.

Exemplos:

1080x1080
1080x1350
1080x1920

O canvas deve poder ser escalado visualmente sem alterar dimensões lógicas do documento.

---

# 10. TAMANHOS PREDEFINIDOS

Instagram Square:
1080 x 1080

Instagram / Meta Portrait:
1080 x 1350

Stories / Reels:
1080 x 1920

Facebook Landscape:
1200 x 628

YouTube Thumbnail:
1280 x 720

Custom:
largura e altura definidas pelo usuário.

---

# 11. ELEMENTOS

Tipos fundamentais:

* text;
* image;
* shape.

Tipos futuros:

* group;
* mask;
* AI-derived asset.

---

# 12. MODELO BASE

Todo elemento deve possuir propriedades equivalentes a:

id
type
name

x
y

width
height

scaleX
scaleY

rotation

opacity

visible
locked

zIndex

metadata

---

# 13. TEXT ELEMENT

Propriedades previstas:

* text;
* fontFamily;
* fontSize;
* fontWeight;
* fontStyle;
* textAlign;
* fill;
* letterSpacing;
* lineHeight;
* opacity;
* rotation.

Futuras:

* stroke;
* shadow;
* text effects;
* custom fonts.

---

# 14. IMAGE ELEMENT

Propriedades previstas:

* assetId;
* src;
* x;
* y;
* dimensions;
* crop;
* rotation;
* opacity;
* flipX;
* flipY.

Futuras:

* filters;
* mask;
* border radius;
* shadow.

---

# 15. SHAPE ELEMENT

Inicialmente:

* rectangle;
* circle;
* line.

Futuramente:

* arrow;
* polygon;
* custom SVG.

---

# 16. SELEÇÃO

Clique simples:

selecionar elemento.

Clique fora:

limpar seleção.

Shift + clique:

multiseleção.

Seleção deverá sincronizar com painel de layers.

---

# 17. TRANSFORM CONTROLS

Elemento selecionado poderá ter:

* bounding box;
* resize handles;
* rotation handle.

Objetos bloqueados não deverão aceitar transformação.

---

# 18. MOVIMENTO

Mouse:

drag.

Keyboard:

Arrow = 1 px

Shift + Arrow = 10 px

---

# 19. PROPERTIES PANEL

Ao selecionar um elemento, painel direito deverá exibir propriedades relevantes.

Campos básicos:

X
Y
W
H
Rotation
Opacity

Campos específicos aparecem de acordo com o tipo.

---

# 20. LAYERS

Painel deverá representar todos os objetos.

Cada layer terá:

* name;
* type;
* selected state;
* visible;
* locked.

Operações:

* select;
* rename;
* reorder;
* hide/show;
* lock/unlock;
* duplicate;
* delete.

---

# 21. Z-INDEX

A ordem do painel de layers deve refletir corretamente a ordem visual.

Operações:

* bring forward;
* send backward;
* bring to front;
* send to back.

---

# 22. UNDO / REDO

Atalhos:

Ctrl/Cmd + Z

Ctrl/Cmd + Shift + Z

Histórico deverá futuramente incluir:

* create;
* delete;
* move;
* resize;
* rotate;
* style;
* reorder;
* grouping;
* text changes.

---

# 23. CLIPBOARD

Ctrl/Cmd + C

Ctrl/Cmd + V

Ctrl/Cmd + X

Ao colar, deslocar ligeiramente a cópia.

---

# 24. DUPLICATE

Ctrl/Cmd + D

Cópia deve receber novo ID.

---

# 25. DELETE

Delete ou Backspace.

Não excluir elemento quando usuário estiver editando texto diretamente.

---

# 26. ZOOM

Faixa planejada:

10% até 400%.

Controles:

* zoom in;
* zoom out;
* fit;
* reset;
* Ctrl/Cmd + wheel quando adequado.

Zoom não altera dimensões lógicas.

---

# 27. GUIDES

Guides visuais deverão ajudar:

* centro horizontal;
* centro vertical;
* bordas;
* objetos.

Não aparecem na exportação.

---

# 28. SNAPPING

Snapping progressivo:

1. centro do canvas;
2. bordas;
3. outros elementos.

Possibilidade futura de ativar/desativar.

---

# 29. FORMAS

Rectangle:

* fill;
* stroke;
* opacity.

Circle:

* fill;
* stroke;
* opacity.

Line:

* stroke;
* width.

---

# 30. GROUPING

Multiseleção deverá futuramente permitir:

* group;
* ungroup;
* move conjunto;
* resize conjunto;
* rotate conjunto.

---

# 31. CROP

Crop deve ser preferencialmente não destrutivo.

Original do asset permanece disponível.

---

# 32. IMAGE FILTERS

Planejados:

* brightness;
* contrast;
* saturation;
* blur;
* grayscale.

---

# 33. FONTES

Suporte inicial/futuro a Google Fonts.

Sistema deve aguardar carregamento da fonte antes de depender de suas métricas.

Futuramente permitir custom fonts.

---

# 34. BACKGROUND

Canvas pode possuir:

* solid color;
* image;
* linear gradient;
* radial gradient.

---

# 35. MULTIPLE PAGES

Project:

Page 1
Page 2
Page 3
...

Cada página:

* width;
* height;
* background;
* elements.

---

# 36. FORMAT VARIATIONS

Exemplo:

Creative Master

├── 1:1
├── 4:5
├── 9:16
└── 16:9

Inicialmente manual.

Posteriormente IA pode adaptar composição.

---

# 37. PERSISTÊNCIA

Projeto deve ser serializável.

Modelo conceitual:

Project

* id
* name
* pages
* assets
* createdAt
* updatedAt

Page

* id
* name
* width
* height
* background
* elements

Asset

* id
* type
* source
* metadata

---

# 38. AUTOSAVE

Alterações deverão ser salvas com debounce.

Estados:

* saved;
* unsaved;
* saving;
* error.

---

# 39. EXPORTAÇÃO

Formatos:

PNG
JPG
WEBP

Escalas:

1x
2x
3x

Elementos auxiliares não devem aparecer:

* guides;
* selection border;
* handles;
* safe areas.

---

# 40. SAFE AREAS

Futuramente mostrar overlays para:

* Stories;
* Reels;
* TikTok;
* outras plataformas.

Não exportar overlays.

---

# 41. AI PROVIDERS

Criar interfaces independentes.

OCRProvider

SegmentationProvider

InpaintingProvider

BackgroundRemovalProvider

VisionAnalysisProvider

---

# 42. OCR

Entrada:

imagem.

Saída conceitual:

detectedText[]

Cada item:

* text;
* boundingBox;
* confidence;
* approximateColor;
* approximateFontSize;
* approximateAlignment.

---

# 43. OCR PARA LAYER

Texto OCR deverá poder ser transformado em camada TextElement.

A posição deve aproximar o original.

---

# 44. TEXT REMOVAL

Para que o texto detectado seja realmente editável:

1. detectar;
2. criar máscara;
3. remover texto raster original;
4. reconstruir região;
5. adicionar TextElement novo.

---

# 45. SEGMENTAÇÃO

Identificar objetos como:

* pessoa;
* produto;
* objeto;
* logo;
* região visual independente.

Saída:

mask + confidence + metadata.

---

# 46. MAGIC SELECT

Usuário:

1. escolhe Magic Select;
2. clica em uma região;
3. sistema identifica objeto;
4. mostra máscara;
5. usuário confirma.

---

# 47. OBJECT EXTRACTION

Objeto segmentado deverá virar asset transparente independente.

---

# 48. OBJECT INPAINTING

Depois de extrair objeto:

* criar máscara;
* reconstruir background onde o objeto estava.

---

# 49. MASK EDITOR

Ferramentas:

* add;
* subtract;
* brush size;
* undo;
* feather.

---

# 50. REMOVE BACKGROUND

Uma imagem selecionada poderá gerar variante transparente.

Original permanece preservado.

---

# 51. DESMONTAR CRIATIVO

Pipeline desejado:

INPUT
↓
VISION ANALYSIS
↓
OCR + SEGMENTATION
↓
MASKS
↓
EXTRACTION
↓
INPAINTING
↓
LAYER RECONSTRUCTION
↓
EDITOR

---

# 52. CONFIDENCE

Resultados de IA devem conter confidence quando disponível.

Baixa confiança deve poder ser apresentada para revisão.

---

# 53. AI RESULT REVIEW

Antes de aceitar desmontagem completa, futuramente mostrar:

Detectamos:

* X textos;
* X objetos;
* X logos;
* X imagens.

Usuário pode confirmar.

---

# 54. ORIGINAL / DERIVED

Nunca substituir permanentemente asset original.

Utilizar conceito:

Original Asset
↓
Derived Asset(s)

---

# 55. SMART RESIZE

Fase futura.

Entrada:

1080x1080

Saída:

1080x1920

Sistema deverá tentar preservar:

* hierarquia;
* legibilidade;
* posicionamento relativo;
* identidade visual.

---

# 56. AUTOMATIC VARIATIONS

Fase futura.

Partindo de um criativo, gerar variações de:

* layout;
* headline;
* CTA;
* cor;
* formato;
* posicionamento.

Sempre permitir edição manual.

---

# 57. PERFORMANCE TARGET

Editor deverá continuar utilizável com pelo menos aproximadamente 100 objetos comuns.

Evitar operações O(n) pesadas a cada movimento quando desnecessárias.

---

# 58. NON-DESTRUCTIVE PRINCIPLE

Sempre que razoável:

* preserve original;
* armazene parâmetros;
* evite modificar permanentemente asset fonte.

---

# 59. BROWSER SUPPORT

Prioridade inicial:

desktop moderno.

Chrome/Chromium como principal ambiente durante desenvolvimento.

Posteriormente validar outros navegadores.

---

# 60. PRODUTO FINAL

Objetivo final:

O usuário poderá importar:

`ad-original.jpg`

executar:

`Desmontar Criativo`

obter aproximadamente:

Background
Product
Person
Logo
Headline
Subheadline
Price
CTA

e então editar independentemente:

* conteúdo;
* imagem;
* tamanho;
* posição;
* rotação;
* opacidade;
* ordem;
* estilo.

Além disso, poderá criar variações do mesmo criativo para diferentes formatos e campanhas.
