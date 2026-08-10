# DEVELOPMENT_STATE.md

## Estado atual

**ETAPA 01 — Project Setup** — CONCLUIDA
**ETAPA 02 — Canvas Engine** — CONCLUIDA
**ETAPA 03 — Modelo de Dados dos Elementos** — CONCLUIDA
**ETAPA 04 — Seleção** — CONCLUIDA
**ETAPA 05 — Move, Resize e Rotate** — CONCLUIDA
**ETAPA 06 — Upload e Inserção de Imagens** — CONCLUIDA

**Próxima etapa:** ETAPA 07 — Text Elements
**Última atualização:** 2026-08-10

---

## ETAPA 01 — Project Setup

### Status: CONCLUIDA

### Objetivo
Criar a base técnica do projeto com Next.js, React, TypeScript strict, Tailwind, shadcn/ui, Zustand, Fabric.js e Zod.

### Implementado

- Projeto Next.js com TypeScript strict habilitado
- Tailwind CSS v4 com @tailwindcss/postcss
- shadcn/ui configurado com tema base neutral + CSS variables
- Zustand (store de editor) instalado e inicializado
- Fabric.js v6 instalado (ainda não integrado ao canvas)
- Zod v4 instalado com schemas de tipos definidos
- Shell visual com 4 áreas principais:
  - Top Toolbar (nome do projeto, undo/redo, preview, export)
  - Left Sidebar (ícones: Uploads, Text, Elements, Images, Layers, AI)
  - Center Canvas Area (placeholder)
  - Right Properties Panel (placeholder)
- Footer Status Bar (página, dimensões, status de save, zoom)

### Estrutura de diretórios

```
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    editor/
      index.ts
      top-toolbar.tsx
      left-sidebar.tsx
      canvas-area.tsx
      right-panel.tsx
      footer-status.tsx
    ui/
      button.tsx
  editor/
    core/
+     element-factory.ts
    commands/
    history/
  hooks/
+   use-canvas.ts
  lib/
    utils.ts
  stores/
    editor-store.ts
  types/
    index.ts
  utils/
    index.ts
```

### Dependências instaladas

| Pacote             | Versão    |
|---------------------|-----------|
| next                | 16.3.0    |
| react               | 19.2.8    |
| react-dom           | 19.2.8    |
| typescript          | ^5        |
| tailwindcss         | ^4        |
| @tailwindcss/postcss| ^4        |
| zustand             | ^5.0.14   |
| fabric              | ^6.9.1    |
| @types/fabric       | removido (fabric v6 tem types built-in) |
| zod                 | ^4.4.3    |
| shadcn              | ^4.16.2   |
| lucide-react        | ^1.31.0   |
| clsx                | ^2.1.1    |
| tailwind-merge      | ^3.6.0    |
| tw-animate-css      | ^1.4.0    |
| class-variance-auth | ^0.7.1    |
| @base-ui/react      | ^1.7.0    |

### Critérios de aceite

- [x] Aplicação inicia (`npm run dev` funciona)
- [x] Sem erro TypeScript (`npx tsc --noEmit` limpo)
- [x] Lint funcional (`npx eslint .` limpo)
- [x] Build funcional (`npx next build` sucesso)
- [x] Layout base renderiza (toolbar + sidebar + workspace + panel)

### Validações executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Observações

- TypeScript `strict: true` ativado no tsconfig.json
- Fabric.js v6 integrado ao canvas via hook `useCanvas`
- Store do Zustand é mínima — contém apenas gerenciamento de elementos e seleção
- Tipos base (EditorElement, TextElement, ImageElement, ShapeElement) definidos
- Componentes do shell são todos Client Components (`'use client'`)

---

## ETAPA 02 — Canvas Engine

### Status: CONCLUIDA

### Objetivo
Criar a infraestrutura central do Fabric.js com inicializacao, disposal, resize e viewport transform.

### Implementado

