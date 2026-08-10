import type {
  AnyElement,
  TextElement,
  ImageElement,
  ShapeElement,
  ElementType,
} from '@/types';
import {
  FabricText,
  FabricImage,
  Rect,
  Circle,
  Line,
  FabricObject,
  Canvas,
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
    selectable: !element.locked,
    evented: !element.locked,
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
      };
    case 'shape':
      return {
        ...common,
        fill: (fabricObject as Rect | Circle).fill as string,
        stroke: (fabricObject as Rect | Circle).stroke as string,
        strokeWidth: (fabricObject as Rect | Circle).strokeWidth as number,
      };
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
    case 'shape': {
      const shape = element as ShapeElement;
      fabricObject.set({
        fill: shape.fill,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
      });
      break;
    }
  }
}
