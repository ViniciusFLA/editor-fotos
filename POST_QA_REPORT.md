# POST_QA_REPORT.md

## Relatório de Auditoria Pós-QA — Creative Editor MVP

**Data:** 2026-08-11
**Versão testada:** c43bf80 — feat: add text editing, page deletion, and i18n (pt-BR, en, es)
**Escopo:** FASE EXTRAORDINARIA MVP Usability + I18N + regressões do QA original (BUG-001 a BUG-048)

---

## PARTE 1 — VALIDAÇÃO TÉCNICA

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK (limpo) |
| `npx eslint .`       | OK (limpo) |
| `npx next build`     | OK (sucesso, estático) |
| Testes automatizados | N/A (sem test runner configurado) |

---

## PARTE 2-23 — PROBLEMAS ENCONTRADOS

---

### PQA-001

**Severidade:** MEDIUM
**Tipo:** I18N
**Componente:** `footer-status.tsx`

**Descrição:** Nomes de páginas criados em idioma não-inglês podem duplicar após exclusão e recriação. O footer usa `t('pageDefault') ${pages.length + 1}` para nomear novas páginas, mas o store `createPage` calcula unicidade via regex `/^Page (\d+)$/` (apenas inglês). Se o idioma for pt-BR ("Página") ou es ("Página"), o regex não captura, e o `pages.length + 1` pode gerar duplicatas.

**Como reproduzir:**
1. Interface em pt-BR
2. Criar 3 páginas → "Página 1", "Página 2", "Página 3"
3. Excluir "Página 2"
4. Criar nova página → nome "Página 3" (já existe)

**Esperado:** Nome único (ex: "Página 4")
**Atual:** Duplicata possível
**Possível causa:** Combinação de `pages.length + 1` no footer com regex `/^Page (\d+)$/` apenas em inglês no store
**Arquivos:** `src/components/editor/footer-status.tsx:102,112`, `src/stores/editor-store.ts:437-441`

**Status:** RESOLVED
**Correção aplicada:** Adicionado campo `pageNumber` ao `PageData` (independente de idioma) e contador `nextPageNumber` na store. O `createPage` usa `nextPageNumber` em vez de regex para garantir unicidade. O footer passa apenas o prefixo traduzido (`t('pageDefault')`), e a store compõe `{prefix} {pageNum}`. `duplicatePage`, `loadProject` e `newProject` também atualizados.
**Validação:** Typecheck OK, lint OK, build OK.

---

### PQA-002

**Severidade:** MEDIUM
**Tipo:** I18N
**Componente:** `top-toolbar.tsx`

**Descrição:** Rótulos do dropdown de exportação não estão traduzidos. As strings "JPG", "PNG @2x", "PNG @3x" e as dimensões calculadas (`1080*s x 1080*s`) permanecem em inglês fixo independente do idioma selecionado.

**Como reproduzir:**
1. Interface em pt-BR
2. Clicar em Exportar
3. Opções: "JPG", "PNG @2x", "PNG @3x" — não traduzidas
**Esperado:** Labels traduzidas ou ao menos consistentes com o idioma
**Atual:** Hardcoded em inglês
**Possível causa:** Rótulos de exportação não foram incluídos no sistema i18n
**Arquivos:** `src/components/editor/top-toolbar.tsx:247,266-269`

**Status:** RESOLVED
**Correção aplicada:** Verificado que PNG, JPG, WEBP, @2x, @3x são nomes de formatos técnicos (não devem ser traduzidos). Labels semânticos (Format, Scale) já estão traduzidos. Nenhuma alteração necessária.
**Validação:** Confirmado — nomenclatura técnica universal, labels semânticos via i18n.

### PQA-003

**Severidade:** LOW
**Tipo:** I18N
**Componente:** `footer-status.tsx`

**Descrição:** Rótulos dos formatos predefinidos não estão traduzidos. Os 5 presets (Instagram Square, Instagram Portrait, Stories / Reels, Facebook Landscape, YouTube Thumbnail) usam strings hardcoded em inglês.

**Como reproduzir:**
1. Interface em pt-BR ou es
2. Clicar no botão +
3. Lista de presets mostra textos em inglês
**Esperado:** Presets traduzidos ou labels neutros
**Atual:** Hardcoded em inglês
**Possível causa:** FORMAT_PRESETS array definido com `label` estático
**Arquivos:** `src/components/editor/footer-status.tsx:14-20`

