# DEVELOPMENT_STATE.md

## Estado atual

**ETAPA 01 — Project Setup** — CONCLUIDA
**ETAPA 02 — Canvas Engine** — CONCLUIDA
**ETAPA 03 — Modelo de Dados dos Elementos** — CONCLUIDA
**ETAPA 04 — Seleção** — CONCLUIDA
**ETAPA 05 — Move, Resize e Rotate** — CONCLUIDA
**ETAPA 06 — Upload e Inserção de Imagens** — CONCLUIDA
**ETAPA 07 — Text Elements** — CONCLUIDA
**ETAPA 08 — Properties Panel** — CONCLUIDA
**ETAPA 09 — Layers Panel** — CONCLUIDA
**ETAPA 10 — Layer Reordering** — CONCLUIDA
**ETAPA 11 — Visibility e Lock** — CONCLUIDA
**ETAPA 12 — Duplicate e Delete** — CONCLUIDA
**ETAPA 13 — Clipboard** — CONCLUIDA
**ETAPA 14 — History / Undo / Redo** — CONCLUIDA
**ETAPA 15 — Keyboard Shortcuts** — CONCLUIDA
**ETAPA 16 — Zoom** — CONCLUIDA
**ETAPA 17 — Canvas Guides** — CONCLUIDA
**ETAPA 18 — Object Snapping** — CONCLUIDA
**ETAPA 19 — Shapes** — CONCLUIDA
**ETAPA 20 — Multi-select / Group / Ungroup** — CONCLUIDA
**ETAPA 21 — Image Crop** — CONCLUIDA
**ETAPA 22 — Image Filters** — CONCLUIDA
**ETAPA 23 — Font System** — CONCLUIDA
**ETAPA 24 — Background** — CONCLUIDA
**ETAPA 25 — Multiple Pages** — CONCLUIDA
**ETAPA 26 — Format Presets** — CONCLUIDA
**ETAPA 27 — Local Persistence** — CONCLUIDA
**ETAPA 28 — Autosave** — CONCLUIDA
**ETAPA 29 — Export** — CONCLUIDA
**ETAPA 30 — UI/UX Polish** — CONCLUIDA

**ETAPA 32 — OCR Provider** — CONCLUIDA
**ETAPA 33 — OCR → Editable Text Layers** — CONCLUIDA
**ETAPA 34 — Text Masks** — CONCLUIDA
**ETAPA 35 — Text Inpainting** — PROVIDER AUDIT COMPLETED — ADVANCED PROVIDER DEFERRED
**ETAPA 36 — Editable Text Pipeline** — IMPLEMENTED + DEPLOYED + MANUALLY VALIDATED
**ETAPA 36.3 — Clone Relationship Integrity** — CONCLUIDA
**ETAPA 36.4 — OCR Text Style Estimation** — CONCLUIDA
**CHECKPOINT 36.5 — Preserve Original Text Until Edit** — IMPLEMENTED + DEPLOYED — AWAITING USER VALIDATION
**ETAPA 37 — Segmentation Provider** — PROVIDER ABSTRACTION COMPLETED — REAL PROVIDER DEFERRED

**Próxima etapa:** ETAPA 38 — Magic Select
**Última atualização:** 2026-08-13

### ETAPA 33 — OCR → Editable Text Layers

**Status:** CONCLUIDA

**Fluxo:** ImageElement → blob → POST /api/ai/ocr → OCRResult → convertDetectedTextsToTextElements → TextElement[] → store (batch) + Fabric IText

**Application layer:** `src/editor/ocr/ocr-to-elements.ts` (conversão pura + mapping de coordenadas) e `src/editor/ocr/ocr-flow.ts` (HTTP + safety)

**Coordenadas:** natural-image → canvas com scale, offset, rotation, flip e crop offset. Font size derivado da altura do bounding box (aproximado).

**Batch History:** uma ação lógica — Undo remove todos os textos, Redo restaura todos.

**Page/Image safety:** registra sourcePageId/sourceImageId; aborta se imagem/página removida.

**UI:** botão "Detectar texto" na aba IA (i18n pt-BR/en/es), disabled sem 1 imagem selecionada, loading/erro/sucesso.

**naturalWidth/naturalHeight:** adicionados ao ImageElement (persistidos) para mapeamento correto.

### ETAPA 34 — Text Masks

**Status:** COMPLETED + MANUALLY VALIDATED IN PRODUCTION

**Checkpoints:** 34.1 (z-order fix) COMPLETED · 34.2 (OCR text hit-test fix) COMPLETED · 34.3 (finalização + commit) COMPLETED. Validação manual em produção: PASS (usuário selecionou/interagiu com uma OCR text layer com bounding box + controles Fabric).

**Implementation:** `src/editor/masks/` (`text-mask.ts` constrói máscaras; `inpaint.ts` inpainting determinístico; `mask-restore.ts` restaura ao deletar layer). Integração em `ocr-flow.ts`, `canvas-area.tsx` (efeito OCR), `use-keyboard-shortcuts.ts` (delete). Checkpoint 34.1/34.2: o efeito OCR adiciona as text layers **diretamente** (sem rebuild) e atualiza o src da imagem via `setSrc` — rebuild causava regressão de hit-testing/stacking (text layers atrás da imagem).

**Mask strategy:** polygon-first (PP-OCRv5 real polygon) com fallback para bounding box; padding conservador configurável (`DEFAULT_MASK_PADDING=3`); confidence filter (`DEFAULT_MIN_CONFIDENCE=0.6` — OCR ruim não é mascarado).

**Inpainting:** preenchimento determinístico local (média ponderada por distância inversa dos pixels vizinhos em 8 direções). Sem API paga/modelo generativo. Original preservado em `originalSrc` (nunca destruído).

**Polygon support:** sim — polígono real (inclui texto rotacionado/inclinado); bbox apenas como fallback.

**Undo/redo:** via snapshots de histórico existentes (máscaras + src + originalSrc fazem parte do elemento). Move/edit/rotate da layer NÃO move a máscara (máscara em coordenadas naturais da imagem).

**Save/load:** máscaras serializadas como JSON; `src`/`originalSrc` convertidos para data URL (`project-serializer.ts`).

**Export:** usa o `src` mascarado (canvas.toDataURL) — texto original não reaparece.

**Delete policy:** deletar layer OCR → desabilita a máscara vinculada e recomputa a imagem a partir do original (reversível).

**Tests:** 26 testes unitários (Vitest) — `src/editor/masks/text-mask.test.ts` + `inpaint.test.ts` + `ocr-to-elements.test.ts` — cobrem polygon-first, bbox fallback, padding, confidence filter, linkage, múltiplos textos, texto rotacionado, fundo sólido/escuro/gradiente, layers acima da imagem (invariante de z-order). `npm test` = 26/26 PASS; `tsc` PASS; `eslint` PASS; `next build` PASS.

**Known limitations (fidelidade visual — não bloqueiam a funcionalidade base):**
1. Inpainting determinístico simples (média dos vizinhos); fundos complexos podem apresentar artefatos.
2. Fonte da OCR text layer pode não corresponder à original.
3. Cor pode não corresponder à original (default `#000000`).
4. Font weight/style pode não corresponder.
5. Tamanho pode precisar de refinamento (aproximação por altura do bbox).
6. Posicionamento/alinhamento pode precisar de refinamento.
7. OCR pode gerar ruído/leituras incorretas (threshold de confidence = 0.6 mitiga).
8. Textos pequenos podem ficar sobrepostos.
9. Duplicar página/imagem não preserva o vínculo mask↔layer (`textLayerId`).
10. Delete→restore possui caso-limite assíncrono (~1-2s de recomputação).
11. Sem UI completa para gerenciamento das masks (toggle ON/OFF).
12. Criativo complexo (fotografia) ainda gera inpainting imperfeito — será tratado na ETAPA 35.

### ETAPA 35 — Text Inpainting

**Status:** PROVIDER AUDIT COMPLETED — ADVANCED PROVIDER DEFERRED

**Decisão (CHECKPOINT 35.1):** manter o inpainting determinístico atual. Auditoria de providers concluída; nenhum provider avançado foi adotado.

**Current production strategy:** deterministic local inpainting (ETAPA 34).

**Provider audit (concluído):**
- **OpenCV (TELEA/NS):** NOT ADOPTED — sem vantagem clara de qualidade; ganho apenas marginal e não venceu consistentemente o algoritmo atual.
- **LaMa/ONNX:** DEFERRED — melhoria significativa, mas requisitos de recursos excessivos para a infraestrutura atual.
- **Paid API/GPU:** DEFERRED — não adotada neste momento.

**Functional status:**
- functional text inpainting: AVAILABLE (determinístico).
- advanced photographic-quality inpainting: DEFERRED.

**Future upgrade (documentado, NÃO implementado):** a abstração `InpaintingProvider` permanece preparada para permitir upgrade futuro sem reescrever o editor:

```
InpaintingProvider
├── deterministic
├── LaMa/ONNX
└── hosted provider
```

Poderá futuramente virar recurso **Standard** (deterministic) vs **Premium** (AI high-quality inpainting) — sem implementação de planos/pagamentos agora.

**Known limitations (aceitáveis no estágio atual):** fotografias complexas, texturas detalhadas, elementos gráficos atravessando texto e regiões com muitos detalhes podem apresentar reconstrução imperfeita.

**Não alterado nesta execução (separado do inpainting):** font family, font color, font weight, font size, alignment, positioning e OCR noise (text layers).

**Sem alteração funcional:** algoritmo determinístico, container OCR e dependências permanecem inalterados.

### ETAPA 36 — Editable Text Pipeline

**Status:** IMPLEMENTED + DEPLOYED — AWAITING USER MANUAL VALIDATION

**Objetivo:** unificar OCR → confidence/filtering → mask → inpainting → TextElement em um pipeline transacional, previsível e resiliente, sem reinventar as peças da ETAPA 33/34 (organização, não reescrita).

**Centralização:** `src/editor/pipeline/editable-text-pipeline.ts` — orquestrador puro (sem React/Fabric/Zustand):
- `classifyDetections` — particiona detecções em accepted/rejected com motivo (`emptyText`, `lowConfidence`, `invalidGeometry`);
- `buildEditableTextElementsAndMasks` — reutiliza `convertDetectedTextsToTextElements` (ETAPA 33) e `buildTextMasks` (ETAPA 34); preserva polygon-first → bbox fallback → padding e o vínculo `textLayerId`↔`sourceImageId`;
- `processOcrResult` — roda os estágios e produz `EditableTextPipelineResult` (elements, masks, maskedImageSrc, originalSrc, rejectedDetections, metrics). Inpainting injetável (`config.inpaint`) — default determinístico, preparado para LaMa/ONNX/hosted futuros;
- `isImageAlreadyProcessed` / `isResultStale` — idempotência e stale-result gate.

**Estágios formais:** VALIDATE INPUT → OCR NORMALIZATION → CONFIDENCE FILTERING → GEOMETRY VALIDATION → MASK GENERATION → INPAINTING → TEXT ELEMENT GENERATION → STATE COMMIT → FABRIC SYNC → HISTORY SNAPSHOT.

**Atomic state commit:** novo `commitEditableTextResult` no store — imagem (src mascarado + originalSrc + textMasks) e text layers são commitadas em **um único** `set()` (sem estado parcial). Falha fatal antes do commit (inpainting) lança `inpaintingFailed` e não muta nada.

**Fluxo:** `left-sidebar` → `triggerOcrDetect` → `canvas-area` (efeito) → `fetchOcrResult` (HTTP + safety + idempotência) → `processOcrResult` (pipeline) → `isResultStale` re-check → `pushHistoryImmediate` (1 operação lógica) → `commitEditableTextResult` → `FabricImage.setSrc` + `canvas.add(IText)` (sem rebuild, preservando z-order/hit-testing da ETAPA 34).

**Error model (unificado, sanitizado, i18n pt-BR/en/es):** `noTextDetected`, `allDetectionsFiltered`, `inpaintingFailed`, `alreadyProcessed`, `staleResult` + os existentes da ETAPA 33 (`requiresSingleImage`, `imageFetchFailed`, `httpError`, `serviceUnavailable`, `pageRemoved`, `imageRemoved`). Nenhum secret/token/stack exposto.

**Idempotência (FASE 19):** opção A — bloquear. Imagem já processada (possui `originalSrc`) → `alreadyProcessed`. Dupla execução também bloqueada pelo guard `ocrStatus === 'loading'` no store.

**Stale/delete/page-change (FASE 20–22):** resultado descartado com segurança se a página/imagem não existirem mais; commit direcionado à página de origem (`commitEditableTextResult(pageId, ...)`) não contamina outra página ativa.

**Confidence/geometry:** mantém `DEFAULT_MIN_CONFIDENCE=0.6` (sem hardcode duplicado). Detecção abaixo do threshold NÃO gera mask/apaga texto/nem TextElement. Geometria inválida (bbox não-finito/≤0) rejeita somente aquela região, nunca o pipeline.

**Tests:** 19 novos (Vitest) em `src/editor/pipeline/editable-text-pipeline.test.ts` — happy path, confidence filter, geometry (polygon inválido + bbox válido; ambos inválidos), partial invalids, all filtered, mask creation, text layer creation, integração de inpainting (injetável), atomic commit (ativo e página-trocada), fatal failure antes do commit, stale result, deleted source, idempotência, múltiplos textos, mask↔layer linking. `npm test` = 45/45 PASS (26 anteriores + 19 novos); `tsc` PASS; `eslint` PASS; `next build` PASS.

**NÃO implementado nesta etapa (limitações conhecidas, fora do escopo do pipeline):** font matching/recognition, color/font-weight/italic/letter-spacing extraction, text effects, advanced alignment — continuam como limitações da ETAPA 33/34.

### CHECKPOINT 36.1 — Deploy For Manual Validation

**Status:** DEPLOYED — AWAITING USER MANUAL UI VALIDATION

**Commit (funcional):** `4b7452b` — feat: complete stage 36 editable text pipeline

**Production:** https://editor-fotos-jet.vercel.app (deploy automático via push, READY)

**Build:** tsc PASS, eslint PASS, vitest 45/45 PASS, next build PASS

**Health:** `GET /api/ai/ocr` → `{ configured: true, provider: "paddleocr" }` (HTTP 200). OCR end-to-end (Vercel → Oracle) HTTP 200 com detecções. Afiliados HTTP 200.

**Segurança:** sem secrets/tokens/credentials no diff; sem arquivos temporários ou criativos de teste commitados.

**Manual UI validation:** pendente (checklist do usuário: importar criativo → Detectar texto → mover/editar CONFIRA → Undo/Redo → salvar/recarregar).

### CHECKPOINT 36.2D — Position-Dependent Image Click Fix

**Status:** ROOT CAUSE CONFIRMED + FIXED

**Root cause:** `normalizeFabricObject` (`src/editor/core/element-factory.ts`) aplicava `width = width * scaleX; height = height * scaleY; scaleX = scaleY = 1` também em `FabricImage`. Para FabricImage, `width`/`height` são dimensões SOURCE/CROP do raster (não de exibição), então o bake de scale CROPPAVA o raster mantendo o mesmo bounding box. Um "clique" com jitter de 1–2px era interpretado como transform (move/resize) → `object:modified` → crop. Por isso o bug era dependente da coordenada do clique.

**Fix:** `if (fabricObject instanceof FabricImage) return;` — FabricImage não passa mais por essa normalização (preserva source width/height + scaleX/scaleY + cropX/cropY).

**Teste:** Playwright multi-position (`e2e/image-geometry.spec.ts`) — comprovadamente falha sem o fix e passa com o fix.

### CHECKPOINT 36.2E — FabricImage Fix Deploy

**Status:** DEPLOYED

**Commit:** `fad4815` — fix: preserve FabricImage source dimensions on transform

**Production:** https://editor-fotos-jet.vercel.app (vercel --prod explícito, READY, ETag renovado)

### CHECKPOINT 36.2F — Image Geometry Fix Finalized

**Status:** MANUAL PRODUCTION VALIDATION PASS

**Production commit:** `fad4815`

**Resultados confirmados em produção:**
- repeated click stability: PASS
- FabricImage source dimensions preserved: PASS
- move: PASS
- resize: PASS
- rotation: PASS
- crop: PASS
- raster corruption: FIXED

### ETAPA 36.3 — Clone Relationship Integrity

**Status:** CONCLUIDA

**Problema:** `deepCloneElementWithNewIds` remapeava `mask.sourceImageId` mas não `mask.textLayerId` — duplicar página/imagem OCR criava referências cruzadas para elementos originais.

**Fix:** `cloneElementsWithNewIds(elements)` em `src/utils/index.ts` — constrói um mapa `oldId → newId` completo (incluindo filhos de grupos) e remapeia `sourceImageId` + `textLayerId`. `deepCloneElementWithNewIds` virou wrapper (`cloneElementsWithNewIds([el])[0]`), então duplicar uma imagem isolada **limpa** o `textLayerId` (`''`) em vez de criar referência pendente (estratégia B). `duplicatePage` agora usa `cloneElementsWithNewIds`.

**Delete isolation:** deletar text-B na página duplicada afeta somente mask-B; a página original (image-A/mask-A/text-A) permanece intacta.

**Tests:** 6 novos (`src/utils/clone.test.ts`) — regeneração de IDs, remap de sourceImageId/textLayerId, ausência de referências à página original, texto duplicado isolado, página original intacta, grupos.

### ETAPA 36.4 — OCR Text Style Estimation

**Status:** CONCLUIDA (estimação de COR — prioridade 1)

**Arquitetura:** `src/editor/ocr/text-style.ts` — `estimateTextColor(imageData, bbox)` pura (determinística, DOM-free) + `estimateTextStyles(src, detections)` async. Integrada ao pipeline via `config.estimateStyles` (default = local); falha nunca derruba o pipeline (fallback).

**Estratégia de cor:** estima background pelo anel de borda do bbox (histograma quantizado), detecta pixels internos com contraste (>100) contra o background (glyph), retorna a cor dominante dos glyphs com confidence (dominância × cobertura). `MIN_COLOR_CONFIDENCE = 0.6`; abaixo disso → `DEFAULT_TEXT_COLOR = '#000000'`.

**Fallback conservador:** sem contraste/cluster → cor default (nunca cor absurda).

**Font size:** mantida a aproximação existente (`deriveFontSize`). **Position:** preservada (`mapImageRectToCanvas`). **Alignment:** mantém fallback ('left'). **Font family:** não implementado (fora do escopo).

**Tests:** 8 novos (`src/editor/ocr/text-style.test.ts`) — white-on-black, black-on-white, yellow-on-blue, red-on-white, blue-on-white, gradient, low-confidence fallback, região degenerada.

### PARTE 4 — Advanced Inpainting (DEFERRED)

