import { z } from 'zod';

export const ElementTypeSchema = z.enum(['text', 'image', 'shape']);

export type ElementType = z.infer<typeof ElementTypeSchema>;

export interface EditorElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

export interface TextElement extends EditorElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  fill: string;
  letterSpacing: number;
  lineHeight: number;
}

export interface ImageElement extends EditorElement {
  type: 'image';
  assetId: string;
  src: string;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  flipX: boolean;
  flipY: boolean;
}

export type ShapeType = 'rectangle' | 'circle' | 'line';

export interface ShapeElement extends EditorElement {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type AnyElement = TextElement | ImageElement | ShapeElement;

export interface EditorState {
  elements: AnyElement[];
  selectedElementIds: string[];
}

export const EditorStateSchema = z.object({
  elements: z.array(z.any()),
  selectedElementIds: z.array(z.string()),
});
