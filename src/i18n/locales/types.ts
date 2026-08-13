export interface Translations {
  common: {
    cancel: string;
    confirm: string;
    delete: string;
    save: string;
    close: string;
    ok: string;
    yes: string;
    no: string;
  };
  editor: {
    toolbar: {
      undo: string;
      redo: string;
      group: string;
      ungroup: string;
      preview: string;
      export: string;
      rename: string;
      format: string;
      scale: string;
    };
    sidebar: {
      uploads: string;
      text: string;
      elements: string;
      shapes: {
        rectangle: string;
        circle: string;
        line: string;
      };
      images: string;
      layers: string;
      ai: string;
    };
    layers: {
      title: string;
      empty: string;
      bringToFront: string;
      bringForward: string;
      sendBackward: string;
      sendToBack: string;
      hide: string;
      show: string;
      lock: string;
      unlock: string;
    };
    properties: {
      title: string;
      page: string;
      position: string;
      size: string;
      transform: string;
      text: {
        title: string;
        content: string;
        fontSize: string;
        fontFamily: string;
        fontWeight: string;
        normal: string;
        bold: string;
        alignment: string;
        left: string;
        center: string;
        right: string;
        color: string;
        systemFonts: string;
        googleFonts: string;
      };
      shape: {
        title: string;
        fill: string;
        stroke: string;
        strokeWidth: string;
      };
      crop: {
        title: string;
        enterMode: string;
        apply: string;
        cancel: string;
      };
      filters: {
        title: string;
        brightness: string;
        contrast: string;
        saturation: string;
        blur: string;
        grayscale: string;
        on: string;
        off: string;
      };
      background: {
        title: string;
        type: string;
        none: string;
        solidColor: string;
        image: string;
        linearGradient: string;
        radialGradient: string;
        start: string;
        end: string;
        direction: string;
        url: string;
      };
    };
    pages: {
      add: string;
      delete: string;
      deleteConfirm: string;
      newPage: string;
      custom: string;
      presets: {
        instagramSquare: string;
        instagramPortrait: string;
        storiesReels: string;
        facebookLandscape: string;
        youtubeThumbnail: string;
      };
    };
    canvas: {
      loading: string;
      empty: string;
      emptyHint: string;
    };
    contextMenu: {
      copy: string;
      paste: string;
      duplicate: string;
      delete: string;
      group: string;
      ungroup: string;
    };
    save: {
      saving: string;
      saved: string;
      unsaved: string;
      error: string;
    };
    zoom: {
      in: string;
      out: string;
      reset: string;
      fit: string;
    };
    export: {
      format: string;
      scale: string;
      png: string;
      jpg: string;
      webp: string;
    };
    language: {
      label: string;
      ptBR: string;
      en: string;
      es: string;
    };
    ai: {
      detectText: string;
      detecting: string;
      detected: string;
      selectImageHint: string;
      error: {
        requiresSingleImage: string;
        imageFetchFailed: string;
        httpError: string;
        serviceUnavailable: string;
        pageRemoved: string;
        imageRemoved: string;
        alreadyProcessed: string;
        noTextDetected: string;
        allDetectionsFiltered: string;
        inpaintingFailed: string;
        staleResult: string;
        unknown: string;
      };
    };
  };
  textDefault: string;
  pageDefault: string;
  imageDefault: string;
  textLayerDefault: string;
  groupDefault: string;
  uploadError: string;
}

export type Locale = 'pt-BR' | 'en' | 'es';