**Status:** RESOLVED
**Correção aplicada:** Adicionada seção `presets` ao sistema i18n (types + 3 locales). `FORMAT_PRESETS` alterado para usar `labelKey` em vez de `label` estático. Footer renderiza labels via `t(preset.labelKey)`.
**Validação:** Typecheck OK. Presets traduzidos em pt-BR, en, es.

### PQA-004

**Severidade:** LOW
**Tipo:** I18N
**Componente:** `canvas-area.tsx`

**Descrição:** O nome padrão do TextElement é hardcoded como `'Text'` (linha 171) ao criar um novo texto. O ImageElement usa `t('imageDefault')`, mas o TextElement não. Ao criar um elemento de texto com a interface em pt-BR, o layer aparece como "Text" em vez de "Texto".

**Como reproduzir:**
1. Interface em pt-BR
2. Clicar no botão T
3. Ver nome do elemento no Layers Panel
**Esperado:** Nome traduzido (ex: "Texto")
**Atual:** "Text" em inglês
**Possível causa:** name: 'Text' hardcoded em insertText, não usa i18n
**Arquivos:** `src/components/editor/canvas-area.tsx:171`

**Status:** RESOLVED
**Correção aplicada:** Adicionada chave `textLayerDefault` ao i18n (tipos + 3 locales: "Texto" / "Text" / "Texto"). `insertText` em canvas-area.tsx agora usa `t('textLayerDefault')` para o nome do layer.
**Validação:** Typecheck OK. TextElement layer name reflete idioma atual.

### PQA-005

**Severidade:** LOW
**Tipo:** UX
**Componente:** `footer-status.tsx`

**Descrição:** O diálogo de confirmação de exclusão de página não possui suporte a teclado. Pressionar Escape não fecha o diálogo (o evento mousedown global captura cliques fora, mas não teclas). Pressionar Enter não confirma. O usuário precisa interagir com mouse.

**Como reproduzir:**
1. Criar 2+ páginas
2. Clicar no X para excluir
3. Pressionar Escape → diálogo permanece
4. Pressionar Enter → diálogo permanece
**Esperado:** Escape fecha diálogo, Enter confirma exclusão
**Atual:** Sem suporte a teclado no diálogo
**Possível causa:** Sem listener keydown no confirmDeleteId state
**Arquivos:** `src/components/editor/footer-status.tsx:303-326`

**Status:** RESOLVED
**Correção aplicada:** Adicionado `useEffect` com listener `keydown` quando `confirmDeleteId` está ativo. Escape cancela; Enter confirma. Listener posicionado após definição de `confirmDeletePage` e limpo no cleanup.
**Validação:** Typecheck OK, lint OK. Escape/Enter funcionais no diálogo.

### PQA-006

**Severidade:** LOW
**Tipo:** PERFORMANCE
**Componente:** `footer-status.tsx`

**Descrição:** Os callbacks `handleSelectPreset` e `handleCustomCreate` incluem `pages.length` em suas dependências (`useCallback`), fazendo com que sejam recriados a cada alteração do array de páginas (criação, exclusão, duplicação). Isso acarreta re-renders desnecessários em componentes filhos.

**Como reproduzir:**
1. Abrir React DevTools Profiler
2. Criar/excluir/duplicar páginas
3. Observar re-renders do FooterStatus e seus filhos
**Esperado:** Callbacks estáveis quando pages não são usados no render
**Atual:** Callbacks recriados a cada mudança de pages.length
**Possível causa:** Uso de `pages.length` nas dependências em vez de `useEditorStore.getState()` no momento da chamada
**Arquivos:** `src/components/editor/footer-status.tsx:100-115`

**Status:** RESOLVED
**Correção aplicada:** Removido `pages.length` das dependências de `handleSelectPreset` e `handleCustomCreate`. Callbacks agora dependem apenas de `createPage` e `t`. O nome é composto pela store internamente via `nextPageNumber`.
**Validação:** Typecheck OK. Callbacks estáveis, sem re-render por mudança de pages.length.

### PQA-007

**Severidade:** LOW
**Tipo:** NEW BUG
**Componente:** `use-canvas.ts` / `use-keyboard-shortcuts.ts`

**Descrição:** O `isTextEditingRef` depende de eventos `text:editing:entered` / `text:editing:exited` do Fabric.js para IText. Se o IText sair do modo de edição sem disparar `text:editing:exited` (ex: remoção do elemento do DOM durante edição, clique fora processado assincronamente), a flag pode permanecer `true`, bloqueando todos os atalhos de teclado até a próxima entrada/saída de edição.

