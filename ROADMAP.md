# ROADMAP.md

# Plano oficial de implementação

Este documento contém a ordem oficial de desenvolvimento.

O agente deve executar SOMENTE a etapa explicitamente solicitada.

Uma etapa só pode ser marcada como concluída depois de atender seus critérios de aceite.

---

# FASE A — FUNDAÇÃO DO EDITOR

---

## ETAPA 01 — Project Setup

### Objetivo

Criar a base técnica do projeto.

### Implementar

* Next.js;
* React;
* TypeScript strict;
* Tailwind;
* shadcn/ui;
* Zustand;
* Fabric.js;
* Zod.

Criar estrutura inicial organizada.

Sugestão:

src/
app/
components/
editor/
ui/
editor/
core/
commands/
history/
types/
utils/
stores/
hooks/
lib/

Criar shell visual:

* top toolbar;
* left sidebar;
* center workspace;
* right panel.

Ainda não implementar recursos avançados.

### Critérios de aceite

* aplicação inicia;
* sem erro TypeScript;
* lint funcional;
* build funcional;
* layout base renderiza.

---

## ETAPA 02 — Canvas Engine

### Objetivo

Criar a infraestrutura central do Fabric.js.

### Implementar

* componente do canvas;
* inicialização Fabric;
* disposal correto;
* gerenciamento de referências;
* canvas lógico;
* workspace visual;
* resize visual do container;
* arquitetura para viewport transform;
* lifecycle seguro.

### Não implementar ainda

* elementos completos;
* layers;
* history completo.

### Critérios de aceite

* canvas aparece;
* não recria desnecessariamente;
* resize do navegador não quebra;
* listeners são removidos corretamente.

---

## ETAPA 03 — Modelo de Dados dos Elementos

### Objetivo

Definir modelo tipado independente do Fabric.

### Implementar

Tipos:

EditorElement
TextElement
ImageElement
ShapeElement

Modelo base:

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

Criar store inicial de elementos.

Criar funções de mapeamento:

EditorElement → Fabric Object

Fabric Object → atualização EditorElement

### Critérios de aceite

* tipagem discriminada;
* sem `any`;
* elementos possuem IDs estáveis;
* Fabric não é única fonte da verdade.

---

## ETAPA 04 — Seleção

### Objetivo

Implementar seleção consistente.

### Implementar

* seleção por clique;
* deselect;
* seleção pelo canvas;
* estado selectedElementIds;
* sincronização Canvas → Zustand;
* sincronização Zustand → Canvas;
* Shift + clique para multiseleção quando suportado.

### Critérios de aceite

* estado e canvas permanecem sincronizados;
* clicar fora limpa seleção;
* não existem loops de sincronização.

---

## ETAPA 05 — Move, Resize e Rotate

### Objetivo

Permitir transformação completa de objetos.

### Implementar

* drag;
* resize;
* rotate;
* transform handles;
* atualização visual durante interação;
* sincronização final com Zustand;
* respeitar `locked`.

Normalizar propriedades quando necessário para evitar inconsistência entre width/height e scale.

### IMPORTANTE

Não criar histórico a cada mousemove.

### Critérios de aceite

* mover funciona;
* redimensionar funciona;
* rotacionar funciona;
* estado é atualizado corretamente;
* objeto bloqueado não transforma;
* sem saltos inesperados ao finalizar transformação.

---

## ETAPA 06 — Upload e Inserção de Imagens

### Objetivo

Permitir adicionar imagens reais ao canvas.

### Implementar

* file picker;
* drag and drop;
* PNG;
* JPG/JPEG;
* WEBP;
* validação básica;
* criação de Asset;
* criação de ImageElement;
* dimensionamento inicial apropriado;
* object URL quando aplicável.

### Critérios de aceite

* usuário consegue importar imagem;
* imagem aparece no canvas;
* pode mover/resize/rotate;
* upload inválido gera feedback.

---

## ETAPA 07 — Text Elements

### Objetivo

Criar sistema funcional de texto.

### Implementar

* adicionar texto;
* edição inline;
* conteúdo;
* font family;
* font size;
* weight;
* color;
* alignment;
* opacity;
* rotation;
* atualização no Zustand.

### Critérios de aceite

* adicionar texto;
* editar texto;
* transformações continuam funcionando;
* estado persiste corretamente.

---

## ETAPA 08 — Properties Panel

### Objetivo

Permitir edição numérica das propriedades.

