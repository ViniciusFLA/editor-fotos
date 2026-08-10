import type {
  AnyElement,
  TextElement,
  ImageElement,
  ShapeElement,
  GroupElement,
  ImageFilters,
  ElementType,
} from '@/types';
import {
  FabricText,
  FabricImage,
  Rect,
  Circle,
  Line,
  Group,
  FabricObject,
  Canvas,
  filters,
} from 'fabric';

const elementIdMap = new WeakMap<FabricObject, string>();

export function setElementId(fabricObject: FabricObject, id: string): void {
  elementIdMap.set(fabricObject, id);
}

export function getElementId(fabricObject: FabricObject): string | undefined {
  return elementIdMap.get(fabricObject);
}

function applyCommonProps(
  element: AnyElement,
  fabricObject: FabricObject,
): void {
  fabricObject.set({
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    scaleX: element.scaleX,
    scaleY: element.scaleY,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    lockMovementX: element.locked,
    lockMovementY: element.locked,
    lockRotation: element.locked,
    lockScalingX: element.locked,
    lockScalingY: element.locked,
    selectable: element.visible && !element.locked,
    evented: element.visible && !element.locked,
  });
}

function extractCommonUpdates(
  fabricObject: FabricObject,
): Partial<AnyElement> {
  return {
    x: fabricObject.left,
    y: fabricObject.top,
    width: fabricObject.width,
    height: fabricObject.height,
    scaleX: fabricObject.scaleX,
    scaleY: fabricObject.scaleY,
    rotation: fabricObject.angle,
    opacity: fabricObject.opacity,
    visible: fabricObject.visible,
  };
}

export function normalizeFabricObject(fabricObject: FabricObject): void {
  const sx = fabricObject.scaleX ?? 1;
  const sy = fabricObject.scaleY ?? 1;

  if (sx !== 1 || sy !== 1) {
    fabricObject.set({
      width: (fabricObject.width ?? 0) * sx,
      height: (fabricObject.height ?? 0) * sy,
      scaleX: 1,
      scaleY: 1,
    });
  }
}

export function createFabricObject(
  element: TextElement,
): FabricText;
export function createFabricObject(
  element: ImageElement,
): Promise<FabricImage>;
export function createFabricObject(
  element: ShapeElement,
): Rect | Circle | Line;
export function createFabricObject(
  element: GroupElement,
): Promise<Group>;
export function createFabricObject(
  element: AnyElement,
): FabricObject | Promise<FabricObject>;
export function createFabricObject(
  element: AnyElement,
): FabricObject | Promise<FabricObject> {
  switch (element.type) {
    case 'text':
      return createTextObject(element);
    case 'image':
      return createImageObject(element);
    case 'shape':
      return createShapeObject(element);
    case 'group':
      return createGroupObject(element);
  }
}

function createTextObject(element: TextElement): FabricText {
  const text = new FabricText(element.text, {
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight as string | number,
    fontStyle: element.fontStyle,
    textAlign: element.textAlign,
    fill: element.fill,
    charSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    left: element.x,
    top: element.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    editable: true,
  });

  setElementId(text, element.id);
  return text;
}

function applyImageFilters(image: FabricImage, filtersConfig: ImageFilters): void {
  image.filters = [];

  if (filtersConfig.brightness !== 0) {
    image.filters.push(new filters.Brightness({ brightness: filtersConfig.brightness }));
  }

  if (filtersConfig.contrast !== 0) {
    image.filters.push(new filters.Contrast({ contrast: filtersConfig.contrast }));
  }

  if (filtersConfig.saturation !== 0) {
    image.filters.push(new filters.Saturation({ saturation: filtersConfig.saturation }));
  }

  if (filtersConfig.blur !== 0) {
    image.filters.push(new filters.Blur({ blur: filtersConfig.blur }));
  }

  if (filtersConfig.grayscale) {
    image.filters.push(new filters.Grayscale({ mode: 'average' }));
  }

  if (image.filters.length > 0) {
    image.applyFilters();
  }
}

function extractImageFilters(image: FabricImage): ImageFilters {
  const result: ImageFilters = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    grayscale: false,
  };

  image.filters.forEach((f) => {
    if (f instanceof filters.Brightness) {
      result.brightness = f.brightness;
    } else if (f instanceof filters.Contrast) {
      result.contrast = f.contrast;
    } else if (f instanceof filters.Saturation) {
      result.saturation = f.saturation;
    } else if (f instanceof filters.Blur) {
      result.blur = f.blur;
    } else if (f instanceof filters.Grayscale) {
      result.grayscale = true;
    }
  });

  return result;
}