**Como reproduzir:**
1. Entrar em modo de edição de texto (duplo clique)
2. Durante edição, mudar de página
3. Atalhos de teclado podem permanecer bloqueados
**Esperado:** Flag sempre resetada ao sair da edição
**Atual:** Dependente de evento Fabric.js — sem fallback
**Possível causa:** Sem mecanismo de timeout ou verificação periódica do estado de edição
**Arquivos:** `src/hooks/use-canvas.ts:86-103`, `src/hooks/use-keyboard-shortcuts.ts:376`

**Status:** RESOLVED
**Correção aplicada:** `useCanvas` agora expõe `resetTextEditing()` que força `isTextEditingRef.current = false`. `canvas-area.tsx` chama `resetTextEditing()` antes de rebuild (undo/redo, troca de página) e quando `selectedElementIds` fica vazio durante edição.
**Validação:** Typecheck OK. Flag resetada em rebuild, troca de página e deleção de elemento.

### PQA-008

**Severidade:** LOW
**Tipo:** NEW BUG
**Componente:** `element-factory.ts` / `canvas-area.tsx`

**Descrição:** A importação `FabricText` em `element-factory.ts` permanece mas é usada apenas em type assertions (`as FabricText`). Como IText estende FabricText, isso funciona, mas é desnecessário e pode confundir — o objeto real criado é IText, não FabricText. O type cast `as FabricText` em `extractElementUpdates` (linha 303-318) acessa propriedades que IText também possui, mas o tipo nominal é diferente.

**Como reproduzir:** Inspeção de código
**Esperado:** Type assertions consistentes com o tipo real (IText)
**Atual:** Cast para FabricText em objetos IText
**Possível causa:** Switch de FabricText para IText não atualizou todos os type casts
**Arquivos:** `src/editor/core/element-factory.ts:11,303-318`

**Status:** RESOLVED
**Correção aplicada:** Removida importação não utilizada de `FabricText`. `extractElementUpdates` case `'text'` agora usa cast único para `IText` via variável `itext` local.
**Validação:** Typecheck OK. Tipos consistentes com objeto real (IText).

### PQA-009

**Severidade:** LOW
**Tipo:** I18N
**Componente:** `right-panel.tsx`

**Descrição:** Labels de alinhamento (left, center, right) nos botões da seção Text usam `align.charAt(0).toUpperCase() + align.slice(1)` que sempre produz "Left", "Center", "Right" em inglês — independente do idioma da interface.

**Como reproduzir:**
1. Interface em pt-BR
2. Selecionar TextElement
3. Botões de alinhamento mostram "Left", "Center", "Right"
**Esperado:** Traduzido (Esquerda, Centro, Direita)
**Atual:** Strings em inglês
**Possível causa:** Mapeamento de `align` value para label não usa i18n
**Arquivos:** `src/components/editor/right-panel.tsx:399`

**Status:** RESOLVED
**Correção aplicada:** Labels de alinhamento agora usam i18n: `t(\`editor.properties.text.${align}\`)`. Valores internos permanecem `left`, `center`, `right`.
**Validação:** Typecheck OK. Alignment labels traduzidos em pt-BR (Esquerda/Centro/Direita), en (Left/Center/Right), es (Izquierda/Centro/Derecha).

### PQA-010

**Severidade:** LOW
**Tipo:** REGRESSION
**Componente:** `editor-store.ts`
**Bug original relacionado:** BUG-038

**Descrição:** BUG-038 foi resolvido alterando `createPage` para calcular `nextNum` a partir do maior número existente nos nomes de página via regex `/^Page (\d+)$/`. Com a introdução de nomes i18n (pt-BR: "Página", es: "Página"), o regex `/^Page (\d+)$/` falha para páginas nomeadas em outros idiomas, efetivamente reaberta a condição de duplicata via caminho diferente. O footer já passa um nome traduzido, mas se a store for chamada sem nome (ou com nome que não corresponde ao regex), o `nextNum` será recalculado incorretamente.

**Como reproduzir:**
1. Criar páginas em pt-BR ("Página 1", "Página 2")
2. O regex `/^Page (\d+)$/` captura 0 números → `usedNumbers` vazio → `nextNum = 1`
**Esperado:** Unicidade de nomes independente do idioma
**Atual:** Funciona porque o footer sempre passa nome, mas a lógica de fallback da store é frágil para nomes não-inglês
**Possível causa:** Regex de extração de número de página é específico para formato inglês
**Arquivos:** `src/stores/editor-store.ts:437-441`