LaMa, ONNX LaMa, GPU e paid hosted inpainting API: **DEFERRED**. Motivo: custo, latência, RAM, complexidade, infraestrutura. Inpainting atual: **DETERMINISTIC**. A abstração `InpaintingProvider` permanece preparada para provider futuro.

### PARTE 5 — Detection Review UI (DEFERRED TO ETAPA 45)

Pré-visualização/revisão dos elementos detectados (textos, logos, pessoas, produtos, botões, objetos) antes de desmontar o criativo: **DEFERRED TO ETAPA 45 — Desmontar Criativo**.

### CHECKPOINT D — Final Editable Text Pipeline Validation

**Status:** PASSED — DECISION A (EDITABLE TEXT PIPELINE STABLE)

**Validado (automático):** tsc, eslint, vitest (75/75), playwright (1/1), next build — todos PASS.

**Regressões verificadas:** FabricImage raster corruption (FIXED), z-order bug (preservado), OCR hit-test bug (preservado), workspace scale bug (FIXED), clone relationship (FIXED).

**Criativos reais:** validação manual multi-criativo do usuário (sólido, gradiente, fotografia, múltiplas cores, textos pequenos/grandes, página duplicada) — pendente de execução manual em produção após deploy.

### ETAPA 37 — Segmentation Provider

**Status:** PROVIDER ABSTRACTION COMPLETED — REAL PROVIDER DEFERRED

**Auditoria:** os tipos (`src/ai/types/segmentation.ts`) e a interface (`src/ai/providers/segmentation-provider.ts`) já existiam desde a ETAPA 31. O editor conhece apenas `SegmentationProvider` (sem dependência de SAM/SAM2/ONNX/Replicate/Roboflow).

**Provider evaluation (decisão):**
- SAM/SAM2: modelo pesado (ViT-H ~2.4GB), exige GPU/alta RAM — **não compatível** com Oracle A1 (aarch64, RAM limitada que também hospeda OCR + Afiliados).
- MobileSAM: leve (~40MB), CPU viável — **candidato** para etapa futura, mas não instalado agora.
- FastSAM: leve, qualidade inferior para objetos pequenos.
- Hosted API (Replicate/Roboflow): custo recorrente + latência — **deferido** (mesma decisão do inpainting).

**Decisão:** NÃO instalar modelo pesado no Oracle agora (risco de OOM afetaria OCR/Afiliados). Interface pronta e testada; implementação real fica para decisão posterior.

**Contract tests:** `src/ai/providers/segmentation-provider.test.ts` (5 testes) + `FakeSegmentationProvider` (`src/ai/providers/fake-segmentation-provider.ts`, exportado em `src/ai/index.ts`) — request/result/mask geometry/confidence/errors/provider failure/cancellation.

### CHECKPOINT 36.5 — Preserve Original Text Until Edit

**Status:** IMPLEMENTED + DEPLOYED — AWAITING USER VALIDATION

**Princípio:** "Detectar texto" NÃO altera a arte. OCR → armazena regiões detectadas (`DetectedTextRegion`) → overlay visual não destrutivo. Somente "Editar texto" (ou "Converter todos") aplica mask + inpainting + TextElement.

**Data model:** `DetectedTextRegion` (id, sourceImageId, text, confidence, polygon, boundingBox, styleEstimate, status `detected|converted|rejected`) + `ImageElement.detectedTexts`.

**Pipeline split (`editable-text-pipeline.ts`):** `processDetections` (detecção: classify + geometry + style, sem mask/inpaint/TextElement) e `convertDetectedRegions` (converte um subconjunto com `existingMasks` cumulativo). `processOcrResult` mantido como wrapper (detect + convert all — backward compat).

**Store:** `storeDetections`, `commitRegionConversion`, `triggerConvertRegion`, `triggerConvertAll`, `selectedDetectedRegionId`.

**UI:** overlay bounding boxes (Fabric Rect não destrutivo, `excludeFromExport`), clique seleciona região; AI panel mostra "N textos detectados", "Converter todos", e (com região selecionada) "Editar texto" / "Ignorar" + confiança. i18n pt-BR/en/es.

**History:** detecção é leve (não-destrutiva); conversão é UMA ação lógica (pushHistoryImmediate antes do commit) — Undo restaura raster+região detectada, Redo reaplica.

**Save/load/duplicate:** `detectedTexts` serializados; `cloneElementsWithNewIds` remapeia ids das regiões na duplicação de página.

**Export:** regiões `detected` não alteram export; regiões `converted` exportam background inpainted + TextElement (via `src` atualizado).

**Tests:** 9 novos (`detection.test.ts` + clone remap) + Playwright `ocr-detection.spec.ts` (mock OCR → raster unchanged). Total Vitest 84/84, Playwright 2/2.

### CHECKPOINT 36.5A — Detected Text Click Crash Fix

**Status:** FIXED + DEPLOYED — AWAITING USER VALIDATION

**Bug:** clicar em uma região detectada causava crash do renderer ("This page couldn't load").

**Root cause:** o selector `selectedRegionInfo` (`left-sidebar.tsx`) retornava um objeto novo `{ imageId, region }` a cada chamada. O `useStore` do Zustand (via `useSyncExternalStore`) compara com `Object.is` → sempre `false` → loop infinito de re-render → "Maximum update depth exceeded".

**Fix:** o selector agora retorna a própria `region` (referência estável) em vez de um wrapper novo; `imageId` é derivado nos handlers.

**Test:** Playwright `ocr-detection.spec.ts` — clicar overlay não crasha (`pageerror` coletado), "Editar texto" visível.

### CHECKPOINT 36.5C — Preserve Visual Until First Edit

**Status:** IMPLEMENTED + DEPLOYED — AWAITING USER VALIDATION

**Objetivo:** "Editar texto" NÃO converte imediatamente. A região entra em `armed` (IText transitório `opacity: 0` sobre o raster original intacto) e só converte na **primeira modificação real** (digitar/Backspace/paste/mover/redimensionar/rotacionar). Cancelar sem modificação (Escape/clique fora) reverte para `detected`.

**Status:** `DetectedTextRegion.status` agora inclui `armed`. `convertArmedRegion` (pipeline) preserva o estado da IText modificada e liga a mask ao id do elemento. `commitRegionConversion` reutilizado. `project-serializer` normaliza `armed` → `detected` no save.

**Eventos Fabric:** `canvas.on('text:changed')` (primeira tecla) e `canvas.on('object:modified')` (move/resize/rotate) disparam a conversão; `itext.on('editing:exited')` sem modificação cancela.

**Tests:** `convertArmedRegion` (Vitest) + Playwright "Editar texto preserva o raster até a primeira edição" (raster idêntico no arm; converte após digitar). Total Vitest 85/85, Playwright 4/4.

### CHECKPOINT 36.5D — Text List + Lazy Edit UX

**Status:** IMPLEMENTED + DEPLOYED — AWAITING USER VALIDATION

**UX:** o painel esquerdo mostra uma **lista scrollável de todos os textos detectados** (texto + confiança + estado). Click seleciona a região (sincroniza com o overlay); double-click ou "Editar texto" entra em modo `armed`. O painel direito mostra as **propriedades normais de texto** da IText transitória (`armedElement` no store). Apenas ALTERAR um valor (conteúdo/cor/tamanho/fonte/mover/redimensionar/rotacionar) converte. Cancelar sem modificação (blur/Escape ou trocar de item) reverte para `detected`.

**Arquitetura:** `armedElement: TextElement | null` + `armedRegionId` no store (elemento transitório FORA de `elements` para não disparar o reorder de z-order). `updateArmedElement` (edições do painel) e `syncItextToArmedElement` (digitação/move no canvas) mantêm o estado; o JSON watcher detecta a primeira mutação → `convertArmedElement` → `convertArmedRegion` + `commitArmedConversion` (adiciona o elemento, marca região `converted` + `textLayerId`).

**Estados:** `DetectedTextRegion.status` = `detected | armed | converted | rejected`. `textLayerId` na região liga item convertido → TextElement real (FASE 20). `cloneElementsWithNewIds` remapeia `textLayerId` na duplicação. `project-serializer` normaliza `armed` → `detected` no save.

**Tests:** Vitest 86/86, Playwright 4/4 (raster unchanged no detect; overlay click sem crash; Editar texto preserva raster até a primeira edição).

### CHECKPOINT 33.1 — Production Validation

**Status:** DEPLOYED — AWAITING MANUAL UI VALIDATION

**Commit:** d2dce9d — feat: ETAPA 33 — OCR to editable text layers

**Production:** https://editor-fotos-jet.vercel.app (match local HEAD: YES)

**Build:** tsc PASS, eslint PASS, next build PASS

**OCR backend:** GET /api/ai/ocr → `{ configured: true, provider: "paddleocr" }`

**Live OCR (Vercel → Render):** HTTP 200, 3 textos com acentos (PROMOÇÃO / ATÉ / COMPRE AGORA), ~64s (cold start)

**Manual UI validation:** pendente (checklist A–P registrado no relatório do checkpoint)

### CHECKPOINT 33.2 — OCR UI Production Fix

**Status:** FIXED — AWAITING USER MANUAL RETEST

**Bug:** "Detectar texto" falhava em produção com "Falha ao detectar texto. Tente novamente."

**Root cause:** Render Free OOM — após a 1ª chamada OCR o container sofre OOM (pool de memória do Paddle retém memória; o `try_shrink_memory` do 32.5 não alcança o predictor real). Chamadas seguintes retornam 502 até o Render reiniciar. Fluxo da UI (asset → blob → FormData → POST) está correto.

**Fix:** retry no client (`ocr-flow.ts`) para 502/504/429 transitórios (3 tentativas, 8s de intervalo) + mensagem "serviço temporariamente indisponível".

**Commit:** 071a24d

**Backend:** GET/POST OCR continuam PASS em produção.

### CHECKPOINT 33.3 — Production OCR Availability Fix

**Status:** DIAGNOSED — RENDER FREE UNSTABLE WITH REAL CREATIVE

**Bug:** "Detectar texto" em criativo complexo retorna "Serviço temporariamente indisponível" (retry esgota).

**Root cause:** OOM no Render Free. Baseline de memória do serviço PaddleOCR = **431 MB** (Python + paddle + paddlex + modelos PP-OCRv5) após o load, sobrando ~81 MB dos 512 MB. Imagem simples (3 textos) usa ~61 MB → cabe (~492 MB). Criativo complexo (21+ textos) usa >100 MB → OOM → container reinicia → 502.

**Evidência:** `/health` retorna `memory_mb: 431` (baseline); após OCR simples sobe para `492.5`. POST de imagem complexa → 502 e `/health` passa a retornar página 502 (container reiniciou).

**Tentativas sem efeito:** `text_recognition_batch_size=1`, `MAX_DIMENSION 640→512`, `FLAGS_allocator_strategy=naive_best_fit`, `try_shrink_memory` (não alcança o predictor real).

**Direção futura (não aplicada):** reduzir baseline (engine `onnxruntime` em vez de `paddle_static`), plano pago do Render, ou host alternativo com mais RAM.

### CHECKPOINT 33.4 — ONNX Runtime ARM64 Feasibility

**Status:** CONCLUIDO — DECISION: A — ONNX ARM64 APPROVED

**Prova:** Oracle Ampere A1 (aarch64) executa PP-OCRv5 via ONNX Runtime 1.28.0 (CPUExecutionProvider) sem PaddlePaddle. PP-OCRv5 mobile det + latin rec (ONNX, opset 14). Acentos 100%, bounding boxes válidos, criativo 1254×1254 (29 regiões), 5 OCRs sequenciais estáveis (~682–731 MB), sem SIGSEGV/OOM/restart. Protótipo em `/opt/editor-fotos-ocr-onnx/` (container `editor-fotos-ocr-onnx`, `--cpus=1.0 --memory=3g`).

### CHECKPOINT 33.5 — Oracle ONNX Production Readiness

**Status:** CONCLUIDO — DECISION: D — NETWORK/HTTPS/AUTH BLOCKER

**Validado (PASS):** baseline saudável (Afiliados HTTP 200, PM2/PostgreSQL/Nginx ativos); auth no Oracle (`/health` público, `/ocr` 401 sem/inválido token, 200 com token — token em `.env` chmod 600); qualidade OCR equivalente/melhor (acentos 100%: Ã Ç É Á Ô Ú ç ã é à; números/moeda/email/telefone corretos; divergência "50% OFF" é isolada — segmentação de detecção, não reconhecimento); 10 OCRs sequenciais estáveis (~566 MB, sem OOM/restart, Afiliados 200); memória estável (~518 MB após 5 min idle, sem leak).

**Blockers (migração NÃO executada):**
1. **HTTPS/DNS:** sem acesso a DNS para criar subdomínio (`ocr.companykn.com` → VM). `companykn.com` atrás do Cloudflare (sem credenciais). Nginx do Afiliados (`report.companykn.com`) não pode ser alterado. Sem caminho para certificado HTTPS para IP público. Alternativas (Cloudflare Tunnel) exigem credenciais não disponíveis.
2. **Token:** `OCR_SERVICE_TOKEN` é write-only no Vercel (tipo sensitive/encrypted — `vercel env pull` retorna vazio). Não recuperável para reutilizar no Oracle nem para rollback seguro.

**Produção:** Render `https://editor-fotos-paddle-ocr.onrender.com` mantido como fallback (OCR_PROVIDER=paddleocr, inalterado). Vercel inalterado.

**Próximo passo (não executado):** para migrar, é necessário (a) DNS/Cloudflare para endpoint HTTPS dedicado do Oracle, e (b) token recuperável/novo token coordenado entre Vercel e Oracle com rollback documentado.

### CHECKPOINT 33.6A/B/C — Tailscale Funnel + Oracle Cutover

**Status:** CONCLUIDO — DECISION: A — ORACLE OCR CUTOVER COMPLETE

**33.6A:** Tailscale 1.102.2 instalado na Oracle (aarch64), máquina autenticada na tailnet `tail32082e.ts.net`.

**33.6B:** Tailscale Funnel ativado — HTTPS público `https://vnic-afiliado.tail32082e.ts.net` → `127.0.0.1:18080` (TLS válido, `--bg` persistente). Porta 18080 permaneceu `127.0.0.1` (não exposta publicamente); Nginx/DNS/SSL do Afiliados intocados.

**33.6C:** Blocker de token/rollback (token antigo write-only + sem acesso Render). Resolvido via token compartilhado: **33.6C.1** gerou novo token (256 bits, criptograficamente seguro); **33.6C.2** sincronizou o mesmo token em Render + Oracle (rollback por troca de URL tornou-se possível).

**33.6C.3 — Cutover:** Vercel Production → Oracle. `OCR_SERVICE_URL=https://vnic-afiliado.tail32082e.ts.net`, `OCR_SERVICE_TOKEN`=token compartilhado, `OCR_PROVIDER=paddleocr` (inalterado, rótulo de proxy HTTP genérico). Redeploy Production `editor-fotos-jet.vercel.app`.

**Validação end-to-end (Vercel → Oracle):** GET config `{configured:true, provider:"paddleocr"}`; OCR simples 200 (~3s, acentos Ç/Ã/É); criativo real 200 (~5.7s, 29 regiões, acentos preservados). Sem OOM/SIGSEGV/restart. Afiliados HTTP 200 antes/durante/depois.

**Render:** mantido como fallback (mesmo token compartilhado; rollback = trocar apenas `OCR_SERVICE_URL`).

### CHECKPOINT 32.5 — PaddleOCR Quality + Memory Optimization

**Status:** CONCLUIDO

**Upgrade:** paddleocr 2.10.0 → 3.4.1 (PP-OCRv5 latin mobile), paddlepaddle 3.1.1 → 3.3.1

**Model:** PP-OCRv5_mobile_det + latin_PP-OCRv5_mobile_rec (14 MB, 84.7% acc)

**Portuguese accuracy:** 100% — "PROMOÇÃO", "ATÉ", "AÇÃO", "PREÇO", "CONDIÇÃO", "VOCÊ" todos corretos

**Memory stability:** 5/5 sequential OCR (HTTP 200). Fixes: MKLDNN off, naive_best_fit allocator, 640px resize, try_shrink_memory.

**Granularity:** LINE (each text = one line)

**Performance:** startup ~8-9s, OCR ~25-29s (0.1 CPU Render Free)

**Render Free verdict:** A — FITS RENDER FREE

**Última etapa oficial:** ETAPA 32
**Próxima etapa:** ETAPA 33 — OCR → Editable Text Layers

### CHECKPOINT 32.6 — PaddleOCR Vercel End-to-End

**Status:** CONCLUIDO

**Vercel config:** OCR_PROVIDER=paddleocr, OCR_SERVICE_URL, OCR_SERVICE_TOKEN (Production, server-side)

**Config check:** GET /api/ai/ocr → `{ configured: true, provider: "paddleocr" }`

**End-to-end:** POST /api/ai/ocr → HTTP 200, 3 detected texts, acentos 100%

**Error mapping:** sem arquivo → 400 INVALID_INPUT, MIME inválido → 415 UNSUPPORTED_INPUT (sanitizado)

**Timeout:** 90s (cold start + OCR)

**Segurança:** token server-side only, sem NEXT_PUBLIC, browser → Vercel → Render

**Deploy mais recente:** CHECKPOINT 32.6 — PaddleOCR Vercel End-to-End — 2026-08-12
**Production URL:** https://editor-fotos-jet.vercel.app
**Commit:** c4f346f — fix: increase PaddleOCR provider timeout to 90s
**Commit:** c43bf80 — feat: add text editing, page deletion, and i18n (pt-BR, en, es)

### QA MVP — Status

**Bugs encontrados:** 48
**Bugs resolvidos:** 48
**Bugs abertos:** 0

**Blocos concluídos:**
- BLOCO 1 — Persistência / Integridade de Dados (10/10)
- BLOCO 2 — History / Undo / Redo (6/6)
- BLOCO 3 — Groups / Pages / Clipboard (5/5)
- BLOCO 4 — Canvas Lifecycle / Background (6/6)
- BLOCO 5 — Element Factory / Shapes / Image Rebuild (6/6)
- BLOCO 6 — Crop / Guides / Performance (4/4)
- BLOCO 7 — Robustez / Polish Final (11/11)

**Arquivos alterados:** 14 arquivos modificados, 1 novo (QA_REPORT_MVP.md)

---

## FASE EXTRAORDINÁRIA — MVP Usability + I18N

### Status: CONCLUIDA

**Data:** 2026-08-11

Esta fase NÃO altera a numeração oficial do ROADMAP.
A próxima etapa oficial continua sendo ETAPA 31.

### Objetivo
Implementar edição real de texto, exclusão de páginas com confirmação e sistema de internacionalização com 3 idiomas.

### Implementado