- Hook `useCanvas` (`src/hooks/use-canvas.ts`) com:
  - Inicializacao do Fabric.js Canvas em canvas element via ref
  - Canvas logico 1080x1080 (default) com fundo branco
  - `selection: false` (selecao sera implementada na ETAPA 04)
  - Cleanup completo no unmount: `canvas.dispose()` + nullificacao da ref
  - Flag `disposed` para evitar race condition durante inicializacao assincrona
  - `requestAnimationFrame` para render inicial garantido
- Componente `CanvasArea` atualizado:
  - Substituiu placeholder por canvas real com Fabric.js
  - Container com `overflow: hidden` para workspace
  - Viewport transform: canvas posicionado com `position: absolute`, centrado via `translate(-50%, -50%)`
  - Escala visual calculada dinamicamente via `ResizeObserver`
  - Canvas oculto (`visibility: hidden`) ate `renderAll` completo
- Arquitetura de viewport transform:
  - Estado `scale` derivado de container size / logical size
  - Padding de 32px ao redor do canvas
  - Escala cap em 1.0 (sem upscale alem do tamanho nativo)
  - Fundacao pronta para zoom (ETAPA 16) — basta multiplicar scale por zoom factor
- `@types/fabric` removido — Fabric.js v6 possui types built-in em `dist/index.d.ts`

### Critérios de aceite

- [x] Canvas aparece (Fabric.js inicializa e renderiza canvas branco 1080x1080)
- [x] Nao recria desnecessariamente (useEffect depende apenas de logicalWidth/logicalHeight)
- [x] Resize do navegador nao quebra (ResizeObserver recalcula escala automaticamente)
- [x] Listeners sao removidos corretamente (cleanup no useEffect com disposed flag)
- [x] Viewport transform architecture pronta para zoom futuro

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao    |
|--------------------------------------|---------|
| `src/hooks/use-canvas.ts`            | Criado  |
| `src/components/editor/canvas-area.tsx` | Atualizado |
| `package.json`                       | Atualizado (@types/fabric removido) |

### Observacoes

- Fabric.js v6 usa tipos proprios; `@types/fabric` v5 removido para evitar conflitos
- Canvas logico default: 1080x1080 (Instagram Square). Sera parametrizavel em etapas futuras
- Arquitetura de scale/zoom usa CSS transform no elemento canvas; Fabric.js mantem coordenadas logicas
- `dispose()` e assincrono (retorna `Promise<boolean>`) — chamado no cleanup sem await (seguro no unmount)

---

## ETAPA 03 — Modelo de Dados dos Elementos

### Status: CONCLUIDA

### Objetivo
Definir modelo tipado independente do Fabric com schemas Zod, mapeamento bidirecional entre EditorElement ↔ Fabric Object, e store como fonte unica da verdade.

### Implementado

- **Schemas Zod completos** (`src/types/index.ts`):
  - `BaseElementSchema` — 15 propriedades base (id, type, name, x, y, width, height, scaleX, scaleY, rotation, opacity, visible, locked, zIndex)
  - `TextElementSchema` — estende base com 9 campos especificos (text, fontFamily, fontSize, fontWeight, fontStyle, textAlign, fill, letterSpacing, lineHeight)
  - `ImageElementSchema` — estende base com 8 campos (assetId, src, cropX, cropY, cropWidth, cropHeight, flipX, flipY)
  - `ShapeElementSchema` — estende base com shapeType via `ShapeTypeSchema` + fill, stroke, strokeWidth
  - `AnyElementSchema` — `z.discriminatedUnion('type', [...])` sem `any`
  - `EditorStateSchema` — `z.array(AnyElementSchema)` substituindo `z.array(z.any())`