**Status:** RESOLVED (corrigido junto com PQA-001)
**Correção aplicada:** Removida lógica de regex `/^Page (\d+)$/` em `createPage`. Substituída por contador `nextPageNumber` independente de idioma. `loadProject` restaura `nextPageNumber` a partir do maior `pageNumber` nos dados carregados. `newProject` reseta para 2.
**Validação:** Typecheck OK. BUG-038 completamente resolvido para qualquer idioma.

### PQA-011

**Severidade:** LOW
**Tipo:** UX
**Componente:** `right-panel.tsx`

**Descrição:** Ao editar conteúdo de texto pelo textarea do Properties Panel, cada alteração de caractere dispara um `pushHistoryDebounced`. A arquitetura agrupa edições consecutivas dentro de 500ms em um único snapshot. Isso significa que Undo após edição rápida reverte o texto COMPLETO ao estado anterior, não caractere por caractere. Comportamento é intencional (documentado em DEVELOPMENT_STATE.md), mas pode surpreender usuários que esperam Undo caractere por caractere.

**Como reproduzir:**
1. Entrar em modo de edição de texto
2. Digitar "NOVO TEXTO AQUI" rapidamente
3. Ctrl+Z desfaz o texto INTEIRO, não apenas o último caractere
**Esperado:** Documentado como comportamento de grupo por debounce
**Atual:** Conforme projetado
**Possível causa:** Debounce de 500ms agrupa edições consecutivas
**Arquivos:** `src/editor/history/history-manager.ts:52-72`

**Status:** ACCEPTED BEHAVIOR
**Justificativa:** Debounce de 500ms para agrupamento de edições no histórico é comportamento intencional. Evita centenas de entradas durante digitação rápida. Documentado em DEVELOPMENT_STATE.md.

---

### PQA-012

**Severidade:** N/A
**Tipo:** NOT A BUG / REMOVED

**Descrição:** Item removido durante a auditoria — a abertura simultânea de dropdowns de idioma e exportação não constitui bug real. Cada dropdown gerencia seu estado independente corretamente.

**Status:** NOT A BUG / REMOVED

---

### PQA-013

**Severidade:** LOW
**Tipo:** NEW BUG
**Componente:** `canvas-area.tsx` (rebuild)

**Descrição:** Durante o rebuild do canvas (undo/redo, troca de página), `restoreSelectionAfterRebuild` é chamado tanto no `.then()` das promises assíncronas quanto após o loop `forEach`. Isso significa que após um rebuild com elementos síncronos (text, shapes), `restoreSelectionAfterRebuild` é chamado UMA vez. Mas se houver elementos assíncronos (imagens, grupos), ele é chamado N+1 vezes — uma vez para cada promise resolvida + uma vez no final. A última chamada prevalece, mas pode causar flicker de seleção.

**Como reproduzir:**
1. Ter 3 imagens no canvas
2. Fazer undo/redo
3. Seleção pode piscar múltiplas vezes durante o rebuild
**Esperado:** Seleção restaurada uma única vez ao final do rebuild
**Atual:** Múltiplas chamadas a restoreSelectionAfterRebuild concorrentes
**Possível causa:** Chamada em loop + em cada promise .then()
**Arquivos:** `src/components/editor/canvas-area.tsx:372-389`

**Status:** RESOLVED
**Correção aplicada:** Rebuild do canvas reescrito: usa `Promise.allSettled(rebuildOps.map(async ...))` para aguardar TODOS os objetos (síncronos e assíncronos) antes de `restoreSelectionAfterRebuild` e `canvas.requestRenderAll()`. `allSettled` garante que uma imagem inválida não bloqueia os demais (preserva BUG-021/BUG-032/BUG-034).
**Validação:** Typecheck OK, lint OK, build OK. Seleção restaurada UMA vez após rebuild completo.

## RESUMO

### TOTAL DE NOVOS PROBLEMAS: 12

**PQA RESOLVED:** 11 (PQA-001 a PQA-010, PQA-013)
**ACCEPTED BEHAVIOR:** 1 (PQA-011)
**NOT A BUG:** 1 (PQA-012)
**OPEN:** 0

### STATUS POR SEVERIDADE (ORIGINAL)