### Implementar

Para elemento selecionado:

* X;
* Y;
* Width;
* Height;
* Rotation;
* Opacity.

Para texto:

* font size;
* font family;
* weight;
* alignment;
* color.

Alterações devem atualizar imediatamente canvas e state.

### Critérios de aceite

* propriedades exibem valores corretos;
* edição altera objeto selecionado;
* mudanças no canvas atualizam painel.

---

## ETAPA 09 — Layers Panel

### Objetivo

Criar painel funcional de camadas.

### Implementar

Mostrar:

* nome;
* tipo;
* selected state;
* visible state;
* locked state.

Clique na layer seleciona elemento.

Seleção no canvas destaca layer.

### Critérios de aceite

* lista reflete elementos;
* seleção sincronizada nos dois sentidos.

---

## ETAPA 10 — Layer Reordering

### Objetivo

Permitir controlar ordem visual.

### Implementar

* drag-and-drop no painel;
* zIndex;
* sincronização com Fabric;
* bring forward;
* send backward;
* bring to front;
* send to back.

### Critérios de aceite

* reorder visual funciona;
* ordem continua correta após seleção e edição;
* estado representa a mesma ordem.

---

# CHECKPOINT A

Após ETAPA 10:

Executar revisão geral.

Validar:

* imagem;
* texto;
* seleção;
* transformações;
* properties;
* layers;
* reorder.

Criar commit/tag recomendado:

`editor-foundation-v1`

---

# FASE B — EDIÇÃO PROFISSIONAL

---

## ETAPA 11 — Visibility e Lock

Implementar:

* hide/show;
* lock/unlock;
* painel layers;
* canvas;
* indicadores visuais.

Critério:

estado e comportamento devem permanecer sincronizados.

---

## ETAPA 12 — Duplicate e Delete

Implementar:

* delete;
* backspace;
* duplicate;
* novo ID;
* deslocamento da duplicata;
* botões;
* atalhos iniciais.

Não excluir objeto durante edição textual.

---

## ETAPA 13 — Clipboard

Implementar:

* Ctrl/Cmd+C;
* Ctrl/Cmd+V;
* Ctrl/Cmd+X;
* múltiplos objetos quando possível.

Cópia recebe novos IDs.

Paste deve possuir pequeno offset.

---

## ETAPA 14 — History / Undo / Redo

### Objetivo

Criar histórico robusto.

Implementar commands/snapshots apropriados para:

* create;
* delete;
* move;
* resize;
* rotate;
* properties;
* reorder.

Atalhos:

Ctrl/Cmd+Z
Ctrl/Cmd+Shift+Z

Não criar centenas de entradas durante drag.

---

## ETAPA 15 — Keyboard Shortcuts

Implementar gerenciamento centralizado:

* Delete;
* Backspace;
* Ctrl/Cmd+D;
* Ctrl/Cmd+C;
* Ctrl/Cmd+V;
* Ctrl/Cmd+X;
* Ctrl/Cmd+Z;
* Ctrl/Cmd+Shift+Z;
* arrows;
* Shift+arrows.

Arrow:
1 px.

Shift+Arrow:
10 px.

Não interferir em inputs ou edição de texto.

---

## ETAPA 16 — Zoom

Implementar:

* zoom in;
* zoom out;
* percentual;
* fit-to-screen;
* reset;
* Ctrl/Cmd+wheel quando adequado.

Faixa:

10% a 400%.

Zoom não deve alterar dimensões lógicas dos elementos.

---

## ETAPA 17 — Canvas Guides

Implementar guides para:

* centro horizontal;
* centro vertical;
* bordas do canvas.

Mostrar apenas durante movimento relevante.

Não exportar.

---

## ETAPA 18 — Object Snapping

Implementar snapping entre elementos:

* left;
* right;
* top;
* bottom;
* centerX;
* centerY.

Priorizar performance.

Não realizar processamento excessivo em mousemove.

---

## ETAPA 19 — Shapes

Adicionar:

Rectangle
Circle
Line

Propriedades:

fill
stroke
strokeWidth
opacity

Shapes devem participar normalmente de:

* transform;
* layers;
* history;
* clipboard.

---

## ETAPA 20 — Multi-select / Group / Ungroup

Implementar:

* multiseleção robusta;
* group;
* ungroup;
* mover grupo;
* resize;
* rotate.

Preservar estado dos elementos.

---

# CHECKPOINT B