#### 1. Edição Real de Texto
- Substituído `FabricText` por `IText` (Fabric.js v6), que oferece edição interativa completa
- Duplo clique em texto no canvas entra em modo de edição com cursor, seleção de caracteres e suporte a Backspace/Delete
- Edição de conteúdo de texto pelo painel de propriedades: campo textarea na seção "Text"
- Conteúdo padrão i18n-aware ao adicionar novo texto:
  - pt-BR: "Seu texto"
  - en: "Your text"
  - es: "Tu texto"
- Keyboard shortcuts verificam `isTextEditingRef` para não interferir com edição de texto (Delete, Backspace, Ctrl+C/V/A/X, Arrow keys)
- Canvas escuta eventos `text:editing:entered` / `text:editing:exited` para tracking do estado de edição
- Undo/Redo captura estado via `pushHistoryDebounced` antes de alterações de texto

#### 2. Exclusão de Páginas
- Botão X no hover de cada aba de página (não ativa) abre confirmação
- Diálogo de confirmação: "Excluir esta página?" / "Delete this page?" / "¿Eliminar esta página?"
- Não permite excluir a última página (guard no store `deletePage`)
- Ao excluir página ativa, seleciona automaticamente a primeira página restante
- Canvas é reconstruído após exclusão
- Elementos, dados e background da página são removidos

#### 3. Internacionalização (i18n)
- Arquitetura centralizada em `src/i18n/`
- Contexto React com provider, hook `useTranslation()` e persistência em localStorage
- 3 idiomas: pt-BR (padrão), en, es
- Tradução de toda a UI visível: toolbar, sidebar, properties panel, layers, pages, canvas, context menu, save states, zoom, export, background, crop, filters, font system
- Seletor de idioma discreto na toolbar com ícone de globo
- Troca instantânea de idioma sem reload
- Chaves de tradução semânticas (`editor.toolbar.undo`, `editor.properties.text.content`, etc.)
- Nomes de página padrão i18n-aware para novas páginas
- Conteúdo do usuário (textos no canvas) não é afetado pela troca de idioma
- `aria-label` e `title` attributes traduzidos

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos criados

| Arquivo | Descricao |
|---------|-----------|
| `src/i18n/index.ts` | Barrel export do modulo i18n |
| `src/i18n/i18n-context.tsx` | React context, provider e hook useTranslation com persistencia localStorage |
| `src/i18n/locales/types.ts` | Tipos Translation e Locale |
| `src/i18n/locales/pt-BR.ts` | Traducoes em Portugues do Brasil |
| `src/i18n/locales/en.ts` | Traducoes em English |
| `src/i18n/locales/es.ts` | Traducoes em Espanol |
| `src/components/app-providers.tsx` | Client wrapper para I18nProvider no layout |

### Arquivos alterados

| Arquivo | Alteracoes |
|---------|-----------|
| `src/app/layout.tsx` | Adicionado AppProviders wrapper |
| `src/editor/core/element-factory.ts` | FabricText → IText em createFabricObject e createTextObject |
| `src/hooks/use-canvas.ts` | Eventos text:editing:entered/exited mantidos para IText |
| `src/stores/editor-store.ts` | createPage aceita parametro opcional name |
| `src/components/editor/canvas-area.tsx` | IText em insertText, default text i18n, loading/empty states i18n, context menu i18n |
| `src/components/editor/right-panel.tsx` | i18n em todas as secoes + textarea de conteudo na secao Text |
| `src/components/editor/top-toolbar.tsx` | i18n + seletor de idioma + tooltips traduzidos |
| `src/components/editor/left-sidebar.tsx` | i18n nas tabs e opcoes de shapes, removido triggerShapeAdd desnecessario |
| `src/components/editor/footer-status.tsx` | i18n + confirmacao ao excluir pagina + nomes de pagina i18n |
| `src/components/editor/layers-panel.tsx` | i18n em titulos, botoes, tooltips |

### Observacoes

- `IText` do Fabric.js v6 estende `FabricText` e oferece edicao interativa completa (cursor, selecao, copy/paste nativos)
- O historico undo/redo para conteudo de texto usa `pushHistoryDebounced` (500ms) — edicoes rapidas sao agrupadas em um unico snapshot
- Exclusao de pagina NAO participa do historico Undo global (a arquitetura per-page do history-manager nao suporta operacoes estruturais de pagina)
- O nome padrao de novas paginas respeita o idioma atual, mas garantir unicidade via numeracao (Page 1, Page 2, ...)
- Páginas existentes mantem seus nomes originais ao trocar idioma


---

## ETAPA 31 — AI Provider Architecture

### Status: CONCLUIDA

**Data:** 2026-08-11

### Objetivo
Criar a camada de abstração de IA do editor — totalmente tipada, modular, vendor-agnostic e desacoplada do Fabric.js. Preparar contratos para as ETAPAS 32-45.

### Implementado

#### Arquitetura
- Módulo isolado em `src/ai/` sem dependências de Fabric.js, Zustand ou componentes React
- Camada conceitual: Editor → AI Services → Provider Interface → Vendor Implementation (futura)
- Barrel exports via `@/ai` para consumo externo

#### Tipos Compartilhados (`src/ai/types/common.ts`)
- **BoundingBox** — coordenadas em PIXELS relativas à imagem original (não canvas/viewport)
- **Confidence** — número 0-1 (inclusive) com schema Zod para validação de fronteira
- **ImageInput** — blob | url | base64 (pelo menos um obrigatório), mimeType opcional
- **GeneratedImage** — Blob + mimeType + width/height + metadata opcional
- **AIMetadata** — Record<string, unknown> tipado (nunca `any`)

#### OCR (`src/ai/types/ocr.ts`)
- **DetectedText** — id, text, boundingBox, confidence + campos opcionais: polygon, language, approximateFontSize, approximateColor, approximateAlignment
- **OCRInput** — ImageInput + language hint + regionsOfInterest opcionais
- **OCRResult** — DetectedText[] + metadata

#### Segmentation (`src/ai/types/segmentation.ts`)
- **AIMask** — discriminated union: `{ kind: 'blob', data: Blob, mimeType }` | `{ kind: 'dataUrl', dataUrl: string }`
- **SegmentedObject** — id, boundingBox, mask, confidence, label opcional
- **SegmentationInput** — ImageInput + clickPoint opcional (magic select) + targetLabels opcionais
- **SegmentationResult** — SegmentedObject[] + metadata

#### Inpainting (`src/ai/types/inpainting.ts`)
- **InpaintingInput** — ImageInput + AIMask
- **InpaintingResult** — GeneratedImage + metadata
- Mesmo provider para texto (ETAPA 35) e objetos (ETAPA 40)

#### Background Removal (`src/ai/types/background-removal.ts`)
- **BackgroundRemovalInput** — ImageInput
- **BackgroundRemovalResult** — GeneratedImage + metadata

#### Vision Analysis (`src/ai/types/vision-analysis.ts`)
- **DetectedRegion** — id, boundingBox, label, confidence
- **CreativeComposition** — headlines[], subheadlines[], ctas[], logos[], products[], persons[], prices[], badges[], other[]
- **VisionAnalysisInput** — ImageInput + targetCategories opcionais
- **VisionAnalysisResult** — CreativeComposition + DetectedRegion[] (flat)

#### Error Model (`src/ai/errors/ai-error.ts`)
- **AIProviderError** extends Error com code, provider, retryable, cause, metadata
- **10 error codes**: INVALID_INPUT, UNSUPPORTED_INPUT, AUTHENTICATION, RATE_LIMIT, TIMEOUT, NETWORK, PROVIDER_ERROR, INVALID_RESPONSE, CANCELLED, UNKNOWN
- Nunca expõe secrets, API keys ou raw vendor responses

#### Provider Interfaces
- **OCRProvider** — detectText(input, options?)
- **SegmentationProvider** — segment(input, options?)
- **InpaintingProvider** — inpaint(input, options?)
- **BackgroundRemovalProvider** — removeBackground(input, options?)
- **VisionAnalysisProvider** — analyze(input, options?)
- Todos com: id, name, AbortSignal via options.signal
- Todos retornam Promise e lançam AIProviderError

#### Registry (`src/ai/providers/registry.ts`)
- **AIProviders** — objeto simples com providers opcionais (sem service locator global)
- **createAIProviders(providers)** — factory function

#### Documentação (`src/ai/README.md`)
- Estrutura do módulo, princípios, sistema de coordenadas, confidence, error handling, cancelamento, ownership, exemplo de uso

### Critérios de aceite

| # | Critério | Status |
|---|----------|--------|
| 1 | OCRProvider tipado | OK |
| 2 | SegmentationProvider tipado | OK |
| 3 | InpaintingProvider tipado | OK |
| 4 | BackgroundRemovalProvider tipado | OK |
| 5 | VisionAnalysisProvider tipado | OK |
| 6 | Entradas e saídas tipadas | OK |
| 7 | Sem `any` | OK |
| 8 | Sem dependência de Fabric.js nos contratos | OK |
| 9 | Sem dependência de vendor específico | OK |
| 10 | BoundingBox com sistema de coordenadas definido (pixels, imagem original) | OK |
| 11 | Confidence com escala definida (0-1) | OK |
| 12 | Masks com representação tipada (discriminated union) | OK |
| 13 | Error handling consistente | OK |
| 14 | Cancelamento previsto (AbortSignal) | OK |
| 15 | Providers substituíveis no futuro | OK |
| 16 | Nenhuma API real integrada | OK |
| 17 | Editor atual continua funcionando | OK |
| 18 | Typecheck | OK |
| 19 | Lint | OK |
| 20 | Build | OK |

### Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| `src/ai/index.ts` | Barrel exports |
| `src/ai/README.md` | Documentação do módulo |
| `src/ai/types/common.ts` | BoundingBox, ImageInput, GeneratedImage, Confidence, AIMetadata |
| `src/ai/types/ocr.ts` | DetectedText, OCRInput, OCRResult |
| `src/ai/types/segmentation.ts` | AIMask, SegmentedObject, SegmentationInput, SegmentationResult |
| `src/ai/types/inpainting.ts` | InpaintingInput, InpaintingResult |
| `src/ai/types/background-removal.ts` | BackgroundRemovalInput, BackgroundRemovalResult |
| `src/ai/types/vision-analysis.ts` | DetectedRegion, CreativeComposition, VisionAnalysisInput, VisionAnalysisResult |
| `src/ai/errors/ai-error.ts` | AIProviderError, AIErrorCode |
| `src/ai/providers/ocr-provider.ts` | OCRProvider interface |
| `src/ai/providers/segmentation-provider.ts` | SegmentationProvider interface |
| `src/ai/providers/inpainting-provider.ts` | InpaintingProvider interface |
| `src/ai/providers/background-removal-provider.ts` | BackgroundRemovalProvider interface |
| `src/ai/providers/vision-analysis-provider.ts` | VisionAnalysisProvider interface |
| `src/ai/providers/registry.ts` | AIProviders + createAIProviders |

### Arquivos alterados

**Nenhum.** Módulo totalmente novo e isolado.

### Observações

- Nenhum SDK de vendor instalado (0 dependências novas no package.json)
- Nenhum .env, API key, endpoint real
- Nenhuma UI nova (botões, modais, painéis)
- Editor existente não foi modificado
- Zod usado para validação de fronteira em BoundingBox, ImageInput, GeneratedImage
- AIMask usa discriminated union para suportar múltiplos formatos futuros sem acoplamento
- AIProviders é um value object simples — não um service locator global

---

## ETAPA 32 — OCR Provider

### Status: CONCLUIDA

**Data:** 2026-08-11

### Objetivo
Implementar a primeira integração real de IA: OCR via Google Cloud Vision API, seguindo os contratos definidos na ETAPA 31 (OCRProvider, DetectedText, OCRResult).

### Implementado

#### Provider Escolhido: Google Cloud Vision
- REST API (sem SDK — compatível com Vercel serverless)
- Detecta texto com coordenadas bounding box e polygon
- Multi-idioma: pt, en, es (configurável via `languageHints`)
- Formatos: PNG, JPEG, WEBP

#### Arquitetura

```
Browser / Client
       ↓ POST JSON { image: { base64, url, blob } }
POST /api/ai/ocr
       ↓
GoogleOCRProvider.detectText()
       ↓
Google Cloud Vision REST API
       ↓ POST { requests: [{ image: { content }, features: [TEXT_DETECTION] }] }
Google Response
       ↓
normalizeGoogleOCRResponse()
       ↓
OCRResult { detectedTexts: DetectedText[] }
       ↓
NextResponse.json(result)
```

#### Arquivos de implementação

| Arquivo | Descrição |
|---------|-----------|
| `src/ai/providers/google-ocr-provider.ts` | GoogleOCRProvider implements OCRProvider (REST API) |
| `src/ai/providers/fake-ocr-provider.ts` | FakeOCRProvider — fixture de desenvolvimento (3 textos simulados) |
| `src/ai/normalizers/ocr-normalizer.ts` | normalizeGoogleOCRResponse — converte resposta Google → DetectedText[] |
| `src/app/api/ai/ocr/route.ts` | POST /api/ai/ocr — endpoint server-side com validação e error mapping |

#### GoogleOCRProvider

- **id:** `google-cloud-vision`
- **constructor:** recebe `{ apiKey, timeoutMs? }`
- **detectText(input, options?):** converte ImageInput (url/blob/base64) → base64 → Google Vision REST API
- **ResolveImageContent:** URL com validação de protocolo (http/https only), timeout 10s; Blob via arrayBuffer; base64 direto
- **Timeout:** 30s default, configurável
- **AbortSignal:** suportado via AbortController interno + propaga signal externo
- **Error mapping:** HTTP 401/403 → AUTHENTICATION, 429 → RATE_LIMIT, ≥500 → PROVIDER_ERROR (retryable), timeout → TIMEOUT, cancel → CANCELLED

#### Normalização (ocr-normalizer.ts)
- Ignora anotação completa (índice 0 do Google, que retorna texto total)
- Usa anotações individuais (índice 1..n) para granularidade útil
- Calcula boundingBox de vertices (min/max x, y, width, height)
- Extrai polygon quando ≥ 3 vértices
- Extrai locale do Google como `language`
- Confidence: 0 (Google text detection não fornece confidence por palavra)
- Validação: filtra NaN/Infinity das coordenadas

#### API Route (POST /api/ai/ocr)
- Request: JSON body com `image: { base64?, url?, blob? }`
- Validação: content-length ≤ 10MB, JSON parse, image source presente
- Config check: GET /api/ai/ocr retorna `{ configured, provider }`
- Error mapping: AIErrorCode → HTTP status (400-504)
- Secrets: OCR_API_KEY server-side only (nunca exposto ao browser)
- Sem OCR_API_KEY configurada: retorna 503 com mensagem clara

#### FakeOCRProvider
- Fixture: 3 textos simulados (OFERTA ESPECIAL, 50% OFF, COMPRE AGORA)
- Bounding boxes, confidence, language, approximateFontSize predefinidos
- Suporta AbortSignal para teste de cancelamento

### Segurança

- API key: `OCR_API_KEY` (server-side only, NUNCA NEXT_PUBLIC)
- URL input: valida protocolo http/https, bloqueia file:// e outros
- Timeout de download de URL: 10s
- Max body size: 10 MB
- Errors nunca expõem API key, Authorization header ou raw response

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### LIVE OCR TEST

**NOT EXECUTED — API KEY NOT CONFIGURED**

Para testar:
1. Criar API key no Google Cloud Console (Cloud Vision API habilitada)
2. Configurar `OCR_API_KEY=...` no ambiente Vercel
3. POST /api/ai/ocr com `{ "image": { "base64": "..." } }`

### Limitações Conhecidas

- Google text detection não retorna confidence individual para palavras; `confidence` é 0
- Bounding box usa min/max de vértices (aproximação retangular); texto rotacionado tem bounding box maior
- Language hints são configurados como preferência (pt, en, es); Google pode detectar outros idiomas

### ETAPA 33 continua NÃO INICIADA

---

## CHECKPOINT 32.1 — OCR Hardening + Live Validation

### Status: CONCLUIDO

**Data:** 2026-08-11

### Objetivo
Fortalecer a implementação OCR antes da ETAPA 33. Corrigir semântica de confidence, proteger contra SSRF, definir transporte oficial de imagens, e validar contratos.

### Live OCR Test
**BLOCKED — OCR_API_KEY NOT CONFIGURED**

### Correções Aplicadas

#### 1. Confidence — Optional
- `DetectedText.confidence` alterado de obrigatório para opcional (`confidence?: Confidence`)
- `undefined` = não fornecido pelo provider; `0` = confiança zero
- Normalizer do Google Cloud Vision não define `confidence` (Google TEXT_DETECTION não fornece por palavra)
- FakeOCRProvider mantém valores simulados (0.96-0.98)

#### 2. SSRF Protection
- API route pública (`POST /api/ai/ocr`) NÃO aceita mais URLs arbitrárias
- Somente dois formatos: `multipart/form-data` (campo `file`) e JSON com `{ image: { base64: "..." } }`
- Rota pública não tem superfície SSRF (zero fetch de URL do usuário)
- Provider interno (`GoogleOCRProvider.resolveImageContent`) mantém suporte a URL com:
  - Bloqueio de: localhost, 127.0.0.0/8, ::1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0, metadata.google.internal
  - Bloqueio de IPv6 loopback e link-local (fe80::)
  - Validação de redirects: max 3, cada destino validado com isBlockedHost
  - Timeout de download: 10s
  - Tamanho máximo: 10 MB

#### 3. Image Transport (oficial para ETAPA 33)
- **Browser → Route:** `multipart/form-data` com campo `file` (preferido, eficiente para uploads diretos) OU JSON com `{ image: { base64: "..." } }`
- **Route → Google:** base64 puro (requerido pelo REST API do Google Cloud Vision)
- Sem conversões redundantes: Blob/File → `arrayBuffer()` → `Buffer.from().toString('base64')` uma única vez
- Validação de MIME type no multipart (image/png, image/jpeg, image/webp)
- Limite: 10 MB (route + provider)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Limitações Conhecidas

