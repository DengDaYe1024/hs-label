export interface Point {
  x: number;
  y: number;
}

export type ShapeType = 'rectangle' | 'polygon';

export interface Annotation {
  id: string;
  label: string;
  type: ShapeType;
  points: Point[];
  color: string;
  visible: boolean;
}

export type ToolType = 'select' | 'pan' | 'rectangle' | 'polygon';

export interface ImageSize {
  width: number;
  height: number;
}

export interface DetectedObject {
  label: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}