- **Element Factory** (`src/editor/core/element-factory.ts`):
  - `createFabricObject(element)` — overload para retorno tipado por tipo (FabricText | FabricImage | Rect | Circle | Line)
  - `extractElementUpdates(fabricObject, elementType)` — extrai `Partial<AnyElement>` do Fabric Object
  - `syncElementToFabric(element, fabricObject)` — aplica dados do modelo ao Fabric Object
  - `setElementId` / `getElementId` — `WeakMap<FabricObject, string>` para rastrear ID do elemento sem poluir o objeto Fabric
  - `applyCommonProps` — mapeamento de propriedades compartilhadas (x→left, y→top, rotation→angle, etc.)
  - Suporte a `locked` mapeado para `lockMovementX/Y`, `lockRotation`, `lockScalingX/Y`, `selectable: false`, `evented: false`
- **Shape factory** com suporte aos 3 tipos:
  - `rectangle` → `Rect` com width, height, fill, stroke, strokeWidth
  - `circle` → `Circle` com radius derivado de `Math.min(width, height) / 2`
  - `line` → `Line` com coordenadas [x, y, x+width, y+height]

### Criterios de aceite

- [x] Tipagem discriminada (`AnyElement = TextElement | ImageElement | ShapeElement`)
- [x] Sem `any` nos schemas Zod (`EditorStateSchema` usa `AnyElementSchema`)
- [x] Elementos possuem IDs estaveis (`generateId()` em `src/utils/index.ts`)
- [x] Fabric nao e unica fonte da verdade (store Zustand e a fonte; element-factory faz a ponte)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao     |
|--------------------------------------|----------|
| `src/types/index.ts`                 | Atualizado (Zod schemas completos) |
| `src/editor/core/element-factory.ts` | Criado   |

### Observacoes

- `WeakMap` para ID tracking evita poluicao do FabricObject e e type-safe (sem casts para `any`)
- `createFabricObject` tem overloads para retorno tipado; imagem e async (ETAPA 06 usara isso)
- `syncElementToFabric` e `extractElementUpdates` serao usados em ETAPA 04 (selecao) e ETAPA 08 (properties panel)
- `applyCommonProps` nao aplica `scaleX`/`scaleY` em TextElement (FabricText gerencia internamente)

---

## ETAPA 04 — Seleção

### Status: CONCLUIDA

### Objetivo
Implementar selecao consistente com sincronizacao bidirecional entre Canvas (Fabric.js) e estado (Zustand), sem loops de sincronizacao.

### Implementado

- **Canvas com selecao habilitada** (`selection: true` em `use-canvas.ts`):
  - `selectionColor: 'rgba(59, 130, 246, 0.1)'` — fundo azul translucido na area de selecao
  - `selectionBorderColor: '#3b82f6'` — borda azul
  - `selectionLineWidth: 1` com `selectionDashArray: [4, 4]` — linha tracejada
  - `preserveObjectStacking: true` — ordem de stacking preservada durante selecao
- **Sincronizacao Canvas → Zustand** (eventos Fabric):
  - `selection:created` — clique em objeto → atualiza `selectedElementIds` na store
  - `selection:updated` — Shift+clique para multi-selecao → atualiza store
  - `selection:cleared` — clique fora (vazio) → limpa `selectedElementIds`
  - IDs extraidos via `getElementId(obj)` do `WeakMap` da element-factory
  - Comparacao de arrays antes de atualizar store (evita updates desnecessarios)
- **Sincronizacao Zustand → Canvas** (efeito reactivo):
  - `useEditorStore(s => s.selectedElementIds)` observa mudancas na store
  - Quando IDs diferem do canvas: `discardActiveObject()` + `setActiveObject()`
  - Multi-selecao via `ActiveSelection` quando >1 elemento selecionado
  - Busca reversa de FabricObject via `findFabricObjectById(canvas, id)`
- **Prevencao de loops**:
  - `syncingFromCanvasRef` — flag `true` durante sync canvas→store
  - Efeito store→canvas verifica flag antes de agir
  - `requestAnimationFrame` para resetar flag apos sync completo
  - Comparacao `arraysEqual` antes de qualquer acao para evitar updates circulares