- `confidence` é undefined para Google Cloud Vision (não fornecido por palavra no modo TEXT_DETECTION)
- Live test não executado (sem API key)
- Granularidade do Google será avaliada quando API key estiver disponível

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/ai/types/ocr.ts` | `confidence` → opcional |
| `src/ai/normalizers/ocr-normalizer.ts` | Não define `confidence` (era `0`) |
| `src/ai/providers/google-ocr-provider.ts` | SSRF: isBlockedHost, validateImageUrl, limite redirect, size cap |
| `src/app/api/ai/ocr/route.ts` | Drop URL, multipart/form-data + base64 JSON, validação MIME |
| `DEVELOPMENT_STATE.md` | Checkpoint 32.1 + limpeza stale lines |

### ETAPA 33 continua NÃO INICIADA

---

## CHECKPOINT 32.2 — Preview Deploy + Live OCR Validation

### Status: PARCIALMENTE CONCLUIDO

**Data:** 2026-08-11

### Deploy
- **Preview URL:** https://editor-fotos-lgom8d3tt-viniciusflas-projects.vercel.app
- **Commit:** 8e10ec7 — feat: ETAPA 32 + CHECKPOINT 32.1
- **Build:** OK (Compiled 2.4s, TypeScript 5.1s, Static 5 pages 214ms, Ready 30s)
- **Routes:** `/` (static), `/api/ai/ocr` (dynamic) — ambas registradas

### OCR Config Check
**NOT EXECUTED** — Vercel preview deployments são protegidos por autenticação. A rota `/api/ai/ocr` retorna login gate do Vercel. Config check e live OCR requerem deployment público (production).

### Live OCR Test
**NOT EXECUTED** — API key status desconhecido (rota bloqueada por auth gate).

### Para testar OCR live
1. Configurar `OCR_API_KEY` no dashboard Vercel (Settings → Environment Variables)
2. Deploy em production (`vercel --prod`) — editor-fotos-jet.vercel.app
3. GET `/api/ai/ocr` deve retornar `{ configured: true, provider: "google-cloud-vision" }`
4. POST multipart/form-data com campo `file` para testar OCR

### Build logs
Sem erros ou warnings de aplicação. Apenas `npm warn deprecated` de dependências upstream.

### ETAPA 33 continua NÃO INICIADA

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

## ETAPA 07 — Text Elements

### Status: CONCLUIDA

### Objetivo
Criar sistema funcional de texto com adicao, edicao inline e sincronizacao com Zustand.

### Implementado

- **Adicao de texto** via LeftSidebar:
  - Clique no icone Text dispara `triggerTextAdd()` na store (contador incremental)
  - CanvasArea observa `triggeredTextAdd` e insere novo texto
  - Texto default: "Double-click to edit", fonte Arial 40px, alinhamento center, cor preta
  - Posicionamento: centro do canvas (`LOGICAL_WIDTH/2`, `LOGICAL_HEIGHT/2`)
  - `TextElement` criado com defaults e adicionado ao Zustand
- **Edicao inline** via Fabric.js:
  - `FabricText` criado com `editable: true` (duplo-clique para editar)
  - `createTextObject` em `element-factory.ts` atualizado com `editable: true`
  - Ao sair da edicao (click fora / Enter), `object:modified` dispara sync (ETAPA 05)
  - `extractElementUpdates` captura: text, fontFamily, fontSize, fontWeight, fontStyle, textAlign, fill, letterSpacing, lineHeight
- **Propriedades sincronizadas**:
  - Conteudo (`text`) — alterado via inline editing
  - Font family, fontSize, fontWeight, fontStyle, textAlign, fill — defaults com sync automatico
  - Opacity, rotation — herdado das transformacoes (ETAPA 05)
  - Atualizacao no Zustand via `object:modified` → `extractElementUpdates` → `updateElement`
- **Transformacoes preservadas**:
  - Texto pode ser movido, redimensionado e rotacionado (ETAPA 05)
  - `normalizeFabricObject` bakeia scale em width/height apos resize
  - `locked` respeitado (ETAPA 05)

### Criterios de aceite

- [x] Adicionar texto (clique Text tab → texto aparece no centro do canvas)
- [x] Editar texto (duplo-clique → inline editing → sync ao Zustand ao sair)
- [x] Transformacoes continuam funcionando (move, resize, rotate no texto)
- [x] Estado persiste corretamente (`object:modified` sincroniza propriedades de texto)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                       |
|--------------------------------------|--------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (triggeredTextAdd)              |
| `src/editor/core/element-factory.ts` | Atualizado (editable: true)                |
| `src/components/editor/left-sidebar.tsx` | Atualizado (text tab trigger)          |
| `src/components/editor/canvas-area.tsx` | Atualizado (text insertion)             |

### Observacoes

- `triggeredTextAdd` usa contador (nao boolean) para suportar cliques repetidos
- `FabricText` com `editable: true` usa o TextEditingManager interno do Fabric.js v6
- Edicao inline funciona com duplo-clique; sai com click fora ou Enter
- Propriedades de fonte/familia/cor ainda nao tem UI dedicada (ETAPA 08 — Properties Panel)

---

## CHECKPOINT DEPLOY — ETAPA 07

### Status: CONCLUIDO

### Tipo
Vercel Preview Deployment (primeiro deploy do projeto)

### URL
- Preview: `https://editor-fotos-ov1v316zg-viniciusflas-projects.vercel.app`
- Aliased: `https://editor-fotos-jet.vercel.app`

### Vercel Project
`viniciusflas-projects/editor-fotos`

### Validacoes pre-deploy

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Fabric.js / Next.js compatibilidade
- Todos os componentes que usam Fabric.js possuem `'use client'`
- `page.tsx` (server component) nao importa fabric diretamente
- Sem erros de SSR/hydration
- Lifecycle de canvas com `dispose()` no cleanup
- Nenhum `any`, `@ts-ignore` ou `eslint-disable` adicionado para deploy

### Correcoes tecnicas
- Nenhuma. Projeto passou em todas as validacoes sem alteracoes.

### Branch
`master` (commit `b7e083d` — ETAPA 07 — Text Elements)

---

## ETAPA 08 — Properties Panel

### Status: CONCLUIDA

### Objetivo
Permitir edicao numerica das propriedades do elemento selecionado no painel direito, com atualizacao imediata do canvas e do estado.

### Implementado

- **RightPanel reescrito** (`src/components/editor/right-panel.tsx`):
  - Sem elemento selecionado: placeholder "Select an element"
  - Elemento selecionado: painel com propriedades organizadas por categorias
  - **Position**: campos X, Y (NumberInput)
  - **Size**: campos W, H (NumberInput, min=1)
  - **Transform**: Rotation (NumberInput) + Opacity (range slider 0-100% com badge)
  - **Text** (apenas para elementos `TextElement`):
    - Font Size (Sz) — NumberInput
    - Font Family (Fnt) — select com Arial, Helvetica, Times New Roman, Georgia, Verdana, Courier New, Impact
    - Font Weight (W) — select Normal/Bold
    - Alignment (Al) — botoes Left/Center/Right com estado ativo
    - Color (C) — color picker nativo + valor hex exibido
  - Cada alteracao chama `store.updateElement(id, updates)`
- **Sincronizacao Store → Canvas** (nova em `canvas-area.tsx`):
  - `useEffect` observa `selectedElement` da store via `useEditorStore`
  - `prevElementRef` trackeia estado serializado para evitar syncs desnecessarios
  - Quando propriedades mudam (store → canvas): `syncElementToFabric` + `requestRenderAll`
  - `syncingFromCanvasRef`: quando canvas modifica objeto, `prevElementRef` e atualizado sem sync
  - Loop prevention: `prevElementRef` comparado com `JSON.stringify(selectedElement)`
- **`syncingFromCanvasRef` exportado** de `use-canvas.ts` para uso pelo sync de propriedades
- **Bidirecional**:
  - **Panel → Store → Canvas**: usuario edita painel → `updateElement` → useEffect detecta mudanca → `syncElementToFabric`
  - **Canvas → Store → Panel**: usuario move/resize no canvas → `object:modified` → `updateElement` → React re-render → painel atualiza

### Criterios de aceite

- [x] Propriedades exibem valores corretos (X, Y, W, H, Rotation, Opacity + text props)
- [x] Edicao altera objeto selecionado (painel → store → canvas imediato)
- [x] Mudancas no canvas atualizam painel (canvas → store → re-render)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                        |
|--------------------------------------|---------------------------------------------|
| `src/components/editor/right-panel.tsx` | Reescrito (property inputs)               |
| `src/components/editor/canvas-area.tsx` | Atualizado (store→canvas property sync)   |
| `src/hooks/use-canvas.ts`            | Atualizado (exporta syncingFromCanvasRef)    |

### Observacoes

- `handleChange` usa `useCallback` com dependencia em `element` para evitar re-renders desnecessarios
- `NumberInput` arredonda valores para 2 casas decimais (evita floats longos)
- Range de opacity mapeia 0-100 para 0-1 internamente
- `useMemo` filtra `selectedElement` do array `elements` para evitar re-render em mudancas de outros elementos

---

## ETAPA 09 — Layers Panel

### Status: CONCLUIDA

### Objetivo
Criar painel funcional de camadas com lista de elementos, selecao sincronizada nos dois sentidos e controles de visibilidade/lock.

### Implementado

- **Novo componente `LayersPanel`** (`src/components/editor/layers-panel.tsx`):
  - Exibe todos os elementos ordenados por `zIndex` decrescente (camada superior primeiro)
  - Cada linha mostra: icone de tipo (Text/Image/Shape), nome truncado, visibilidade toggle, lock toggle
  - Estado vazio: "No layers" centralizado
  - **Clique na layer** → `setSelectedElementIds([id])` (seleciona elemento no canvas)
  - **Selecao do canvas** → layer correspondente destacada (bidirecional via store)
  - Layer selecionada: fundo azul (`bg-blue-50`), texto `text-blue-900`, icone `text-blue-600`, nome `font-medium`
  - Layer invisivel: nome com `opacity-40`
- **Toggle visibilidade** (icone olho):
  - Visivel → olho normal com circulo
  - Invisivel → olho riscado
  - Ao clicar → `updateElement(id, { visible: !visible })`
  - `stopPropagation` para nao selecionar a layer junto
- **Toggle lock** (icone cadeado):
  - Locked → cadeado fechado amber
  - Unlocked → cadeado aberto cinza com hover
  - Ao clicar → `updateElement(id, { locked: !locked })`
  - `stopPropagation` para nao selecionar a layer junto
- **Store**: `activeSidebarTab: string | null` + `setActiveSidebarTab`
- **LeftSidebar**: clique no icone Layers alterna `activeSidebarTab` entre `'layers'` e `null`
  - Tab ativo: `bg-muted` + icone `text-foreground`
- **Page layout**: `page.tsx` convertido para `'use client'` para ler `activeSidebarTab`
  - LayersPanel renderizado entre LeftSidebar e CanvasArea quando `activeSidebarTab === 'layers'`

### Criterios de aceite

- [x] Lista reflete elementos (ordenada por zIndex, atualiza com add/remove)
- [x] Selecao sincronizada nos dois sentidos (layer → canvas, canvas → layer)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                        |
|--------------------------------------|---------------------------------------------|
| `src/components/editor/layers-panel.tsx` | Criado                                   |
| `src/components/editor/left-sidebar.tsx` | Atualizado (layers toggle, active state) |
| `src/stores/editor-store.ts`         | Atualizado (activeSidebarTab)               |
| `src/app/page.tsx`                   | Atualizado (client component, conditional LayersPanel) |
| `src/components/editor/index.ts`     | Atualizado (LayersPanel export)             |

### Observacoes

- `page.tsx` agora e client component para usar `useEditorStore`; todos os imports ja eram client components
- `LayersPanel` usa `w-48` (192px) — mesma largura que o RightPanel para consistencia
- Ordenacao por `zIndex` decrescente segue convencao Photoshop/Figma (camada superior = primeiro na lista)
- Visibilidade e lock syncam para Fabric via efeito de propriedades existente na canvas-area (ETAPA 08)

---

## ETAPA 10 — Layer Reordering

### Status: CONCLUIDA

### Objetivo
Permitir controlar a ordem visual das camadas via drag-and-drop e botoes de reordenacao, com sincronizacao entre zIndex (store) e ordem de objetos (Fabric canvas).

### Implementado

- **Store actions de reordenacao** (`editor-store.ts`):
  - `bringForward(id)` — troca zIndex com elemento acima (swap de indices)
  - `sendBackward(id)` — troca zIndex com elemento abaixo
  - `bringToFront(id)` — zIndex = max + 1
  - `sendToBack(id)` — zIndex = min - 1
  - `reorderElementsByZIndex(orderedIds)` — recalcula todos zIndices baseado na nova ordem
  - `reorderZIndices` (helper) — mapeia posicao no array para zIndex (posicao 0 = zIndex n-1, ultima = zIndex 0)
- **Toolbar de reordenacao** no LayersPanel:
  - 4 botoes: Bring to Front (ChevronsUp), Bring Forward (ChevronUp), Send Backward (ChevronDown), Send to Back (ChevronsDown)
  - Botoes `disabled` quando nenhum elemento selecionado
  - Clique → action da store → recalculo zIndex → sync Fabric
- **Drag-and-drop reordenacao** no LayersPanel (HTML5 Drag API):
  - Cada linha: `draggable`
  - `onDragStart` → `e.dataTransfer.setData('text/plain', id)`
  - `onDragOver` → `preventDefault()` + `dropEffect = 'move'` + indicador visual (`border-t-2 border-blue-400`)
  - `onDragLeave` → limpa indicador
  - `onDrop` → calcula `fromIndex`/`toIndex` → `splice` no array ordenado → `reorderElementsByZIndex(newOrder)`
- **Sincronizacao zIndex → Fabric canvas** (`canvas-area.tsx`):
  - `elementOrderKey` — string derivada de `elements.map(id).join(',') | zIndex.join(',')`
  - `useEffect` observa `elementOrderKey` → reordena objetos no canvas
  - Usa `canvas.remove(obj)` + `canvas.insertAt(targetIdx, obj)` para posicionar cada objeto
  - Ordenacao: zIndex ascendente = posicao 0 (fundo) ate posicao n (frente)

### Criterios de aceite

- [x] Reorder visual funciona (drag-drop + botoes toolbar)
- [x] Ordem continua correta apos selecao e edicao (zIndex mantido)
- [x] Estado representa a mesma ordem (store zIndices ≡ canvas object order)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (actions de reordenacao)            |
| `src/components/editor/layers-panel.tsx` | Atualizado (drag-drop + toolbar)           |
| `src/components/editor/canvas-area.tsx` | Atualizado (z-order sync Fabric)            |

### Observacoes

- `canvas.remove(obj)` + `canvas.insertAt(idx, obj)` e a API de reordenacao do Fabric.js v6 (nao ha `moveTo`)
- `elementOrderKey` combina IDs e zIndices em uma string para deteccao eficiente de mudancas de ordem
- Drag-and-drop usa HTML5 nativo (sem dependencia extra); indicador visual e `border-t-2` na posicao de insercao
- `bringForward`/`sendBackward` fazem swap de zIndex (nao incremento) para manter zIndices consistentes sem gaps

---

## CHECKPOINT DEPLOY — CHECKPOINT A (FASE A completa)

### Status: CONCLUIDO

### Tipo
Vercel Preview Deployment apos ETAPA 10 (FASE A — Fundacao do Editor completa)

### URL
- Preview: `https://editor-fotos-8rnbnn9zq-viniciusflas-projects.vercel.app`
- Production: `https://editor-fotos-jet.vercel.app`

### Vercel Project
`viniciusflas-projects/editor-fotos`

### Validacoes pre-deploy

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### FASE A completa — Funcionalidades implementadas

| ETAPA | Nome                       | Status    |
|-------|----------------------------|-----------|
| 01    | Project Setup              | CONCLUIDA |
| 02    | Canvas Engine              | CONCLUIDA |
| 03    | Modelo de Dados            | CONCLUIDA |
| 04    | Selecao                    | CONCLUIDA |
| 05    | Move, Resize e Rotate      | CONCLUIDA |
| 06    | Upload e Inserção Imagens  | CONCLUIDA |
| 07    | Text Elements              | CONCLUIDA |
| 08    | Properties Panel           | CONCLUIDA |
| 09    | Layers Panel               | CONCLUIDA |
| 10    | Layer Reordering           | CONCLUIDA |

### Branch
`master` (commit `b4818b1` — ETAPA 10 — Layer Reordering)

### Observacoes
- Preview deployment requer autenticacao Vercel (protecao padrao de preview)
- URL de producao (`editor-fotos-jet.vercel.app`) acessivel publicamente
- Proxima: FASE B — ETAPA 11 (Visibility e Lock)

---

## ETAPA 11 — Visibility e Lock

### Status: CONCLUIDA

### Objetivo
Garantir que hide/show e lock/unlock funcionem de forma consistente entre painel layers, canvas e estado, com sincronizacao para todos os elementos (nao apenas o selecionado) e indicadores visuais.

### Implementado

- **`applyCommonProps` corrigido** (`element-factory.ts`):
  - `selectable: element.visible && !element.locked` (antes era `!element.locked`)
  - `evented: element.visible && !element.locked` (antes era `!element.locked`)
  - Elemento oculto nao recebe eventos de mouse nem e selecionavel no canvas
- **Sincronizacao visibility/lock para TODOS os elementos** (novo efeito em `canvas-area.tsx`):
  - `elementsVisibilityLock` — string derivada de `element.id:v{visible}:l{locked}` para todos os elementos
  - `useEffect` observa mudancas e sincroniza CADA elemento ao Fabric via `syncElementToFabric`
  - Antes, apenas o elemento selecionado era sincronizado (ETAPA 08); agora todos sao
- **Deselecao automatica** ao ocultar/bloquear:
  - Verifica `selectedElementIds` contra `!visible || locked`
  - Se elemento selecionado foi oculto ou bloqueado: `canvas.discardActiveObject()`
  - IDs invalidos removidos de `selectedElementIds` na store
  - `syncingFromCanvasRef` previne conflito com sync de selecao
- **Indicadores visuais no canvas**:
  - Oculto (`visible: false`): elemento nao renderizado no canvas (Fabric.js nativo)
  - Bloqueado (`locked: true`): sem handles de selecao, sem transformacao (via Fabric lock props)
  - Nao selecionavel, nao recebe eventos
- **Indicadores visuais no LayersPanel** (herdado ETAPA 09):
  - Oculto: nome com `opacity-40` + icone olho riscado
  - Bloqueado: icone cadeado fechado amber

### Criterio de aceite

