import { z } from 'zod';

export const ElementTypeSchema = z.enum(['text', 'image', 'shape']);

export type ElementType = z.infer<typeof ElementTypeSchema>;

export const BaseElementSchema = z.object({
  id: z.string(),
  type: ElementTypeSchema,
  name: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
  opacity: z.number(),
  visible: z.boolean(),
  locked: z.boolean(),
  zIndex: z.number(),
});

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.union([z.number(), z.string()]),
  fontStyle: z.enum(['normal', 'italic']),
  textAlign: z.enum(['left', 'center', 'right']),
  fill: z.string(),
  letterSpacing: z.number(),
  lineHeight: z.number(),
});

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  assetId: z.string(),
  src: z.string(),
  cropX: z.number(),
  cropY: z.number(),
  cropWidth: z.number(),
  cropHeight: z.number(),
  flipX: z.boolean(),
  flipY: z.boolean(),
});

export const ShapeTypeSchema = z.enum(['rectangle', 'circle', 'line']);

export type ShapeType = z.infer<typeof ShapeTypeSchema>;

export const ShapeElementSchema = BaseElementSchema.extend({
  type: z.literal('shape'),
  shapeType: ShapeTypeSchema,
  fill: z.string(),
  stroke: z.string(),
  strokeWidth: z.number(),
});

export const AnyElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
]);

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
  elements: z.array(AnyElementSchema),
  selectedElementIds: z.array(z.string()),
});
