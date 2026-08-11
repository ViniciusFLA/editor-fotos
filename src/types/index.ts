import { z } from 'zod';

export const ElementTypeSchema = z.enum(['text', 'image', 'shape', 'group']);

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

export const ImageFiltersSchema = z.object({
  brightness: z.number(),
  contrast: z.number(),
  saturation: z.number(),
  blur: z.number(),
  grayscale: z.boolean(),
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
  filters: ImageFiltersSchema,
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

export const GroupElementSchema = BaseElementSchema.extend({
  type: z.literal('group'),
  childElements: z.array(z.any()),
});

export const AnyElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  GroupElementSchema,
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
  filters: ImageFilters;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: boolean;
}

export interface ShapeElement extends EditorElement {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface GroupElement extends EditorElement {
  type: 'group';
  childElements: AnyElement[];
}

export const BackgroundTypeSchema = z.enum(['none', 'color', 'image', 'linear-gradient', 'radial-gradient']);

export type BackgroundType = z.infer<typeof BackgroundTypeSchema>;

export const GradientStopSchema = z.object({
  offset: z.number(),
  color: z.string(),
});

export type GradientStop = z.infer<typeof GradientStopSchema>;

export const PageBackgroundSchema = z.object({
  type: BackgroundTypeSchema,
  color: z.string(),
  src: z.string(),
  assetId: z.string(),
  gradientStops: z.array(GradientStopSchema),
  direction: z.number(),
});

export interface PageBackground {
  type: BackgroundType;
  color: string;
  src: string;
  assetId: string;
  gradientStops: GradientStop[];
  direction: number;
}

export const PageDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  pageNumber: z.number(),
  width: z.number(),
  height: z.number(),
  background: PageBackgroundSchema,
  elements: z.array(z.any()),
});

export interface PageData {
  id: string;
  name: string;
  pageNumber: number;
  width: number;
  height: number;
  background: PageBackground;
  elements: AnyElement[];
}

export type AnyElement = TextElement | ImageElement | ShapeElement | GroupElement;

export interface EditorState {
  elements: AnyElement[];
  selectedElementIds: string[];
}

export const EditorStateSchema = z.object({
  elements: z.array(AnyElementSchema),
  selectedElementIds: z.array(z.string()),
});