- **Helper `findFabricObjectById`** adicionado em `element-factory.ts`:
  - Busca reversa: `canvas.getObjects().find(obj => getElementId(obj) === id)`

### Criterios de aceite

- [x] Estado e canvas permanecem sincronizados (bidirecional com loop prevention)
- [x] Clicar fora (canvas vazio) limpa selecao (`selection:cleared` → store update)
- [x] Nao existem loops de sincronizacao (`syncingFromCanvasRef` + `arraysEqual` guard)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                     |
|--------------------------------------|--------------------------|
| `src/hooks/use-canvas.ts`            | Atualizado (selection + sync) |
| `src/editor/core/element-factory.ts` | Atualizado (findFabricObjectById) |

### Observacoes

- Fabric.js gerencia nativamente Shift+clique para multi-selecao com `selection: true`
- `ActiveSelection` importado de `fabric` para multi-selecao programatica no sentido store→canvas
- Eventos Fabric sao removidos no cleanup (`canvas.off()`), evitando memory leaks
- `arraysEqual` usa `sort()` para comparacao independente de ordem

---

## ETAPA 05 — Move, Resize e Rotate

### Status: CONCLUIDA

### Objetivo
Permitir transformacao completa de objetos (drag, resize, rotate) com sincronizacao final ao Zustand e normalizacao de propriedades.

### Implementado

- **Transformacoes nativas do Fabric.js** (ja funcionam com `selection: true` da ETAPA 04):
  - **Drag** — mover objeto com mouse
  - **Resize** — handles de redimensionamento nos cantos/arestas
  - **Rotate** — handle de rotacao no topo
  - **Transform handles** — bounding box + resize corners + rotation handle (Fabric.js default)
- **`object:modified` handler** em `use-canvas.ts`:
  - Dispara ao final de cada transformacao (nao durante mousemove — sem spam de updates)
  - Captura `canvas.getActiveObject()` (objeto modificado)
  - Extrai ID via `getElementId()` do `WeakMap`
  - Normaliza o FabricObject (`normalizeFabricObject`)
  - Extrai updates via `extractElementUpdates(obj, element.type)`
  - Persiste no Zustand via `store.updateElement(id, updates)`
  - `syncingFromCanvasRef` previne loop com sync de selecao
- **Normalizacao de escala** (`normalizeFabricObject` em `element-factory.ts`):
  - Apos resize, Fabric.js pode alterar `scaleX`/`scaleY`
  - Normalizacao bakeia scale em width/height: `width *= scaleX`, `height *= scaleY`, `scaleX = 1`, `scaleY = 1`
  - Evita inconsistencia entre width/height e scale no modelo de dados
- **Respeito a `locked`** (corrigido em `applyCommonProps`):
  - `lockMovementX/Y`, `lockRotation`, `lockScalingX/Y` = `element.locked` (booleano direto)
  - `selectable`, `evented` = `!element.locked`
  - Funciona para locked=true (bloqueia) e locked=false (libera)
  - Objeto bloqueado nao aceita transformacao

### Criterios de aceite

- [x] Mover funciona (drag nativo Fabric + sync Zustand no final)
- [x] Redimensionar funciona (resize handles + normalizacao scale→width/height)
- [x] Rotacionar funciona (rotation handle + angle→rotation mapping)
- [x] Estado e atualizado corretamente (`object:modified` → `updateElement`)
- [x] Objeto bloqueado nao transforma (`lockMovementX/Y`, `lockRotation`, `lockScalingX/Y`)
- [x] Sem saltos inesperados ao finalizar transformacao (normalizacao garante consistencia)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                       |
|--------------------------------------|--------------------------------------------|
| `src/hooks/use-canvas.ts`            | Atualizado (object:modified handler)       |
| `src/editor/core/element-factory.ts` | Atualizado (normalizeFabricObject, locked fix) |

