
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
  locked: boolean; // New: Prevent accidental edits
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

export interface ImageFilters {
  brightness: number; // %
  contrast: number;   // %
  saturation: number; // %
}

export interface GridSettings {
  visible: boolean;
  size: number; // px
  color: string;
}

// --- Keyboard Shortcuts ---

export interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean; // Command on Mac
}

export type ActionId = 
  | 'TOOL_SELECT' 
  | 'TOOL_PAN' 
  | 'TOOL_RECTANGLE' 
  | 'TOOL_POLYGON' 
  | 'ZOOM_IN' 
  | 'ZOOM_OUT' 
  | 'RESET_VIEW' 
  | 'UNDO' 
  | 'REDO' 
  | 'DELETE' 
  | 'CANCEL' 
  | 'BACKSPACE_POINT'
  | 'NUDGE_LEFT'
  | 'NUDGE_RIGHT'
  | 'NUDGE_UP'
  | 'NUDGE_DOWN';

export type KeyMap = Record<ActionId, KeyBinding>;
