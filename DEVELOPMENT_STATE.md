# DEVELOPMENT_STATE.md

## Estado atual

**ETAPA 01 — Project Setup** — CONCLUIDA
**ETAPA 02 — Canvas Engine** — CONCLUIDA
**ETAPA 03 — Modelo de Dados dos Elementos** — CONCLUIDA

**Próxima etapa:** ETAPA 04 — Seleção

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