### Observacoes

- Nao ha sincronizacao durante mousemove — apenas no evento `object:modified` (ao final da transformacao)
- `normalizeFabricObject` e chamado antes de extrair updates para garantir width/height finais no store
- Fabric.js v6 usa `angle` (graus) internamente; mapping para `rotation` no modelo e feito em `extractCommonUpdates`

---

## ETAPA 06 — Upload e Inserção de Imagens

### Status: CONCLUIDA

### Objetivo
Permitir adicionar imagens reais ao canvas via file picker e drag-and-drop, com validacao e dimensionamento inicial apropriado.

### Implementado

- **File picker** via LeftSidebar:
  - Hidden `<input type='file' accept='image/png,image/jpeg,image/webp'>`
  - Clique no icone Uploads dispara `fileInputRef.current?.click()`
  - Arquivo selecionado: validado → `URL.createObjectURL()` → `setPendingImageSrc(url)`
  - URL anterior revogada automaticamente (`URL.revokeObjectURL`)
- **Drag and drop** no CanvasArea:
  - Handlers `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop` no container
  - `dragCounterRef` para tracking correto de enter/leave aninhados
  - Feedback visual: `bg-blue-50 ring-2 ring-blue-400 ring-inset` quando arrastando
  - Drop: validacao → object URL → store `pendingImageSrc`
- **Validacao** (`src/lib/image-validation.ts`):
  - Tipos aceitos: `image/png`, `image/jpeg`, `image/webp`
  - Tamanho maximo: 20 MB
  - Erro exibido no tooltip do icone Uploads (icone fica `text-destructive`)
  - Erro auto-clear ao selecionar arquivo valido
- **Inserção da imagem no canvas** (CanvasArea):
  - `useEffect` observa `pendingImageSrc` da store
  - `FabricImage.fromURL(src)` carrega a imagem
  - Dimensionamento inicial: max 70% do canvas (`MAX_IMAGE_DIMENSION = 0.7`)
  - Mantem aspect ratio, centraliza no canvas
  - `scaleX`/`scaleY` = scale ratio; `width`/`height` = dimensoes naturais
  - `setElementId(fabricImage, id)` para rastreamento
  - `canvas.add(fabricImage)` + `canvas.setActiveObject(fabricImage)`
  - `ImageElement` criado e adicionado ao Zustand via `addElement`
  - `pendingImageSrc` limpo apos insercao
- **Store** (`editor-store.ts`):
  - `pendingImageSrc: string | null` — mensagem entre LeftSidebar e CanvasArea
  - `uploadError: string | null` — feedback de validacao
  - `setPendingImageSrc`, `setUploadError` — setters

### Criterios de aceite

- [x] Usuario consegue importar imagem (file picker + drag-drop)
- [x] Imagem aparece no canvas (FabricImage criado e adicionado)
- [x] Pode mover/resize/rotate (herdado da ETAPA 05 via `object:modified`)
- [x] Upload invalido gera feedback (icone vermelho + tooltip com erro)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                      |
|--------------------------------------|-------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (pendingImageSrc, uploadError) |
| `src/components/editor/left-sidebar.tsx` | Atualizado (file input, upload trigger) |
| `src/components/editor/canvas-area.tsx` | Atualizado (drag-drop, image insertion) |
| `src/lib/image-validation.ts`        | Criado (validacao de imagem)             |

### Observacoes

- `pendingImageSrc` usa object URLs (`blob:...`); URLs antigas sao revogadas ao selecionar novo arquivo
- Imagens sao dimensionadas para caber em 70% do canvas (evita overflow em canvas pequeno)
- `zIndex` do ImageElement e calculado a partir do store, nao do Fabric.js (Fabric.js ordena por posicao no array)
- Drag-and-drop usa `dragCounterRef` para evitar flicker em elementos aninhados

---