- [x] Estado e comportamento permanecem sincronizados (store ↔ Fabric para todos os elementos)
- [x] Elemento oculto: nao renderiza, nao selecionavel, deselected se estava selecionado
- [x] Elemento bloqueado: sem handles, sem transform, deselected se estava selecionado
- [x] Toggles no LayersPanel refletem imediatamente no canvas

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/editor/core/element-factory.ts` | Atualizado (selectable/evented com visible)    |
| `src/components/editor/canvas-area.tsx` | Atualizado (visibility/lock sync global)    |

### Observacoes

- Antes, apenas o elemento selecionado era sincronizado ao Fabric (efeito da ETAPA 08). Agora ha um efeito separado que sincroniza visibility/lock para TODOS os elementos
- `elementsVisibilityLock` usa formato compacto (`id:v{bool}:l{bool}`) para deteccao eficiente de mudancas
- `applyCommonProps` ja era chamado via `syncElementToFabric`; a unica mudanca foi nos valores de `selectable`/`evented`

---

## ETAPA 12 — Duplicate e Delete

### Status: CONCLUIDA

### Objetivo
Implementar delete e duplicate de elementos selecionados via teclas de atalho e logica de exclusao segura durante edicao textual.

### Implementado

- **Delete** (tecla Delete ou Backspace):
  - `handleDelete()` — remove objetos Fabric do canvas (`canvas.remove()`) + remove elementos da store (`removeElement()`)
  - `canvas.discardActiveObject()` para limpar selecao apos exclusao
  - Ignora quando nao ha elementos selecionados
- **Duplicate** (Ctrl/Cmd+D):
  - `handleDuplicate()` — clona elementos selecionados com novos IDs
  - Offset de +15px em X e Y na copia
  - Nome: `{original} copy`
  - Para ImageElement: novo `assetId` gerado
  - Fabric: `originalObj.clone()` assincrono → `set()` offset → `canvas.add()`
  - Store: novo elemento adicionado via `addElement()`
- **Keyboard handler** (`useEffect` com `keydown` no `window`):
  - Delete/Backspace → `handleDelete()`
  - Ctrl/Cmd+D → `handleDuplicate()`
  - Prevencao em inputs/textarea/select (`e.target instanceof HTMLInputElement`, etc.)
  - Prevencao durante edicao textual (`isTextEditingRef.current` — ETAPA 12)
  - `e.preventDefault()` para evitar comportamentos padrao do navegador
- **`isTextEditingRef`** em `use-canvas.ts`:
  - Tracking via eventos `text:editing:entered` / `text:editing:exited` do Fabric.js
  - Exposto no retorno de `useCanvas` para uso pelo handler de teclado
  - Garante que Delete nao exclui elemento enquanto usuario edita texto inline
- **Remocao de listeners**: `window.removeEventListener('keydown', ...)` no cleanup

### Criterios de aceite

- [x] Delete funciona (tecla Delete/Backspace remove elemento selecionado do canvas + store)
- [x] Backspace funciona (mesmo comportamento que Delete)
- [x] Duplicate funciona (Ctrl/Cmd+D → copia com novo ID + offset 15px)
- [x] Novo ID gerado para duplicatas (`generateId()`)
- [x] Deslocamento da duplicata (+15px X, +15px Y)
- [x] Atalhos iniciais (Delete, Backspace, Ctrl+D)
- [x] Nao exclui objeto durante edicao textual (`isTextEditingRef` + guard em inputs)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                      |
|--------------------------------------|-------------------------------------------|
| `src/hooks/use-canvas.ts`            | Atualizado (isTextEditingRef)             |
| `src/components/editor/canvas-area.tsx` | Atualizado (delete/duplicate + keyboard) |

### Observacoes

- `originalObj.clone()` e assincrono (retorna Promise); callbacks usam `.then()` para adicionar ao canvas/store
- Offset de 15px evita sobreposicao total da copia com o original
- Guard em inputs/textarea/select no `keydown` previne conflito com inputs do Properties Panel, color picker, etc.
- Multi-selecao: delete remove todos os elementos selecionados; duplicate clona cada um individualmente

---

## ETAPA 13 — Clipboard

### Status: CONCLUIDA

### Objetivo
Implementar clipboard interno (Ctrl+C, Ctrl+V, Ctrl+X) com suporte a multiplos objetos, novos IDs e offset progressivo no paste.

### Implementado

- **Clipboard na store** (`editor-store.ts`):
  - `clipboard: AnyElement[]` — armazena copia dos elementos selecionados
  - `pasteOffset: number` — contador para offset progressivo (1 apos copy/cut)
  - `copyToClipboard()` — copia elementos selecionados, reseta offset para 1
  - `incrementPasteOffset()` — incrementa offset apos cada paste
- **Copy** (Ctrl/Cmd+C → `handleCopy`):
  - Chama `store.copyToClipboard()` — filtra `elements` por `selectedElementIds`
  - Reseta `pasteOffset` para 1
  - Nao modifica canvas
- **Cut** (Ctrl/Cmd+X → `handleCut`):
  - `handleCopy()` + `handleDelete()` — copia + remove originais
  - Elementos originais removidos do canvas e da store
  - `pasteOffset` resetado para 1
- **Paste** (Ctrl/Cmd+V → `handlePaste`):
  - Le `store.clipboard` — se vazio, nao faz nada
  - Offset: `pasteOffset * 15` px em X e Y
  - Para cada elemento no clipboard:
    - Novo ID via `generateId()`
    - Nome preservado (sem sufixo "copy" — clipboard ja e uma copia)
    - Posicao: `el.x + offset`, `el.y + offset`
    - zIndex calculado incrementalmente
    - Imagem: novo `assetId` gerado
    - `createFabricObject(newEl)` → assincrono (suporta imagens)
    - `canvas.add(fabricObj)` + `store.addElement(newEl)`
  - `store.incrementPasteOffset()` apos todos os elementos
  - Pastes consecutivos: offset progressivo (15, 30, 45, ...)
- **Keyboard handler**: Ctrl/Cmd+C, V, X adicionados ao handler existente
  - Mesmo guard de `isTextEditingRef` e inputs
  - `e.preventDefault()` em todos para evitar comportamento padrao

### Criterios de aceite

- [x] Ctrl/Cmd+C copia elementos selecionados para clipboard interno
- [x] Ctrl/Cmd+V cola elementos do clipboard com novos IDs + offset
- [x] Ctrl/Cmd+X corta elementos (copia + remove originais)
- [x] Multiplos objetos suportados
- [x] Copia recebe novos IDs
- [x] Paste possui pequeno offset (15px progressivo)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                      |
|--------------------------------------|-------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (clipboard, pasteOffset)       |
| `src/components/editor/canvas-area.tsx` | Atualizado (copy/cut/paste handlers)   |

### Observacoes

- Clipboard e interno (array `AnyElement[]` na store), nao usa `navigator.clipboard`
- `pasteOffset` incrementa a cada paste; resetado a 1 em copy/cut
- `createFabricObject` e assincrono (suporta `FabricImage.fromURL`); `forEach(async)` usado
- Multi-selecao: copy/cut copia todos os selecionados; paste recria todos

---

## ETAPA 14 — History / Undo / Redo

### Status: CONCLUIDA

### Objetivo
Criar historico robusto com suporte a undo/redo para todas as operacoes (create, delete, move, resize, rotate, properties, reorder) sem gerar entradas excessivas durante drag ou digitacao.

### Implementado

- **History Manager** (`src/editor/history/history-manager.ts`):
  - `past: AnyElement[][]` — pilha de snapshots para undo (max 50)
  - `future: AnyElement[][]` — pilha para redo (resetada a cada nova acao)
  - `pushHistoryImmediate(elements)` — push imediato (transforms, create, delete, reorder)
  - `pushHistoryDebounced(elements)` — push com debounce 500ms (property panel edits)
  - `undo(currentElements)` — retorna snapshot anterior ou null
  - `redo(currentElements)` — retorna snapshot futuro ou null
  - `structuredClone` para copia profunda dos elementos
- **Snapshots em action points**:
  - `object:modified` (use-canvas) → `pushHistoryImmediate` ANTES de `updateElement` (captura pre-transform)
  - `insertImage` / `insertText` → push antes de adicionar ao canvas/store
  - `handleDelete` → push antes de remover
  - `handleDuplicate` / `handlePaste` → push antes de criar copias
  - Reorder (toolbar + drag-drop) → push antes de `reorderElementsByZIndex`
  - Properties panel (RightPanel) → `pushHistoryDebounced` no `handleChange` (primeira digitacao captura, subsequentes em 500ms nao criam novas entradas)
- **Undo/Redo** (canvas-area):
  - `handleUndo()` — `undo(store.elements)` → se snapshot, `setElements` + `triggerRebuildCanvas`
  - `handleRedo()` — `redo(store.elements)` → se snapshot, `setElements` + `triggerRebuildCanvas`
  - `triggeredUndo` / `triggeredRedo` no store (contadores) para toolbar buttons
  - Efeitos `useEffect` observam contadores e chamam handlers
- **Canvas rebuild** apos undo/redo:
  - Efeito observa `rebuildCanvasVersion` (incrementado em undo/redo)
  - `canvas.clear()` → itera `store.elements` → `createFabricObject(el)` (sync para text/shape, async Promise para images)
  - `setElementId` + `canvas.add` para cada object
- **Keyboard shortcuts**:
  - Ctrl/Cmd+Z → `handleUndo()`
  - Ctrl/Cmd+Shift+Z → `handleRedo()`
  - Guard `isTextEditingRef` + inputs
- **TopToolbar**: botao Undo (Undo2) e Redo (Redo2) funcionais com tooltip

### Criterios de aceite

- [x] Undo/Redo funciona para create, delete, move, resize, rotate, properties, reorder
- [x] Ctrl/Cmd+Z e Ctrl/Cmd+Shift+Z funcionam
- [x] Nao cria entradas durante drag (apenas `object:modified`)
- [x] Nao cria centenas de entradas durante digitacao (debounce 500ms)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                      |
|--------------------------------------|-------------------------------------------|
| `src/editor/history/history-manager.ts` | Criado (modulo de historico)           |
| `src/stores/editor-store.ts`         | Atualizado (triggers undo/redo/rebuild)   |
| `src/hooks/use-canvas.ts`            | Atualizado (history push no object:modified) |
| `src/components/editor/canvas-area.tsx` | Atualizado (undo/redo handlers + rebuild) |
| `src/components/editor/right-panel.tsx` | Atualizado (debounced history push)    |
| `src/components/editor/layers-panel.tsx` | Atualizado (history push reorder)      |
| `src/components/editor/top-toolbar.tsx` | Atualizado (botoes undo/redo ativos)   |

### Observacoes

- `structuredClone` faz deep copy segura dos elementos (evita mutacoes acidentais)
- `pushHistoryImmediate` no `object:modified` e chamado ANTES do `updateElement` — captura estado pre-transformacao
- `pushHistoryDebounced` no properties panel: primeira mudanca cria snapshot, subsequentes em 500ms sao agrupadas
- Canvas rebuild pos-undo/redo recria todos os FabricObjects; imagens usam Promise (assincrono)
- `future` stack e limpa em qualquer nova acao (comportamento padrao de undo)

---

## CHECKPOINT DEPLOY — FASE B (ETAPA 14)

### Status: CONCLUIDO

### Tipo
Vercel Preview Deployment apos ETAPA 14 (History / Undo / Redo)

### URL
- Preview: `https://editor-fotos-4wk1w9cv3-viniciusflas-projects.vercel.app`

### Vercel Project
`viniciusflas-projects/editor-fotos`

### Validacoes pre-deploy

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| Testes               | N/A (sem test runner configurado) |
| `npx next build`     | OK        |

### FASE B — Funcionalidades implementadas

| ETAPA | Nome                       | Status    |
|-------|----------------------------|-----------|
| 11    | Visibility e Lock          | CONCLUIDA |
| 12    | Duplicate e Delete         | CONCLUIDA |
| 13    | Clipboard                  | CONCLUIDA |
| 14    | History / Undo / Redo      | CONCLUIDA |

### Branch
`master` (commit `46bd3ac` — ETAPA 14 — History / Undo / Redo)

### Observacoes
- Proxima: ETAPA 15 — Keyboard Shortcuts (NAO executar automaticamente)
- Projeto sem test runner configurado; testes sao N/A neste checkpoint

---

## ETAPA 15 — Keyboard Shortcuts

### Status: CONCLUIDA

### Objetivo
Implementar gerenciamento centralizado de atalhos de teclado com suporte a navegacao por setas.

### Implementado

- **Hook `useKeyboardShortcuts`** (`src/hooks/use-keyboard-shortcuts.ts`) — gerenciamento centralizado:
  - Moveu toda a logica de handlers e event listener de `canvas-area.tsx` para este hook dedicado
  - `canvas-area.tsx` agora apenas chama `useKeyboardShortcuts({ canvasInstanceRef, isTextEditingRef })` e usa `{ handleUndo, handleRedo }` retornados
- **Atalhos existentes centralizados no hook**:
  - Delete / Backspace → `handleDelete()`
  - Ctrl/Cmd+D → `handleDuplicate()`
  - Ctrl/Cmd+Z → `handleUndo()`
  - Ctrl/Cmd+Shift+Z → `handleRedo()`
  - Ctrl/Cmd+C → `handleCopy()`
  - Ctrl/Cmd+V → `handlePaste()`
  - Ctrl/Cmd+X → `handleCut()`
- **Arrow keys** (novo):
  - Arrow keys (↑ ↓ ← →) movem elementos selecionados em **1px**
  - Shift+Arrow movem em **10px**
  - `handleArrowMove(key, shiftKey)` — calcula delta e atualiza FabricObject + store
  - Historico via `pushHistoryDebounced` (500ms) — evita centenas de entradas durante key repeat
  - Guard `isTextEditingRef` previne movimento durante edicao inline
  - Elementos bloqueados (`locked: true`) nao sao movidos
- **Guardas de foco/edicao**:
  - `e.target instanceof HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement` — ignora inputs
  - `isTextEditingRef.current` — ignora durante edicao de texto no canvas
  - `e.preventDefault()` em todos os shortcuts para evitar comportamento padrao do navegador

### Criterios de aceite

- [x] Delete e Backspace funcionam
- [x] Ctrl/Cmd+D, C, V, X, Z, Shift+Z funcionam
- [x] Arrow keys movem 1px por pressionamento
- [x] Shift+Arrow movem 10px por pressionamento
- [x] Arrow keys nao interferem em inputs ou edicao de texto
- [x] Arrow keys respeitam `locked`
- [x] Gerenciamento centralizado (hook unico `use-keyboard-shortcuts`)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/hooks/use-keyboard-shortcuts.ts` | Criado (gerenciamento centralizado de atalhos) |
| `src/components/editor/canvas-area.tsx` | Atualizado (delega atalhos ao hook)          |

### Observacoes

- O hook exporta `handleUndo` e `handleRedo` porque o `canvas-area.tsx` ainda precisa deles nos efeitos `triggeredUndo`/`triggeredRedo` (para os botoes da toolbar)
- `pushHistoryDebounced` e usado para arrow keys (mesmo mecanismo do properties panel) — primeira tecla captura snapshot, subsequentes em 500ms nao criam novas entradas
- `handleArrowMove` atualiza FabricObject diretamente (`obj.set({ left, top })`) e store via `updateElement()` para cada elemento nao-bloqueado
- Nao ha conflict com `object:modified` — arrow keys mudam posicao sem disparar o evento de transformacao do Fabric.js

---

## ETAPA 16 — Zoom

### Status: CONCLUIDA

### Objetivo
Implementar sistema de zoom visual com controles, percentual, fit-to-screen, reset e Ctrl/Cmd+wheel, sem alterar dimensoes logicas dos elementos.

### Implementado

- **Store `zoom`** (`editor-store.ts`):
  - `zoom: number` — default `1` (100%), clamp entre `[0.1, 4.0]` = `[10%, 400%]`
  - `setZoom(zoom)` — set com clamp e arredondamento para 2 casas decimais
  - `zoomIn()` / `zoomOut()` — avanca/recua entre steps predefinidos:
    `[0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0]`
  - `zoomReset()` — retorna zoom para `1.0` (100% / fit-to-screen)
  - Funcoes helper `clampZoom`, `nextZoomStep`, `prevZoomStep`
- **`use-canvas.ts` — escala composta**:
  - `baseScale` — escala automatica para caber no container (ResizeObserver, cap=1)
  - `displayScale = baseScale * zoom` — escala final aplicada via CSS transform
  - Hook le `zoom` da store via `useEditorStore((s) => s.zoom)` → re-render automatico
  - Retorna `scale: displayScale` (API publica mantida, canvas-area nao precisou mudar)
- **`footer-status.tsx` — controles de zoom**:
  - **Zoom Out** (botao `-`) — `store.zoomOut()`, disabled em 10%
  - **Percentual** (clicavel) — exibe `{zoomPercent}%`, click → `zoomReset()` (100%)
  - **Zoom In** (botao `+`) — `store.zoomIn()`, disabled em 400%
  - **Fit to Screen** (icone `Maximize2`) — `zoomReset()` (zoom=1 → auto-fit)
  - Estados disabled em limites inferior/superior com `opacity-30`
  - `tabular-nums` para alinhamento consistente do percentual
- **`use-keyboard-shortcuts.ts` — Ctrl/Cmd+wheel**:
  - Parametro novo: `containerRef` (para o listener de wheel)
  - Handler `handleWheel` no container do canvas:
    - Somente ativo com `ctrlKey || metaKey`
    - `deltaY < 0` → `zoomIn()`
    - `deltaY > 0` → `zoomOut()`
    - `e.preventDefault()` + listener `{ passive: false }`
  - `canvas-area.tsx` atualizado para passar `containerRef` ao hook
- **Zoom nao altera dimensoes logicas**:
  - Apenas CSS `transform: scale()` no wrapper do canvas e afetado
  - Canvas Fabric.js mantem `width=1080, height=1080` sempre
  - Coordenadas logicas de elementos nunca mudam com zoom

### Criterios de aceite

- [x] Zoom in funciona (step predefinido, max 400%)
- [x] Zoom out funciona (step predefinido, min 10%)
- [x] Percentual exibe valor correto
- [x] Fit-to-screen / Reset funciona (zoom=100%)
- [x] Ctrl/Cmd+wheel funciona (in/out no container do canvas)
- [x] Faixa respeitada: 10% a 400%
- [x] Zoom nao altera dimensoes logicas dos elementos

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (zoom state + actions)              |
| `src/hooks/use-canvas.ts`            | Atualizado (baseScale + displayScale composto) |
| `src/components/editor/footer-status.tsx` | Reescrito (controles de zoom funcionais)   |
| `src/hooks/use-keyboard-shortcuts.ts` | Atualizado (Ctrl/Cmd+wheel + containerRef)     |
| `src/components/editor/canvas-area.tsx` | Atualizado (passa containerRef ao hook)     |

### Observacoes

- Zoom e puramente visual (CSS transform no wrapper do `<canvas>`); o Fabric.js canvas mantem dimensoes 1080x1080 inalteradas
- `baseScale` e recalculado via `ResizeObserver`; `displayScale` = `baseScale * zoom` reage a ambos
- Ctrl+wheel listener usa `{ passive: false }` para permitir `preventDefault()` e evitar scroll da pagina durante zoom
- Zoom steps predefinidos garantem precisao e previsibilidade (sem acumulo de erros de ponto flutuante)

---

## ETAPA 17 — Canvas Guides

### Status: CONCLUIDA

### Objetivo
Implementar guides visuais de alinhamento (centro horizontal, centro vertical, bordas do canvas) exibidos durante movimento de objetos.

### Implementado

- **Guides no `use-canvas.ts`** (novo efeito):
  - `guidesRef` — array de `Line` temporarias (Fabric.js) que sao adicionadas/removidas do canvas
  - `object:moving` handler → `handleObjectMoving`:
    - `clearGuides()` remove guides anteriores
    - `canvas.getActiveObject().getBoundingRect()` calcula bounds
    - Verifica alinhamento com threshold de **5px**
    - **Centro horizontal**: linha vertical tracejada em `logicalWidth / 2` quando `centerX ≈ logicalWidth / 2`
    - **Centro vertical**: linha horizontal tracejada em `logicalHeight / 2` quando `centerY ≈ logicalHeight / 2`
    - **Bordas**: linhas tracejadas em `left=0`, `right=logicalWidth`, `top=0`, `bottom=logicalHeight`
    - `drawGuide(x1, y1, x2, y2)` cria `Line` com `strokeDashArray: [5,5]`, cor azul `#3b82f6`
  - `mouse:up` handler → `clearGuides()` remove todos os guides ao soltar
  - Cleanup: `canvas.off()` + `clearGuides()` no unmount