Após ETAPA 20:

Rodar regressão geral.

Criar tag sugerida:

`editor-core-v1`

---

# FASE C — RECURSOS DE DESIGN

---

## ETAPA 21 — Image Crop

Implementar crop não destrutivo.

Preservar asset original.

Permitir:

* reposicionar imagem dentro do frame;
* aplicar crop;
* editar crop posteriormente.

---

## ETAPA 22 — Image Filters

Implementar:

* brightness;
* contrast;
* saturation;
* blur;
* grayscale.

Preferir processamento não destrutivo.

---

## ETAPA 23 — Font System

Implementar sistema de fontes.

Inicialmente:

* fontes padrão;
* integração Google Fonts quando apropriada;
* loading;
* fallback;
* atualização de métricas após carregamento.

---

## ETAPA 24 — Background

Implementar background da página:

* solid color;
* image;
* linear gradient;
* radial gradient.

Background deve ser tratado separadamente dos elementos comuns quando adequado.

---

## ETAPA 25 — Multiple Pages

Implementar estrutura:

Project
→ Pages
→ Elements

Adicionar:

* create page;
* delete page;
* duplicate page;
* switch page;
* rename page.

---

## ETAPA 26 — Format Presets

Implementar presets:

1080x1080
1080x1350
1080x1920
1200x628
1280x720

E custom dimensions.

---

## ETAPA 27 — Local Persistence

Implementar salvamento local estruturado.

Preferir abordagem apropriada para:

* metadata;
* projects;
* assets.

Não guardar grandes imagens arbitrariamente em localStorage.

Utilizar IndexedDB quando necessário.

---

## ETAPA 28 — Autosave

Implementar:

* dirty state;
* debounce;
* saving;
* saved;
* error.

Evitar salvar a cada movimento do mouse.

---

## ETAPA 29 — Export

Implementar:

PNG
JPG
WEBP

Escalas:

1x
2x
3x

Não exportar:

* guides;
* selections;
* handles;
* overlays.

---

## ETAPA 30 — UI/UX Polish

Revisar aplicação completa.

Adicionar quando adequado:

* tooltips;
* context menu;
* loading states;
* empty states;
* feedback;
* acessibilidade básica;
* estados disabled;
* layout consistente;
* acabamento visual.

Não alterar arquitetura desnecessariamente.

---

# CHECKPOINT C — MVP

Após ETAPA 30:

Executar:

* typecheck;
* lint;
* tests;
* production build;
* regressão manual.

Testar fluxo:

1. criar projeto;
2. importar imagem;
3. adicionar texto;
4. manipular elementos;
5. layers;
6. undo;
7. save;
8. reload;
9. export.

Tag sugerida:

`editor-mvp-v1`

---

# FASE D — ARQUITETURA DE IA

---

## ETAPA 31 — AI Provider Architecture

Criar abstrações:

OCRProvider
SegmentationProvider
InpaintingProvider
BackgroundRemovalProvider
VisionAnalysisProvider

Não integrar vendor desnecessariamente nesta etapa.

Criar tipos de entrada e saída.

---

## ETAPA 32 — OCR Provider

Integrar provedor real de OCR.

Entrada:

imagem.

Saída:

DetectedText[]

Campos:

* text;
* boundingBox;
* confidence;
* metadata.

Não criar layers ainda.

---

## ETAPA 33 — OCR → Text Layers

Converter DetectedText em TextElement.

Calcular aproximadamente:

* x;
* y;
* width;
* height;
* font size;
* alignment;
* color quando disponível.

Permitir revisão.

---

## ETAPA 34 — Text Masks

Gerar máscaras correspondentes ao texto raster original.

Adicionar margem/feather adequado.

Preparar para inpainting.

---

## ETAPA 35 — Text Inpainting

Integrar provider real de inpainting.

Entrada:

* imagem;
* mask.

Saída:

background reconstruído sem o texto selecionado.

Preservar original.

---

## ETAPA 36 — Editable Text Pipeline

Unificar:

OCR
→ mask
→ inpainting
→ TextElement

Resultado:

texto originalmente raster passa a possuir:

* background limpo;
* camada de texto editável.

Adicionar tratamento de confidence e falhas.

---

# CHECKPOINT D

Validar com diversos criativos reais.

Não avançar caso pipeline de texto seja inconsistente.

---

# FASE E — SEGMENTAÇÃO DE OBJETOS

---

## ETAPA 37 — Segmentation Provider