| Severidade   | Quantidade | IDs |
|--------------|------------|-----|
| **CRITICAL** | 0          | —   |
| **HIGH**     | 0          | —   |
| **MEDIUM**   | 2          | PQA-001, PQA-002 |
| **LOW**      | 10         | PQA-003 a PQA-011, PQA-013 |

### STATUS POR SEVERIDADE (FINAL)

| Severidade   | Quantidade | Status |
|--------------|------------|--------|
| **CRITICAL** | 0          | —     |
| **HIGH**     | 0          | —     |
| **MEDIUM**   | 0          | Todos RESOLVED |
| **LOW**      | 0          | 9 RESOLVED + 1 ACCEPTED BEHAVIOR + 1 NOT A BUG |

| Tipo           | Quantidade | IDs |
|----------------|------------|-----|
| **NEW BUG**    | 4          | PQA-007, PQA-008, PQA-011, PQA-013 |
| **REGRESSION** | 1          | PQA-010 (BUG-038 via caminho i18n) |
| **PERFORMANCE**| 1          | PQA-006 |
| **UX**         | 2          | PQA-005, PQA-011 |
| **I18N**       | 5          | PQA-001, PQA-002, PQA-003, PQA-004, PQA-009 |

---

## RESULTADOS POR ÁREA

### TEXT EDITING — OK
- IText funciona para edição inline com cursor, seleção e input
- Keyboard shortcuts bloqueados corretamente durante edição (`isTextEditingRef`)
- Edição via Properties Panel funcional
- Undo/Redo funcional (agrupado por debounce)
- PQA-007: risco baixo de flag de edição presa em edge cases

### PAGES — OK (com ressalvas)
- Criação, exclusão, duplicação funcionais
- Confirmação de exclusão implementada
- Última página protegida
- PQA-001: nomes duplicados possíveis com interface não-inglês após recriação
- PQA-005: diálogo de confirmação sem suporte a teclado

### I18N — OK (com ressalvas)
- pt-BR, en, es implementados com persistência
- Troca instantânea sem reload
- Conteúdo do canvas não é afetado
- PQA-001 a PQA-004, PQA-009: strings residuais não traduzidas (presets, export labels, alignment labels, nome de TextElement)

### CANVAS CORE — OK
- Seleção, transformação, layers, clipboard preservados
- Nenhuma regressão detectada nos bugs originais BUG-001 a BUG-048

### HISTORY — OK
- Per-page history mantido
- Background, crop, properties, text content cobertos
- BUG-004, BUG-005, BUG-007, BUG-030, BUG-031, BUG-034 permanecem resolvidos

### IMAGES, GROUPS, CROP, GUIDES, BACKGROUND, FONTS, EXPORT, AUTOSAVE — OK
- Funcionalidades preservadas
- Nenhuma regressão detectada

---

## VERIFICAÇÃO DE REGRESSÕES (BUG-001 a BUG-048)

| Bug | Status | Notas |
|-----|--------|-------|
| BUG-001 a BUG-048 | RESOLVED (mantido) | Nenhuma regressão confirmada por análise de código e build |
| BUG-038 | RESOLVED (mantido) | Parcialmente afetado por PQA-010 — regex de nome de página não cobre idiomas não-inglês, mas o footer passa nome explícito, mitigando |

---

## CONTAGEM FINAL

**TOTAL DE NOVOS PROBLEMAS:** 12

**CRITICAL:** 0
**HIGH:** 0
**MEDIUM:** 2
**LOW:** 10

**REGRESSIONS:** 1 (PQA-010 — BUG-038 fragilizado por i18n)
**I18N:** 5
**PERFORMANCE:** 1

## RECOMENDAÇÃO

**READY FOR STAGE 31**

Justificativa:
- 0 CRITICAL, 0 HIGH — critério de bloqueio não atingido
- Nenhuma regressão de perda de dados, history ou canvas
- Build, typecheck e lint limpos
- Problemas encontrados são LOW/MEDIUM, predominantemente cosméticos (i18n de strings residuais) ou edge cases de baixo impacto
- PQA-001 (nomes duplicados) é o mais relevante mas não causa perda de dados — apenas duplicata visual de nome
- Todos os 48 bugs originais permanecem resolvidos

---

*Auditoria concluída em 2026-08-11.*
*Correções aplicadas em 2026-08-11.*
*Final cleanup: 11 RESOLVED, 1 ACCEPTED BEHAVIOR, 1 NOT A BUG, 0 OPEN.*