- **Propriedades dos guides**:
  - `selectable: false` — nao interfere na selecao
  - `evented: false` — nao captura eventos de mouse
  - `excludeFromExport: true` — nao aparece na exportacao
  - `hoverCursor: 'default'` — cursor normal ao passar sobre guide
  - `stroke: '#3b82f6'` — azul consistente com tema de selecao
  - `strokeWidth: 1` — linha fina
  - `strokeDashArray: [5, 5]` — tracejada para nao confundir com elementos reais
- **Arquitetura**: logica contida em efeito proprio no `use-canvas.ts`, sem estado na store ou componentes visuais adicionais

### Criterios de aceite

- [x] Guide de centro horizontal aparece durante movimento alinhado
- [x] Guide de centro vertical aparece durante movimento alinhado
- [x] Guides de bordas aparecem durante movimento alinhado (left, right, top, bottom)
- [x] Guides visiveis apenas durante movimento (object:moving → mouse:up)
- [x] Guides nao sao exportaveis (`excludeFromExport: true`)
- [x] Guides nao interferem em selecao ou interacao (`selectable: false, evented: false`)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/hooks/use-canvas.ts`            | Atualizado (guide drawing + object:moving/mouse:up handlers) |

### Observacoes

- Guides sao objetos Fabric temporarios (`Line`); nao persistem na store nem afetam o modelo de dados
- Threshold de 5px fornece "sticky" visual antes do snapping (ETAPA 18 implementara snapping real)
- `getBoundingRect()` funciona tanto para objetos individuais quanto para `ActiveSelection` (multi-selecao)
- Hex `#3b82f6` e consistente com a cor de selecao (`selectionBorderColor`) definida em ETAPA 04
- `excludeFromExport` e propriedade nativa do Fabric.js v6; nao requer logica customizada de filtro

---

## ETAPA 18 — Object Snapping

### Status: CONCLUIDA

### Objetivo
Implementar snapping entre elementos durante movimento, com guias visuais de alinhamento e correcao de posicao.

### Implementado

- **Snapping objeto-a-objeto** (extensao do `handleObjectMoving` em `use-canvas.ts`):
  - Algoritmo de alinhamento para cada `object:moving`:
    1. `clearGuides()` remove guides anteriores
    2. `canvas.getActiveObject().getBoundingRect()` obtem bounds do objeto em movimento
    3. Itera sobre `canvas.getObjects()` filtrando objetos visiveis com `getElementId` (managed objects)
    4. Para cada target, calcula snap points:
       - **Horizontal**: `[left, centerX, right]` × `[targetLeft, targetCenterX, targetRight]`
       - **Vertical**: `[top, centerY, bottom]` × `[targetTop, targetCenterY, targetBottom]`
    5. Tracking de `bestDx` / `bestDy` (menor valor absoluto)
    6. Tracking de `snapGuideV` / `snapGuideH` para desenho de guides
  - Aplicacao de snap:
    - `active.set({ left: left + bestDx })` — ajusta posicao X
    - `active.set({ top: top + bestDy })` — ajusta posicao Y
    - Apenas objeto Fabric e alterado (posicao visual); store NAO e atualizada durante drag
    - `object:modified` captura posicao final corretamente (com snap ja aplicado)
  - Guias de snap:
    - `drawGuide(snapGuideV, 0, snapGuideV, logicalHeight)` — linha vertical no X do snap
    - `drawGuide(0, snapGuideH, logicalWidth, snapGuideH)` — linha horizontal no Y do snap
  - **Canvas guides mantidos**: snapping tem prioridade; se nenhum snap ocorrer, canvas guides (centro, bordas) sao mostrados
- **Performance**:
  - Itera apenas objetos managed (`getElementId(obj) !== undefined`) — exclui guides e objetos temporarios
  - Filtra `obj.visible === false` — nao processa objetos ocultos
  - Pula o proprio objeto ativo (`obj === active`)
  - `forEach` em vez de loops aninhados complexos
  - Sem atualizacao de store durante o movimento (evita re-renders em mousemove)
  - Snap X e Y independentes — mesmo se X nao snapar, Y pode
- **Compatibilidade multi-selecao**: `getBoundingRect()` e `set({ left, top })` funcionam para ActiveSelection

### Criterios de aceite

- [x] Snapping left-to-left funciona (objeto em movimento alinha borda esquerda com target)
- [x] Snapping right-to-right funciona
- [x] Snapping top-to-top funciona
- [x] Snapping bottom-to-bottom funciona
- [x] Snapping centerX-to-centerX funciona
- [x] Snapping centerY-to-centerY funciona
- [x] Snapping cross funciona (left-to-right, top-to-bottom, etc.)
- [x] Guide visual aparece durante snap
- [x] Canvas guides continuam funcionando quando nao ha snap
- [x] Performance: sem processamento excessivo em mousemove

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK        |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                           |
|--------------------------------------|------------------------------------------------|
| `src/hooks/use-canvas.ts`            | Atualizado (object snapping + guides snaps)    |

### Observacoes

- Snapping e puramente visual durante o movimento; a store so e atualizada via `object:modified` ao final do drag
- Algoritmo testa 3×3=9 combinacoes de snap points por objeto (horizontal + vertical = 18 no total por target)
- Com 20 objetos no canvas: ~360 comparacoes por frame — leve e dentro do orcamento de performance
- `bestDx`/`bestDy` sao inicializados como `GUIDE_THRESHOLD + 1` para que o primeiro canditato sempre entre
- `snapped` flag evita desenhar canvas guides quando ja houve snap (evita overload visual)

---

## ETAPA 19 — Shapes

### Status: CONCLUIDA

### Objetivo
Adicionar formas geometricas (Rectangle, Circle, Line) com propriedades de fill, stroke e strokeWidth, participando de transform, layers, history e clipboard.

### Implementado

- **Insercao de shapes** (ja implementada em etapas anteriores, consolidada nesta etapa):
  - LeftSidebar: submenu Elements com opcoes Rectangle, Circle, Line
  - Store: `triggeredShapeAdd` + `pendingShapeType` conectam sidebar ao canvas
  - `insertShape()` em canvas-area.tsx: cria ShapeElement + FabricObject (Rect/Circle/Line)
  - Defaults: fill=transparent, stroke=#3b82f6, strokeWidth=2
  - Shapes centralizados no canvas (offset 200x200 centrado)
- **Properties Panel** para shapes (`right-panel.tsx`):
  - Secao "Shape" exibida ao selecionar elemento do tipo `shape`
  - **Fill** — color picker nativo + valor hex
  - **Stroke (Stk)** — color picker nativo + valor hex
  - **Stroke Width (Sw)** — NumberInput com step=0.5, min=0
  - Alteracoes sincronizam imediatamente: panel → store → canvas (via `handleChange` + `pushHistoryDebounced`)
- **Participacao em recursos existentes**:
  - **Transform**: shapes sao FabricObjects — move, resize, rotate funcionam (ETAPA 05)
  - **Layers**: shapes aparecem no LayersPanel com icone `Square` (ETAPA 09)
  - **History**: `pushHistoryImmediate` chamado antes de insertShape (ETAPA 14)
  - **Clipboard**: copy/cut/paste funcionam para shapes (AnyElement[] generico — ETAPA 13)

### Criterios de aceite

- [x] Rectangle, Circle e Line podem ser adicionados via sidebar Elements
- [x] Propriedades fill, stroke, strokeWidth editaveis no RightPanel
- [x] Transform funciona (move, resize, rotate)
- [x] Layers refletem shapes corretamente
- [x] Undo/Redo funciona para criacao de shapes
- [x] Clipboard (copy/cut/paste) funciona para shapes

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                      |
|--------------------------------------|-------------------------------------------|
| `src/components/editor/right-panel.tsx` | Atualizado (shape properties section) |

### Observacoes

- A infraestrutura de shapes (types, store, element-factory, insercao no canvas) ja existia desde etapas anteriores; esta etapa consolidou o feature com o properties panel
- `ShapeElementSchema` ja definia fill, stroke, strokeWidth desde ETAPA 03
- `createShapeObject` em element-factory.ts suporta Rect, Circle (via radius), Line (via pontos [x1,y1,x2,y2])
- O fill da Line e sempre ignorado visualmente (Fabric.js `Line` nao suporta fill), mas a propriedade existe no modelo

---

## ETAPA 20 — Multi-select / Group / Ungroup

### Status: CONCLUIDA

### Objetivo
Implementar agrupamento e desagrupamento de elementos com suporte a transformacao conjunta (move, resize, rotate), mantendo a integridade do estado dos elementos agrupados.

### Implementado

- **Multi-selecao robusta** (ja existente — ETAPA 04):
  - Selecao por marquee (box selection) via Fabric.js `selection: true`
  - Shift+clique para adicionar/remover da selecao
  - `selectedElementIds: string[]` suporta multiplos IDs
  - Sincronizacao bidirecional canvas ↔ store
- **GroupElement** — novo tipo de elemento (`src/types/index.ts`):
  - `type: 'group'` adicionado ao `ElementType`
  - `GroupElement` interface: estende `EditorElement` com `childElements: AnyElement[]`
  - `GroupElementSchema` — Zod schema usando `z.array(z.any())` para evitar recursao circular
  - `AnyElement` union atualizada para incluir `GroupElement`
- **Store — groupSelected / ungroupSelected** (`src/stores/editor-store.ts`):
  - `groupSelected(group, childIds)`: remove children do array `elements`, adiciona `GroupElement`, seleciona o grupo
  - `ungroupSelected(groupId, children)`: remove `GroupElement`, adiciona children atualizados ao array, seleciona os children
  - `triggerGroup()` / `triggerUngroup()`: contadores para acionamento via toolbar
- **Group no canvas** (`src/hooks/use-keyboard-shortcuts.ts`):
  - `handleGroup()` — Ctrl+G:
    1. Encontra FabricObjects dos selecionados no canvas
    2. Cria `new Group(childObjects)` (Fabric.js)
    3. Remove objetos individuais, adiciona o Group
    4. Cria `GroupElement` com bounding box do Group
    5. Armazena via `store.groupSelected()`
  - `handleUngroup()` — Ctrl+Shift+G:
    1. Encontra o Fabric Group no canvas
    2. Extrai objetos filhos com posicoes absolutas (refletindo transforms do grupo)
    3. Remove Group, adiciona objetos individuais de volta
    4. Atualiza childElements com novas posicoes
    5. Armazena via `store.ungroupSelected()`
    6. Cria `ActiveSelection` para os elementos desagrupados
- **Element Factory** — suporte a grupos (`src/editor/core/element-factory.ts`):
  - `createGroupObject(element)`: cria FabricObjects para cada child → `new Group(objects)` (async, suporta imagens)
  - `extractElementUpdates` — case `'group'`: retorna only `common` updates (posicao, tamanho, transform)
  - `syncElementToFabric` — case `'group'`: sem propriedades especificas alem de `applyCommonProps`
- **Keyboard shortcuts**:
  - `Ctrl+G` — agrupar elementos selecionados (≥2)
  - `Ctrl+Shift+G` — desagrupar grupo selecionado
  - Prevencao durante edicao textual (`isTextEditingRef`)
  - Prevencao em inputs/textarea/select
- **Toolbar buttons** (`src/components/editor/top-toolbar.tsx`):
  - Botao Group (icone `Group`) — `triggerGroup()`
  - Botao Ungroup (icone `Ungroup`) — `triggerUngroup()`
  - Separador visual entre undo/redo e group/ungroup
- **Layers Panel** (`src/components/editor/layers-panel.tsx`):
  - Grupo exibido com icone `Group` (lucide-react)
  - Contagem de filhos exibida apos o nome: `Group (3)`
- **Transform em grupo**:
  - Grupos sao FabricObjects — move, resize, rotate funcionam nativamente (ETAPA 05)
  - `object:modified` sincroniza posicao/tamanho/rotacao do GroupElement no store
  - `extractElementUpdates` para grupos retorna apenas `common` props
- **Canvas rebuild** (undo/redo):
  - `createGroupObject` recria o Fabric Group com todos os children durante rebuild
  - Suporta children de qualquer tipo (text, image, shape, inclusive grupos aninhados)
- **History**: `pushHistoryImmediate` chamado antes de group/ungroup (ETAPA 14)
- **Visibility/Lock sync**: `syncElementToFabric` aplica `visible`/`locked` ao Group (ETAPA 11)
- **Z-Order**: grupos mantem zIndex proprio; filhos internos preservam ordem relativa

### Criterios de aceite

- [x] Multi-selecao funciona (marquee + Shift+clique)
- [x] Ctrl+G agrupa elementos selecionados (≥2)
- [x] Ctrl+Shift+G desagrupa grupo selecionado
- [x] Grupo pode ser movido (drag)
- [x] Grupo pode ser redimensionado (resize handles)
- [x] Grupo pode ser rotacionado (rotation handle)
- [x] Estado dos elementos e preservado ao desagrupar (posicoes absolutas corretas)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                            |
|--------------------------------------|-------------------------------------------------|
| `src/types/index.ts`                 | Atualizado (GroupElement + schema + AnyElement) |
| `src/stores/editor-store.ts`         | Atualizado (groupSelected, ungroupSelected, triggers) |
| `src/editor/core/element-factory.ts` | Atualizado (createGroupObject, group case nos switches) |
| `src/hooks/use-keyboard-shortcuts.ts` | Atualizado (handleGroup, handleUngroup, Ctrl+G/Shift+G) |
| `src/components/editor/top-toolbar.tsx` | Atualizado (Group/Ungroup buttons)           |
| `src/components/editor/layers-panel.tsx` | Atualizado (group icon + child count)       |
| `src/components/editor/canvas-area.tsx` | Atualizado (triggeredGroup/Ungroup effects)  |

### Observacoes

- Fabric.js `Group` gerencia nativamente transformacoes conjuntas; o store apenas armazena o bounding box do grupo
- Ao desagrupar, posicoes absolutas dos filhos sao extraidas do Fabric Group (refletem qualquer transformacao aplicada ao grupo)
- Grupos aninhados (group dentro de group) sao suportados pela natureza recursiva de Fabric.js Groups
- `childElements` no GroupElement e um array plano de `AnyElement`; nao ha validacao Zod profunda para evitar recursao circular
- Clipboard/duplicate de grupos usa shallow copy — geracao de novos IDs para children pode ser refinada em etapa futura
- `subTargetCheck: false` no Group impede selecao individual de elementos dentro do grupo (comportamento esperado para edicao)

---

## ETAPA 21 — Image Crop

### Status: CONCLUIDA

### Objetivo
Implementar crop nao destrutivo para imagens, permitindo reposicionar a imagem dentro do frame e editar o crop posteriormente, preservando o asset original.

### Implementado

- **Sync bidirecional de crop** (`src/editor/core/element-factory.ts`):
  - `syncElementToFabric`: adicionado `case 'image'` que sincroniza `cropX`, `cropY`, `flipX`, `flipY` do store para o FabricImage
  - Corrigida lacuna onde propriedades de crop/flip nunca eram propagadas de volta ao Fabric
  - `extractElementUpdates` ja extraia `cropX`, `cropY`, `flipX`, `flipY` do FabricImage
- **Crop mode state** (`src/stores/editor-store.ts`):
  - `cropModeElementId: string | null` — ID da imagem em modo crop
  - `cropModeSnapshot: { cropX, cropY, width, height } | null` — snapshot pre-crop para cancelamento
  - `setCropMode(elementId, snapshot?)` — ativa/desativa modo crop
- **Crop controls no Right Panel** (`src/components/editor/right-panel.tsx`):
  - Secao "Crop" exibida ao selecionar uma imagem
  - Botao "Crop" — entra em modo crop (salva snapshot)
  - **Modo crop ativo**: botoes Apply (check verde) e Cancel (X), + campos cX/cY
    - Apply: sai do modo crop preservando alteracoes
    - Cancel: restaura cropX, cropY, width, height do snapshot
  - Campos **cX** (cropX) e **cY** (cropY): NumberInput editando offset da imagem original
  - `pushHistoryDebounced` chamado no Apply para suporte a undo/redo
- **Crop interaction no canvas** (`src/hooks/use-canvas.ts`):
  - Efeito dedicado que intercepta eventos Fabric quando `cropModeElementId` esta ativo:
    - `mouse:down`: armazena anchor position + cropX/cropY originais do FabricImage
    - `object:moving`: converte delta de posicao em alteracao de cropX/cropY
      - Delta ajustado por `scaleX`/`scaleY` (cropX e em coordenadas da imagem original)
      - `left`/`top` do FabricImage sao resetados ao anchor (frame nao se move)
      - Store atualizada em tempo real via `updateElement`
    - `mouse:up`: limpa referencia ao objeto crop
  - Cleanup: `canvas.off()` em todos os eventos no unmount
- **Resize do crop frame**: handles de redimensionamento do FabricImage permanecem funcionais em modo crop (via ETAPA 05) — `width`/`height` ja sao controlados pela secao Size do painel
- **Nao-destrutivo**: asset original (`src`) nunca e modificado; apenas `cropX`/`cropY`/`width`/`height` mudam

### Criterios de aceite