Integrar provider real de segmentação.

Entrada:

imagem.

Saída:

SegmentedObject[]

Campos:

* mask;
* boundingBox;
* confidence;
* label quando disponível.

---

## ETAPA 38 — Magic Select

Criar ferramenta:

1. usuário ativa;
2. usuário clica em ponto;
3. sistema solicita segmentação;
4. máscara é apresentada;
5. usuário confirma/cancela.

---

## ETAPA 39 — Object Extraction

Extrair objeto segmentado para asset com transparência.

Preservar:

* resolução;
* posição;
* bounding box.

---

## ETAPA 40 — Object Inpainting

Utilizar máscara para remover objeto original da imagem e reconstruir fundo.

Preservar original.

---

## ETAPA 41 — Extracted Object → Layer

Adicionar asset extraído como ImageElement.

Posicionar exatamente sobre região original.

Depois permitir:

* move;
* resize;
* rotate;
* opacity;
* reorder.

---

## ETAPA 42 — Mask Editor

Criar edição manual de máscara.

Ferramentas:

* add brush;
* subtract brush;
* brush size;
* undo;
* feather.

---

## ETAPA 43 — Background Removal

Adicionar ferramenta específica:

Remove Background.

Resultado:

derived transparent asset.

Original preservado.

---

## ETAPA 44 — Logo Detection / Isolation

Criar estratégia para identificar/isolar logos.

Pode combinar:

* vision analysis;
* segmentation;
* heurísticas.

Não prometer identificação perfeita.

---

## ETAPA 45 — Desmontar Criativo

### Objetivo

Criar pipeline unificado.

Fluxo:

INPUT IMAGE
↓
VISION ANALYSIS
↓
OCR
↓
SEGMENTATION
↓
TEXT MASKS
↓
OBJECT MASKS
↓
EXTRACTION
↓
INPAINTING
↓
LAYER RECONSTRUCTION
↓
REVIEW
↓
EDITOR

Mostrar resultado detectado.

Exemplo:

5 textos
1 logo
2 objetos
1 background

Permitir usuário revisar antes de aplicar.

Manter confidence.

Original sempre preservado.

---

# CHECKPOINT E — AI V1

Testar criativos com:

* fundos simples;
* fundos complexos;
* pessoas;
* produtos;
* múltiplos textos;
* logos;
* sobreposição.

Tag:

`creative-ai-v1`

---

# FASE F — SMART CREATIVE

---

## ETAPA 46 — Smart Resize Architecture

Criar arquitetura para adaptação de layout.

Não depender de coordenadas rígidas.

Definir constraints e informações necessárias para adaptação.

---

## ETAPA 47 — 1:1 → 4:5 Adaptation

Entrada:

1080x1080.

Saída:

1080x1350.

Criar nova página.

Preservar original.

Reposicionar elementos inteligentemente.

Permitir edição manual.

---

## ETAPA 48 — Portrait → Stories/Reels

Adaptar layouts para:

1080x1920.

Considerar:

* safe areas;
* legibilidade;
* escala;
* hierarquia.

---

## ETAPA 49 — Creative Variations

Criar sistema para duplicar um criativo e gerar variações de:

* layout;
* posicionamento;
* cores;
* tamanho;
* elementos.

Alterações de copy só quando explicitamente habilitadas.

---

## ETAPA 50 — AI Creative Variations

Objetivo final.

A partir de um criativo vencedor:

* analisar estrutura;
* preservar identidade;
* gerar múltiplas variações;
* diferentes formatos;
* diferentes hierarquias;
* opções de headline/CTA quando solicitado;
* manter tudo editável.

Nunca substituir projeto original.

Criar novas variantes.

---

# CHECKPOINT FINAL

Executar revisão completa de:

* performance;
* estabilidade;
* segurança;
* UX;
* export;
* persistência;
* AI pipelines;
* error handling;
* provider failures;
* assets;
* regressões.

Criar release adequada.

---

# REGRA PARA EXECUTAR UMA ETAPA

Quando o usuário disser:

`Execute a ETAPA 05`

Você deve:

1. localizar ETAPA 05 neste arquivo;
2. verificar suas dependências;
3. verificar DEVELOPMENT_STATE.md;
4. implementar somente aquela etapa;
5. executar validações;
6. atualizar DEVELOPMENT_STATE.md;
7. informar conclusão;
8. NÃO iniciar ETAPA 06 automaticamente.