async function createImageObject(element: ImageElement): Promise<FabricImage> {
  const image = await FabricImage.fromURL(element.src, undefined, {
    left: element.x,
    top: element.y,
    scaleX: element.scaleX,
    scaleY: element.scaleY,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    cropX: element.cropX,
    cropY: element.cropY,
  });

  setElementId(image, element.id);

  applyImageFilters(image, element.filters);

  return image;
}

function createShapeObject(element: ShapeElement): Rect | Circle | Line {
  const common = {
    left: element.x,
    top: element.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
  };

  let shape: Rect | Circle | Line;

  switch (element.shapeType) {
    case 'rectangle':
      shape = new Rect({
        ...common,
        width: element.width,
        height: element.height,
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: element.strokeWidth,
      });
      break;
    case 'circle': {
      const radius = Math.min(element.width, element.height) / 2;
      shape = new Circle({
        ...common,
        radius,
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: element.strokeWidth,
      });
      break;
    }
    case 'line':
      shape = new Line(
        [element.x, element.y, element.x + element.width, element.y + element.height],
        {
          stroke: element.stroke,
          strokeWidth: element.strokeWidth,
          left: element.x,
          top: element.y,
          angle: element.rotation,
          opacity: element.opacity,
          visible: element.visible,
        },
      );
      break;
  }

  setElementId(shape, element.id);
  return shape;
}

async function createGroupObject(element: GroupElement): Promise<Group> {
  const childObjects = await Promise.all(
    element.childElements.map((child) => {
      const obj = createFabricObject(child);
      if (obj instanceof Promise) return obj;
      return obj;
    }),
  );

  const group = new Group(childObjects, {
    left: element.x,
    top: element.y,
    scaleX: element.scaleX,
    scaleY: element.scaleY,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
  });

  setElementId(group, element.id);
  return group;
}

export function extractElementUpdates(
  fabricObject: FabricObject,
  elementType: ElementType,
): Partial<AnyElement> {
  const common = extractCommonUpdates(fabricObject);

  switch (elementType) {
    case 'text':
      return {
        ...common,
        text: (fabricObject as FabricText).text,
        fontFamily: (fabricObject as FabricText).fontFamily,
        fontSize: (fabricObject as FabricText).fontSize,
        fontWeight: (fabricObject as FabricText).fontWeight,
        fontStyle: (fabricObject as FabricText).fontStyle as 'normal' | 'italic',
        textAlign: (fabricObject as FabricText).textAlign as
          | 'left'
          | 'center'
          | 'right',
        fill: (fabricObject as FabricText).fill as string,
        letterSpacing: (fabricObject as FabricText).charSpacing,
        lineHeight: (fabricObject as FabricText).lineHeight,
      };
    case 'image':
      return {
        ...common,
        cropX: (fabricObject as FabricImage).cropX,
        cropY: (fabricObject as FabricImage).cropY,
        flipX: (fabricObject as FabricImage).flipX,
        flipY: (fabricObject as FabricImage).flipY,
        filters: extractImageFilters(fabricObject as FabricImage),
      };
    case 'shape':
      return {
        ...common,
        fill: (fabricObject as Rect | Circle).fill as string,
        stroke: (fabricObject as Rect | Circle).stroke as string,
        strokeWidth: (fabricObject as Rect | Circle).strokeWidth as number,
      };
    case 'group':
      return common;
  }
}

export function findFabricObjectById(
  canvas: Canvas,
  id: string,
): FabricObject | undefined {
  return canvas.getObjects().find((obj) => getElementId(obj) === id);
}

export function syncElementToFabric(
  element: AnyElement,
  fabricObject: FabricObject,
): void {
  applyCommonProps(element, fabricObject);

  switch (element.type) {
    case 'text': {
      const text = element as TextElement;
      fabricObject.set({
        text: text.text,
        fontFamily: text.fontFamily,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight as string | number,
        fontStyle: text.fontStyle,
        textAlign: text.textAlign,
        fill: text.fill,
        charSpacing: text.letterSpacing,
        lineHeight: text.lineHeight,
      });
      break;
    }
    case 'image': {
      const image = element as ImageElement;
      (fabricObject as FabricImage).set({
        cropX: image.cropX,
        cropY: image.cropY,
        flipX: image.flipX,
        flipY: image.flipY,
      });
      applyImageFilters(fabricObject as FabricImage, image.filters);
      break;
    }
    case 'shape': {
      const shape = element as ShapeElement;
      fabricObject.set({
        fill: shape.fill,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
      });
      break;
    }
    case 'group': {
      break;
    }
  }
}