- [x] Crop nao destrutivo (asset original preservado)
- [x] Reposicionar imagem dentro do frame (drag em modo crop ajusta cropX/cropY)
- [x] Aplicar crop (Apply persiste alteracoes)
- [x] Editar crop posteriormente (re-entrar em crop mode via botao no painel)
- [x] Cancelar crop restaura valores originais

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/editor/core/element-factory.ts` | Atualizado (case 'image' no syncElementToFabric)  |
| `src/stores/editor-store.ts`         | Atualizado (cropModeElementId, cropModeSnapshot, setCropMode) |
| `src/components/editor/right-panel.tsx` | Atualizado (crop section com Apply/Cancel/cX/cY) |
| `src/hooks/use-canvas.ts`            | Atualizado (crop drag interaction effect)         |

### Observacoes

- Fabric.js v6 usa `cropX`/`cropY` como offsets em coordenadas da imagem original; `width`/`height` do FabricImage definem o frame visivel
- `ImageElement.cropWidth`/`cropHeight` armazenam as dimensoes naturais originais no modelo (redundantes com `width`/`height` apos crop, mantidos para compatibilidade)
- O drag em modo crop inverte o sinal do delta (mover frame para direita → cropX diminui, revelando regiao mais a esquerda da imagem)
- Target check `active.type !== 'image'` impede crop mode em elementos nao-imagem
- `flipX`/`flipY` sao sincronizados via `syncElementToFabric` (corrigidos nesta etapa) mas ainda nao possuem UI dedicada

---

## ETAPA 22 — Image Filters

### Status: CONCLUIDA

### Objetivo
Implementar filtros de imagem nao-destrutivos (brightness, contrast, saturation, blur, grayscale) com controles no painel de propriedades.

### Implementado

- **ImageFilters type** (`src/types/index.ts`):
  - `ImageFilters` interface: `{ brightness, contrast, saturation, blur: number; grayscale: boolean }`
  - `ImageFiltersSchema` — Zod schema com validacao de tipos
  - `ImageElement.filters: ImageFilters` adicionado ao modelo (schema + interface)
- **Filter helpers** (`src/editor/core/element-factory.ts`):
  - `applyImageFilters(image, filtersConfig)`: limpa `image.filters`, instancia filtros Fabric.js com valores nao-neutros, chama `image.applyFilters()`
    - `brightness !== 0` → `new filters.Brightness({ brightness })`
    - `contrast !== 0` → `new filters.Contrast({ contrast })`
    - `saturation !== 0` → `new filters.Saturation({ saturation })`
    - `blur !== 0` → `new filters.Blur({ blur })`
    - `grayscale === true` → `new filters.Grayscale({ mode: 'average' })`
  - `extractImageFilters(image)`: percorre `image.filters`, detecta instancias via `instanceof`, retorna `ImageFilters`
  - Filtros neutros (valor 0/false) nao sao instanciados — Fabric.js `isNeutralState()` ja os ignoraria
- **createImageObject** — chama `applyImageFilters(image, element.filters)` apos criar FabricImage
- **extractElementUpdates** — case `'image'` agora extrai `filters: extractImageFilters(image)`
- **syncElementToFabric** — case `'image'` agora chama `applyImageFilters(image, element.filters)`
- **Inicializacao de filtros** (`src/components/editor/canvas-area.tsx`):
  - `insertImage()` inicializa `filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false }`
- **Filter controls no Right Panel** (`src/components/editor/right-panel.tsx`):
  - Nova secao "Filters" exibida para elementos do tipo imagem
  - **Br (Brightness)**: range slider -100 a +100, mapeado para -1 a 1
  - **Ct (Contrast)**: range slider -100 a +100, mapeado para -1 a 1
  - **St (Saturation)**: range slider -100 a +100, mapeado para -1 a 1
  - **Bl (Blur)**: range slider 0 a 100, mapeado para 0 a 1
  - **Gy (Grayscale)**: botao toggle On/Off com estado ativo em azul
  - Cada alteracao: `handleChange({ filters: { ...imageEl.filters, [key]: value } })` → `pushHistoryDebounced` + sync via efeito
- **Nao-destrutivo**: filtros sao aplicados em tempo de renderizacao pelo pipeline do Fabric.js; pixels originais do asset nunca sao alterados

### Criterios de aceite

- [x] Brightness editavel (-1 a 1)
- [x] Contrast editavel (-1 a 1)
- [x] Saturation editavel (-1 a 1)
- [x] Blur editavel (0 a 1)
- [x] Grayscale toggle (On/Off)
- [x] Processamento nao-destrutivo (filtros Fabric.js via pipeline, asset original preservado)
- [x] Filtros persistem no estado (store ↔ canvas ↔ rebuild)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/types/index.ts`                 | Atualizado (ImageFilters + schema + ImageElement) |
| `src/editor/core/element-factory.ts` | Atualizado (applyImageFilters, extractImageFilters, integracao nos 3 metodos) |
| `src/components/editor/right-panel.tsx` | Atualizado (Filters section com 5 controles)   |
| `src/components/editor/canvas-area.tsx` | Atualizado (inicializacao de filters default)  |

### Observacoes

- Fabric.js v6 exporta filtros via namespace `filters` (`import { filters } from 'fabric'`); classes acessiveis como `filters.Brightness`, `filters.Blur`, etc.
- `filters.Grayscale` suporta 3 modos (`average`, `lightness`, `luminosity`); implementacao usa `average` como default
- Filtros com valor neutro (0) nao sao adicionados ao array `image.filters` para evitar processamento desnecessario
- `applyImageFilters` limpa o array e recria do zero em cada chamada (simples e deterministico)
- `handleChange` faz spread do objeto `filters` existente para preservar outros valores ao alterar um slider

---

## ETAPA 23 — Font System

### Status: CONCLUIDA

### Objetivo
Implementar sistema de fontes com fontes padrao, integracao Google Fonts, loading assincrono, fallback e atualizacao de metricas apos carregamento.

### Implementado

- **Font Loader** (`src/lib/font-loader.ts`):
  - `SYSTEM_FONTS`: 7 fontes do sistema (Arial, Helvetica, Times New Roman, Georgia, Verdana, Courier New, Impact)
  - `GOOGLE_FONTS`: 15 fontes populares do Google Fonts (Roboto, Open Sans, Montserrat, Lato, Poppins, Oswald, Raleway, Inter, DM Sans, Nunito, Ubuntu, Playfair Display, Merriweather, PT Serif, Lora, Bebas Neue, Anton, Righteous, Pacifico, Caveat, Source Code Pro, Fira Code)
  - `ALL_FONTS`: concatenacao de system + Google Fonts
  - `isGoogleFont(family)`: verifica se a fonte requer carregamento
  - `loadGoogleFont(family)`: adiciona `<link>` ao Google Fonts CSS API, aguarda `document.fonts.load('12px "Family"')`, retorna `Promise<boolean>`
  - `isFontLoaded(family)`: verifica se a fonte ja foi carregada (system fonts sempre retornam `true`)
  - `getFontFallback(family)`: retorna fallback chain (ex: `"Roboto", Arial, sans-serif`)
  - Cache de fontes carregadas via `Set<string>` + `Map<string, HTMLLinkElement>` para evitar duplicacao
- **Store** (`src/stores/editor-store.ts`):
  - `fontReloadVersion: number` — contador incrementado quando uma fonte termina de carregar
  - `triggerFontReload()` — setter que incrementa o contador
- **Right Panel — Font Selector atualizado** (`src/components/editor/right-panel.tsx`):
  - Substituiu FONT_FAMILIES estatica por ALL_FONTS (system + Google)
  - Select com `<optgroup>` separando "System Fonts" e "Google Fonts"
  - Cada opcao usa `style={{ fontFamily: f.family }}` para preview visual da fonte
  - `handleFontChange(family)`: ao selecionar Google Font, chama `loadGoogleFont()` com loading state
  - Indicador de loading: `Loader2` spinner ao lado do select enquanto a fonte carrega
  - Select desabilitado (`disabled`) durante carregamento
  - Apos carregamento bem-sucedido: `triggerFontReload()` incrementa versao
  - Fontes Google nao carregadas mostram sufixo " ..." no nome
- **Canvas re-render apos font load** (`src/components/editor/canvas-area.tsx`):
  - `useEffect` observa `fontReloadVersion` — quando incrementado, chama `canvas.requestRenderAll()`
  - Fabric.js re-mede automaticamente textos com a nova fonte disponivel no `requestRenderAll`
- **Fallback**: system fonts nao requerem carregamento; Google Fonts com fallback CSS chain via `getFontFallback()`

### Criterios de aceite

- [x] Fontes padrao disponiveis (7 system fonts)
- [x] Integracao Google Fonts (15 fontes populares)
- [x] Loading assincrono com `document.fonts.load()`
- [x] Indicador visual de loading no font selector
- [x] Fallback (system fonts nao precisam de load; Google Fonts usam link CSS com fallback chain)
- [x] Canvas re-render apos carregamento da fonte (metricas atualizadas)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/lib/font-loader.ts`             | Criado (modulo de carregamento de fontes)         |
| `src/stores/editor-store.ts`         | Atualizado (fontReloadVersion + triggerFontReload) |
| `src/components/editor/right-panel.tsx` | Atualizado (font selector com Google Fonts + loading) |
| `src/components/editor/canvas-area.tsx` | Atualizado (font reload canvas re-render)       |

### Observacoes

- Google Fonts sao carregadas via CSS API (`fonts.googleapis.com/css2`) com weights 400 e 700
- `document.fonts.load()` e suportado em todos os navegadores modernos (Chrome, Firefox, Safari, Edge)
- Fontes ja carregadas sao cacheadas em `Set<string>` — reloads nao duplicam `<link>` elements
- Loading state e por fonte individual (`loadingFont` state no componente) — select desabilitado apenas durante o load dessa fonte especifica
- `fontReloadVersion` nao faz rebuild completo do canvas (apenas `requestRenderAll`), preservando objetos sem custo de recriacao
- Fontes com `display=swap` no link CSS garantem que texto aparece imediatamente com fallback durante o carregamento

---

## ETAPA 24 — Background

### Status: CONCLUIDA

### Objetivo
Implementar background da pagina com suporte a cor solida, imagem, gradiente linear e gradiente radial, tratado separadamente dos elementos comuns.

### Implementado

- **PageBackground type** (`src/types/index.ts`):
  - `BackgroundTypeSchema`: enum `'none' | 'color' | 'image' | 'linear-gradient' | 'radial-gradient'`
  - `GradientStopSchema`: `{ offset: number; color: string }`
  - `PageBackgroundSchema`: `{ type, color, src, assetId, gradientStops, direction }`
  - Interfaces correspondentes exportadas: `BackgroundType`, `GradientStop`, `PageBackground`
- **Store** (`src/stores/editor-store.ts`):
  - `pageBackground: PageBackground` — estado do background da pagina
  - Default: `type: 'color', color: '#ffffff'` (fundo branco como antes)
  - `setPageBackground(bg)` — setter para atualizar o background
- **Canvas background sync** (`src/hooks/use-canvas.ts`):
  - `useEffect` reativo observa `pageBackground` via `useEditorStore(s => s.pageBackground)`
  - Aplica ao Fabric.js canvas conforme o tipo:
    - **none**: `canvas.backgroundColor = ''`, `canvas.backgroundImage = undefined` (transparente)
    - **color**: `canvas.backgroundColor = color` (CSS string)
    - **image**: `canvas.backgroundImage = FabricImage.fromURL(src)` (async), fallback `backgroundColor` enquanto carrega
    - **linear-gradient**: `canvas.backgroundColor = new Gradient({ type: 'linear', coords: { x1:0,y1:0, x2:sin(angle),y2:cos(angle) }, colorStops })`
    - **radial-gradient**: `canvas.backgroundColor = new Gradient({ type: 'radial', coords: { x1:0.5,y1:0.5,r1:0, x2:0.5,y2:0.5,r2:0.5 }, colorStops })`
  - `canvas.requestRenderAll()` apos cada alteracao
- **Background controls no Right Panel** (`src/components/editor/right-panel.tsx`):
  - Quando nenhum elemento esta selecionado, painel mostra "Page" (antes: "Select an element")
  - Secao "Background" com:
    - **Type**: `<select>` com None / Solid Color / Image / Linear Gradient / Radial Gradient
    - **Color** ('color'): color picker + valor hex
    - **URL** ('image'): input de texto para URL da imagem
    - **St / En** (gradient): color pickers para cor inicial (Start) e final (End) dos stops
    - **Dir** ('linear-gradient'): range slider 0-360° para direcao do gradiente
  - `handleBackgroundChange(updates)`: faz merge com estado atual via spread
- **Separacao dos elementos**: background e propriedade do canvas/Fabric.js (`backgroundColor`/`backgroundImage`), nao um elemento na lista de camadas — tratado separadamente como especificado

### Criterios de aceite

- [x] Solid color (color picker, aplicado ao canvas)
- [x] Image (URL input, carregado como `backgroundImage`)
- [x] Linear gradient (start/end colors + direction angle)
- [x] Radial gradient (start/end colors, centro 50%)
- [x] Background tratado separadamente dos elementos comuns (nao aparece na lista de camadas)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/types/index.ts`                 | Atualizado (BackgroundType, GradientStop, PageBackground + schemas) |
| `src/stores/editor-store.ts`         | Atualizado (pageBackground + setPageBackground)   |
| `src/hooks/use-canvas.ts`            | Atualizado (background sync effect)               |
| `src/components/editor/right-panel.tsx` | Atualizado (Page properties com background controls) |

### Observacoes

- Fabric.js v6 `backgroundColor` aceita `TFiller` (string | Gradient | Pattern); gradientes sao instanciados via `new Gradient({...})`
- `canvas.backgroundImage` aceita `FabricObject`; carregamento assincrono via `FabricImage.fromURL()`
- Background image nao oferece file picker — usa input de URL para simplicidade; upload local pode ser adicionado em etapa futura
- Gradientes usam `gradientUnits: 'percentage'` (default do Fabric.js v6); coords em [0,1] representam % do canvas
- Linear gradient: direcao 0° = top-to-bottom (x2=0, y2=1); 90° = left-to-right (x2=1, y2=0)
- O hardcoded `backgroundColor: '#ffffff'` na inicializacao do canvas foi mantido como fallback; o efeito de sync sobrescreve com o valor do store assim que o canvas fica pronto

---

## ETAPA 25 — Multiple Pages

### Status: CONCLUIDA

### Objetivo
Implementar estrutura de projeto com multiplas paginas (Project → Pages → Elements), com operacoes de criar, deletar, duplicar, alternar e renomear paginas.

### Implementado

- **PageData type** (`src/types/index.ts`):
  - `PageDataSchema`: Zod schema com `{ id, name, width, height, background, elements }`
  - `PageData` interface correspondente
  - Cada pagina possui seu proprio `PageBackground` e `elements: AnyElement[]`
- **Store — sistema de paginas** (`src/stores/editor-store.ts`):
  - `pages: PageData[]` — array com todas as paginas do projeto
  - `activePageId: string` — ID da pagina ativa
  - Pagina inicial: `{ id: 'page-1', name: 'Page 1', width: 1080, height: 1080, ... }`
  - **`setActivePage(id)`**: salva `elements` + `pageBackground` atuais na pagina corrente, carrega dados da nova pagina, incrementa `rebuildCanvasVersion` para rebuild do canvas
  - **`createPage()`**: salva pagina atual, cria nova pagina 1080x1080 com fundo branco vazio, adiciona ao array, troca para ela
  - **`deletePage(id)`**: remove pagina do array (nao permite deletar a ultima pagina); se deletar a ativa, troca para a primeira
  - **`duplicatePage(id)`**: deep clone da pagina com novos IDs para elementos, insere logo apos a original no array, troca para a copia
  - **`renamePage(id, name)`**: atualiza o nome da pagina no array
  - **Sync automatico**: `setElements` agora salva no `pages` da pagina ativa; `setPageBackground` tambem
- **Page tabs no footer** (`src/components/editor/footer-status.tsx`):
  - Substituiu "Page 1" estatico por tabs interativas com todas as paginas
  - **Tab clicavel**: troca para a pagina (`setActivePage`)
  - **Double-click no nome**: ativa modo de renomear (input inline com Enter para confirmar, Escape para cancelar)
  - **Botao X no hover**: deleta pagina (escondido se apenas 1 pagina)
  - **Botao +**: adiciona nova pagina
  - Tab ativa destacada com `bg-muted text-foreground font-medium`
  - Dimensoes da pagina ativa exibidas (`1080 × 1080`) ao lado das tabs
  - Zoom controls mantidos no lado direito
- **Canvas rebuild**: `setActivePage`, `createPage`, `deletePage`, `duplicatePage` incrementam `rebuildCanvasVersion` automaticamente, disparando o efeito de rebuild em canvas-area.tsx

### Criterios de aceite

- [x] Create page (botao +, nova pagina vazia)
- [x] Delete page (botao X no hover do tab, nao permite deletar unica pagina)
- [x] Duplicate page (deep clone com novos element IDs, troca para copia)
- [x] Switch page (clique no tab)
- [x] Rename page (double-click no nome → input inline)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/types/index.ts`                 | Atualizado (PageData + schema)                    |
| `src/stores/editor-store.ts`         | Atualizado (pages, activePageId, 5 page actions, sync em setElements/setPageBackground) |
| `src/components/editor/footer-status.tsx` | Reescrito (page tabs + rename + controles)    |

### Observacoes

- `elements` no store continua sendo o array da pagina ativa (backward compatible) — todas as operacoes existentes (addElement, removeElement, updateElement, etc.) funcionam sem alteracao
- `setElements` e `setPageBackground` salvam automaticamente no `pages` da pagina ativa, garantindo que undo/redo e alteracoes de background persistem ao trocar de pagina
- `duplicatePage` gera novos IDs para todos os elementos duplicados via `map(el => ({ ...el, id: generateId() }))`
- Paginas mantem dimensoes independentes (width/height) e background proprio — preparacao para ETAPA 26 (Format Presets)
- O `rebuildCanvasVersion` incrementa automaticamente na troca de pagina, disparando o `useEffect` existente em canvas-area.tsx que limpa e recria todos os FabricObjects

---

## ETAPA 26 — Format Presets

### Status: CONCLUIDA

### Objetivo
Implementar presets de formato (1080x1080, 1080x1350, 1080x1920, 1200x628, 1280x720) e dimensoes customizadas para criacao de paginas.

### Implementado

- **Format presets** (`src/components/editor/footer-status.tsx`):
  - `FORMAT_PRESETS` constante com 5 presets:
    - Instagram Square: 1080 × 1080
    - Instagram Portrait: 1080 × 1350
    - Stories / Reels: 1080 × 1920
    - Facebook Landscape: 1200 × 628
    - YouTube Thumbnail: 1280 × 720
  - Cada preset exibe nome + dimensoes no popup
  - Ao clicar em um preset: `createPage(width, height)` com as dimensoes correspondentes
- **Custom dimensions** (no mesmo popup):
  - Dois inputs numericos (W × H) com placeholder e min=1
  - Botao "OK" para confirmar dimensoes customizadas
  - Validacao: width > 0 e height > 0
- **Popup UI**:
  - Clicar no botao "+" abre popup `absolute` acima do botao (posicionado `bottom-full`)
  - Popup contem: titulo "New Page", lista de presets, separador, secao "Custom" com inputs
  - Fecha ao clicar em um preset, ao confirmar custom, ou ao clicar fora (click outside handler)
  - Popup com `z-50`, borda, sombra, background card
- **Store** (`src/stores/editor-store.ts`):
  - `createPage(width?, height?)` — parametros opcionais; default 1080 × 1080 quando omitidos
  - Dimensoes armazenadas em `PageData.width` / `PageData.height` da nova pagina
  - Exibidas no footer (`{activePage.width} × {activePage.height}`)

### Criterios de aceite

- [x] Presets: 1080×1080, 1080×1350, 1080×1920, 1200×628, 1280×720
- [x] Dimensoes customizadas (inputs W × H + botao OK)
- [x] Criar pagina com dimensoes do preset selecionado
- [x] Dimensoes armazenadas e exibidas no footer

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/stores/editor-store.ts`         | Atualizado (createPage com width/height opcionais) |
| `src/components/editor/footer-status.tsx` | Atualizado (format presets popup + custom dims) |

### Observacoes

- As dimensoes da pagina sao armazenadas em `PageData` mas o canvas logico permanece fixo em 1080×1080 — resize dinamico do canvas por pagina sera abordado em uma etapa futura de Smart Resize
- O popup usa posicionamento absolute relativo ao botao `+` e click-outside detection via `mousedown` listener no document
- `createPage()` sem argumentos mantem comportamento anterior (1080×1080 default) — backward compatible com o botao `+` original

---

## ETAPA 27 — Local Persistence

### Status: CONCLUIDA

### Objetivo
Implementar salvamento local estruturado usando IndexedDB para dados do projeto e localStorage para metadados, com tratamento adequado de assets de imagem (blob → data URL).

### Implementado

- **IndexedDB persistence** (`src/lib/persistence.ts`):
  - `openDB()`: abre/atualiza database `creative-editor` v1 com object store `projects` (keyPath: id)
  - `saveProjectData(id, name, data)`: salva registro com id, name, data (JSON string), updatedAt
  - `loadProjectData(id)`: carrega registro com todos os campos
  - `deleteProjectData(id)`: remove registro
  - `listProjects()`: retorna `ProjectListItem[]` com id, name, updatedAt
  - Todas as operacoes sao assincronas com Promises + tratamento de transacao
- **Project serializer** (`src/lib/project-serializer.ts`):
  - `SerializedProject`: `{ id, name, pages, activePageId, version, createdAt, updatedAt }`
  - `serializeProject(id, name, pages, ...)`: converte estado do store para formato serializavel
    - Converte ImageElement com `src: blob:...` → data URL via `fetch()` + `FileReader.readAsDataURL()`
    - Processa todas as paginas (ativa + inativas) em paralelo com `Promise.all`
  - Formato JSON armazenado como string no IndexedDB
- **Store — gerenciamento de projeto** (`src/stores/editor-store.ts`):
  - `projectId: string` — ID unico do projeto (gerado na inicializacao)
  - `projectName: string` — nome editavel do projeto (default: "Untitled Project")
  - `saveStatus: 'saved' | 'unsaved' | 'saving' | 'error'` — estado do save
  - `saveProject()`: serializa via `serializeProject()`, salva em IndexedDB, atualiza `saveStatus`
  - `loadProject(id)`: carrega do IndexedDB, faz parse do JSON, substitui pages/elements/background/activePageId, dispara rebuild
  - `newProject()`: reseta para estado limpo com novo projectId, 1 pagina vazia
  - `setProjectName(name)`: atualiza nome do projeto
  - `markUnsaved()`: seta `saveStatus = 'unsaved'`
- **Auto-save hook** (`src/hooks/use-auto-save.ts`):
  - `useAutoSave()`: hook chamado em `page.tsx`
  - Observa `elements`, `pages`, `pageBackground`, `projectName` via seletor Zustand
  - Ignora primeira renderizacao (`isFirstRender` ref)
  - Na mudanca: chama `markUnsaved()` + inicia timer debounce de 2s
  - Timer resetado a cada nova mudanca (reinicia a contagem)
  - Ao disparar: chama `saveProject()` via `useEditorStore.getState()`
- **Toolbar — project name + save status** (`src/components/editor/top-toolbar.tsx`):
  - Nome do projeto exibido com Double-click para renomear (input inline + Enter/Escape)
  - Indicador de save status:
    - `saved`: icone Check verde
    - `unsaved`: circulo ambar ●
    - `saving`: spinner Loader2 animado
    - `error`: AlertCircle vermelho (destructive)
- **Asset handling**: blob URLs de imagens sao convertidas para data URLs antes de salvar, garantindo que o projeto possa ser recarregado mesmo apos as object URLs originais expirarem

### Criterios de aceite

- [x] Salvamento local estruturado (IndexedDB)
- [x] Metadados (id, name, createdAt, updatedAt)
- [x] Projetos (pages, elements, background serializados)
- [x] Assets (imagens convertidas de blob: para data URL)
- [x] Nao guardar grandes imagens arbitrariamente em localStorage (IndexedDB usado)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/lib/persistence.ts`             | Criado (IndexedDB wrapper)                        |
| `src/lib/project-serializer.ts`      | Criado (serializacao + blob→dataURL)              |
| `src/stores/editor-store.ts`         | Atualizado (projectId, projectName, saveStatus, save/load/new/markUnsaved) |
| `src/hooks/use-auto-save.ts`         | Criado (debounced auto-save hook)                 |
| `src/components/editor/top-toolbar.tsx` | Atualizado (project name editavel + save status) |
| `src/app/page.tsx`                   | Atualizado (useAutoSave hook)                     |

### Observacoes

- IndexedDB armazena cada projeto como um registro com key = projectId; suporta multiplos projetos
- `blobUrlToDataUrl` usa `fetch` + `FileReader` para converter blob URLs em data URLs; fallback retorna a URL original em caso de erro
- O auto-save usa debounce de 2 segundos — evita salvar a cada modificacao individual durante edicao
- `useAutoSave` usa `useEditorStore.getState()` diretamente no setTimeout para evitar dependencias circulares de hook
- A listagem de projetos (`listProjects`) esta implementada mas nao possui UI dedicada — sera usada em etapa futura de dashboard/project picker

---

## ETAPA 28 — Autosave

### Status: CONCLUIDA

### Objetivo
Implementar mecanismo de autosave com dirty state, debounce e estados de saving/saved/error, evitando salvar a cada movimento do mouse.

### Implementado

- **Dirty state** (`useAutoSave` hook):
  - `saveStatus: 'unsaved'` setado via `markUnsaved()` quando elementos, paginas, background ou nome do projeto mudam
  - Seta apenas se ja nao estiver `'unsaved'` (evita re-renders desnecessarios)
- **Debounce** (2 segundos):
  - Timer iniciado/resetado a cada mudanca de estado
  - `saveProject()` chamado apos 2s de inatividade
  - Cleanup do timer no unmount e a cada nova mudanca
- **Saving state**:
  - `saveStatus: 'saving'` setado no inicio de `saveProject()`
  - Evita que o efeito de auto-save dispare novo save enquanto um ja esta em andamento
- **Saved state**:
  - `saveStatus: 'saved'` setado apos `saveProject()` concluir com sucesso
  - Indicado por icone Check verde na toolbar
- **Error state**:
  - `saveStatus: 'error'` setado no catch de `saveProject()`
  - Indicado por icone AlertCircle vermelho na toolbar
- **Evitar saves durante mouse move**:
  - `object:modified` do Fabric.js dispara apenas no FINAL de uma transformacao (nao durante mousemove) — sem saves durante drag
  - Crop mode: hook verifica `cropModeElementId !== null` e pula o `markUnsaved` durante crop dragging, evitando disparos por frame
  - Arrow keys: 2s debounce agrupa multiplas pressionamentos em um unico save
- **Primeira renderizacao ignorada**: `isFirstRender` ref previne que a carga inicial do estado dispare save

### Criterios de aceite

- [x] Dirty state (saveStatus: unsaved ao modificar elementos)
- [x] Debounce (2s de inatividade antes do save)
- [x] Saving state (saveStatus: saving durante operacao)
- [x] Saved state (saveStatus: saved apos sucesso)
- [x] Error state (saveStatus: error em caso de falha)
- [x] Nao salvar a cada movimento do mouse (object:modified so no final + crop mode skip)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/hooks/use-auto-save.ts`         | Refinado (crop mode skip + idempotent markUnsaved) |

### Observacoes

- A infraestrutura de persistencia (IndexedDB + serializacao) foi implementada na ETAPA 27; esta etapa refina o mecanismo de autosave com os estados especificos e otimizacoes
- `store.cropModeElementId` e verificado antes de chamar `markUnsaved`: durante crop dragging, `updateElement` e chamado a cada frame mas o autosave nao e acionado
- O debounce de 2s e consistente com o SPEC.md #38 (autosave com debounce)
- Estados sao exibidos na toolbar via icones: Check (saved), ● ambar (unsaved), Loader2 (saving), AlertCircle (error)

---

## ETAPA 29 — Export

### Status: CONCLUIDA

### Objetivo
Implementar exportacao de canvas em PNG, JPG e WEBP com escalas 1x, 2x e 3x, excluindo guides, selections, handles e overlays.

### Implementado

- **Export utility** (`src/lib/export-utils.ts`):
  - `ExportFormat`: tipo `'png' | 'jpeg' | 'webp'`
  - `ExportOptions`: `{ format, scale }`
  - `getExportFileName(format)`: gera nome de arquivo (ex: `creative-2026-08-10.png`)
  - `downloadDataUrl(dataUrl, fileName)`: cria `<a>` temporario, clica, remove — dispara download
- **Store — export trigger** (`src/stores/editor-store.ts`):
  - `triggeredExport: number` — contador incrementado a cada solicitacao
  - `exportFormat: 'png' | 'jpeg' | 'webp'` — formato selecionado
  - `exportScale: number` — escala (1, 2, ou 3)
  - `triggerExport(format, scale)` — setter que incrementa contador + define formato/escala
- **Canvas export effect** (`src/components/editor/canvas-area.tsx`):
  - `useEffect` observa `triggeredExport` — quando incrementado:
    1. `canvas.discardActiveObject()` — remove selecao/handles do output
    2. `canvas.requestRenderAll()` — garante render limpo
    3. `canvas.toDataURL({ format, quality, multiplier })` — exporta com parametros
       - JPG: qualidade 0.95
       - PNG/WEBP: qualidade 1 (lossless)
    4. `downloadDataUrl(dataUrl, fileName)` — dispara download
  - Guides ja possuem `excludeFromExport: true` — nao aparecem na exportacao
  - `discardActiveObject()` garante que selection borders/handles nao aparecem
- **Export button na toolbar** (`src/components/editor/top-toolbar.tsx`):
  - Botao Export com icone Download, funcional (antes era disabled placeholder)
  - Popup dropdown com 3 secoes:
    - **Format**: PNG 1x, JPG 1x, WEBP 1x — export imediato
    - **Scale**: PNG @2x, PNG @3x — export em alta resolucao
  - Cada opcao mostra formato + escala/dimensoes
  - Popup fecha ao selecionar ou clicar fora (click-outside handler)

### Criterios de aceite

- [x] PNG export (lossless)
- [x] JPG export (qualidade 95%)
- [x] WEBP export (lossless)
- [x] Escala 1x (1080 × 1080 default)
- [x] Escala 2x (2160 × 2160)
- [x] Escala 3x (3240 × 3240)
- [x] Guides nao exportados (`excludeFromExport: true`)
- [x] Selections/handles nao exportados (`discardActiveObject` antes do export)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/lib/export-utils.ts`            | Criado (download + fileName helpers)              |
| `src/stores/editor-store.ts`         | Atualizado (triggeredExport, exportFormat, exportScale, triggerExport) |
| `src/components/editor/canvas-area.tsx` | Atualizado (export effect)                     |
| `src/components/editor/top-toolbar.tsx` | Atualizado (Export button com dropdown)        |

### Observacoes

- Fabric.js `toDataURL({ multiplier })` renderiza o canvas em resolucao maior; a qualidade visual depende dos assets originais (imagens em baixa resolucao podem nao se beneficiar de 3x)
- JPG usa qualidade 95% para equilibrio entre tamanho de arquivo e qualidade visual
- WEBP export a 1x e sem perdas (quality=1); para quality lossy < 1 pode ser adicionado em etapa futura
- O export nao altera nenhum estado da store — apenas le o canvas, exporta e faz download
- `discardActiveObject()` e chamado antes do export e NAO re-seleciona o objeto apos (export e operacao de leitura)

---

## ETAPA 30 — UI/UX Polish

### Status: CONCLUIDA

### Objetivo
Revisar aplicacao completa, adicionando tooltips, context menu, loading states, empty states, feedback, acessibilidade basica, estados disabled e acabamento visual.

### Implementado

- **Context menu** (`src/components/editor/context-menu.tsx`):
  - Componente `ContextMenu` reutilizavel com suporte a icones, shortcuts, separadores e estados disabled
  - `ContextMenuItem` interface: `{ label, shortcut, icon, disabled, onClick, separator }`
  - `ICON_MAP`: mapeamento de icones lucide-react (Copy, ClipboardPaste, Trash2, CopyPlus, Group, Ungroup)
  - Posicionamento `fixed` nas coordenadas do clique direito
  - Fecha ao clicar fora (`mousedown` listener) ou pressionar Escape (`keydown` listener)
  - Role `menu` + `menuitem` para acessibilidade basica
  - Estilo: bg-card, borda, sombra, z-index 100
- **Context menu no canvas** (`src/components/editor/canvas-area.tsx`):
  - `handleContextMenu` handler no container do canvas (preventDefault + setPosition)
  - Itens computados via `useMemo` baseado no estado da selecao:
    - **Copy** (Ctrl+C) — enabled com selecao
    - **Paste** (Ctrl+V) — enabled com clipboard nao vazio
    - Separador
    - **Duplicate** (Ctrl+D) — enabled com selecao
    - **Delete** (Del) — enabled com selecao
    - Separador
    - **Group** (Ctrl+G) — enabled com ≥2 selecionados
    - **Ungroup** (Ctrl+Shift+G) — enabled com grupo selecionado
  - Itens disabled com `opacity-30` e `cursor-default`
  - Exportacao de handlers do `useKeyboardShortcuts`: `handleDelete`, `handleDuplicate`, `handleCopy`, `handlePaste`, `handleCut` (alem dos existentes)
- **Canvas loading state**:
  - Overlay com spinner CSS animado + texto "Loading canvas..." enquanto `canvasReady === false`
  - Canvas oculto com `visibility: hidden` durante inicializacao
  - Remove flicker entre loading → render
- **Canvas empty state**:
  - Overlay centralizado com "Empty canvas" + "Add images, text or shapes to get started"
  - Exibido quando `canvasReady && elements.length === 0`
  - `pointer-events-none` para nao bloquear interacao com canvas
- **Tooltips**:
  - Botoes da toolbar ja possuem `title` attributes com shortcuts (ETAPAs anteriores)
  - Botoes de zoom e layers ja possuem tooltips (ETAPAs anteriores)
  - Upload error feedback via tooltip no icone Uploads (ETAPA 06)
- **Acessibilidade basica**:
  - Context menu com `role='menu'` e `role='menuitem'`
  - Botoes com `title` attributes para screen readers
  - Interacao por teclado: Escape fecha context menu, Enter/click executa acao
- **Estados disabled**:
  - Context menu items com `disabled` prop — opacidade reduzida, cursor default
  - Botoes undo/redo, zoom +/- ja possuem estados disabled (ETAPAs 14, 16)
  - Font selector desabilitado durante carregamento de fonte (ETAPA 23)
- **Layout consistente**:
  - Estrutura de 4 areas mantida (toolbar, sidebar, canvas, panel)
  - Footer com page tabs + zoom controls + dimensoes
  - Transicoes suaves (`transition-colors`) em botoes e menus
- **Acabamento visual**:
  - Context menu com sombra (`shadow-lg`), borda arredondada, hover states
  - Spinner CSS animado no loading state
  - Empty state com tipografia hierarquizada

### Criterios de aceite

- [x] Context menu funcional (right-click no canvas)
- [x] Loading state (spinner enquanto canvas inicializa)
- [x] Empty state (mensagem quando canvas vazio)
- [x] Tooltips nos botoes (ja existentes)
- [x] Estados disabled nos itens do menu
- [x] Acessibilidade basica (roles, titles, keyboard)

### Validacoes executadas

| Comando             | Resultado |
|----------------------|-----------|
| `npx tsc --noEmit`   | OK        |
| `npx eslint .`       | OK (1 warning pre-existente) |
| `npx next build`     | OK        |

### Arquivos alterados/criados

| Arquivo                              | Acao                                              |
|--------------------------------------|---------------------------------------------------|
| `src/components/editor/context-menu.tsx` | Criado (componente de menu contextual)         |
| `src/components/editor/canvas-area.tsx` | Atualizado (context menu + loading/empty states) |
| `src/hooks/use-keyboard-shortcuts.ts` | Atualizado (exporta handleDelete/Duplicate/Copy/Paste/Cut) |

### Observacoes

- Context menu e um componente generico reutilizavel; pode ser usado em outros locais (layers panel, elementos) em refinamentos futuros
- `useKeyboardShortcuts` agora exporta todos os handlers, permitindo que outros componentes disparem acoes de teclado programaticamente
- Empty state usa `pointer-events-none` para nao interferir com drag-and-drop ou cliques no canvas
- Loading state e removido automaticamente quando `canvasReady === true`
- O layout manteve a arquitetura existente — sem alteracoes desnecessarias na estrutura (conforme ROADMAP: "Nao alterar arquitetura desnecessariamente")

---

## CHECKPOINT C — MVP (FASE C completa)

Etapas 21-30 concluidas. FASE C — Recursos de Design finalizada.

Funcionalidades da FASE C:
| ETAPA | Nome              | Status    |
|-------|-------------------|-----------|
| 21    | Image Crop        | CONCLUIDA |
| 22    | Image Filters     | CONCLUIDA |
| 23    | Font System       | CONCLUIDA |
| 24    | Background        | CONCLUIDA |
| 25    | Multiple Pages    | CONCLUIDA |
| 26    | Format Presets    | CONCLUIDA |
| 27    | Local Persistence | CONCLUIDA |
| 28    | Autosave          | CONCLUIDA |
| 29    | Export            | CONCLUIDA |
| 30    | UI/UX Polish      | CONCLUIDA |

---
