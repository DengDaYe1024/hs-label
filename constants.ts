import { KeyMap } from './types';

export const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f43f5e', // rose
];

export const DEFAULT_LABEL = 'defect';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const LABEL_MAP: Record<string, string> = {
  // Edge/Corner
  'wear': '磨损 (Wear)',
  'edge_wear': '边缘磨损 (Edge Wear)',
  'corner_wear': '边角磨损 (Corner Wear)',
  'whitening': '白边 (Whitening)',
  'scuff': '擦痕 (Scuff)',
  'chipping': '掉漆/缺角 (Chipping)',
  'wear_and_impact': '磨损与撞击 (Wear & Impact)',
  'soft_corner': '软角 (Soft Corner)',
  
  // Surface
  'scratch': '划痕 (Scratch)',
  'stain': '污渍 (Stain)',
  'surface_wear': '表面磨损 (Surface Wear)',
  'print_line': '打印线 (Print Line)',
  'refractor_line': '折射全息线 (Refractor Line)',
  'dimple': '凹点 (Dimple)',
  'pit': '凹坑 (Pit)',
  'spot': '斑点 (Spot)',
  'dirt': '污垢 (Dirt)',
  'discoloration': '变色 (Discoloration)',
  'bubble': '气泡 (Bubble)',
  'foreign_matter': '异物 (Foreign Matter)',
  'silvering': '氧化/银化 (Silvering)',
  'wax_stain': '蜡渍 (Wax Stain)',
  'wear_and_stain': '磨损与污渍 (Wear & Stain)',

  // Structural/Major
  'crease': '折痕 (Crease)',
  'bend': '弯曲 (Bend)',
  'dent': '压痕 (Dent)',
  'impression': '压印 (Impression)',
  'crack': '裂纹 (Crack)',
  'hole': '孔洞 (Hole)',
  'tear': '撕裂 (Tear)',
  'water_damage': '水渍损伤 (Water Damage)',
  'deformation': '变形 (Deformation)',
  'corrosion': '腐蚀 (Corrosion)',
  'impact': '撞击痕迹 (Impact)',
  'damage': '严重损伤 (Damage)',
  
  // Generic
  'defect': '通用缺陷 (Defect)',
};

// Define Groups for the UI
export const LABEL_GROUPS = [
  {
    name: '边角/边缘问题 (Edges & Corners)',
    items: ['corner_wear', 'edge_wear', 'whitening', 'soft_corner', 'chipping', 'wear', 'scuff', 'wear_and_impact']
  },
  {
    name: '表面瑕疵 (Surface)',
    items: ['scratch', 'surface_wear', 'stain', 'print_line', 'refractor_line', 'dimple', 'pit', 'spot', 'dirt', 'wax_stain', 'discoloration', 'bubble', 'silvering', 'foreign_matter']
  },
  {
    name: '结构/严重损伤 (Structural)',
    items: ['crease', 'bend', 'dent', 'impression', 'crack', 'tear', 'hole', 'water_damage', 'deformation', 'impact', 'corrosion', 'damage']
  },
  {
    name: '其他 (Other)',
    items: ['defect']
  }
];

// Deterministic colors for specific labels
export const LABEL_COLORS: Record<string, string> = {
  // Red/Orange/Yellow for Surface/Wear
  'wear': '#ef4444',
  'corner_wear': '#dc2626',
  'edge_wear': '#f87171',
  'whitening': '#cbd5e1', // Light gray/whiteish
  'scuff': '#f97316',
  'scratch': '#fbbf24', // Amber
  'stain': '#d97706', // Darker Amber
  
  // Blues/Greens for Structural or Specific
  'crease': '#2563eb', // Blue
  'dent': '#3b82f6',
  'impression': '#60a5fa',
  'crack': '#7c3aed', // Violet
  'impact': '#db2777', // Pink
  'water_damage': '#0ea5e9', // Sky Blue

  // Others
  'dirt': '#854d0e', // Brown
  'discoloration': '#a855f7', // Purple
  'defect': '#94a3b8',
};

export const getLabelColor = (labelKey: string): string => {
  if (LABEL_COLORS[labelKey]) return LABEL_COLORS[labelKey];
  
  // Fallback: Generate a consistent color from string
  let hash = 0;
  for (let i = 0; i < labelKey.length; i++) {
    hash = labelKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

export const getLabelName = (key: string): string => {
  return LABEL_MAP[key] || key;
}

export const DEFAULT_KEY_MAP: KeyMap = {
  TOOL_SELECT: { key: 'v' },
  TOOL_PAN: { key: 'h' }, // Note: Spacebar is handled specially for temporary pan
  TOOL_RECTANGLE: { key: 'r' },
  TOOL_POLYGON: { key: 'p' },
  ZOOM_IN: { key: '=' }, // Plus key usually requires shift, but we map the base key often
  ZOOM_OUT: { key: '-' },
  RESET_VIEW: { key: '0' },
  UNDO: { key: 'z', ctrlKey: true },
  REDO: { key: 'z', ctrlKey: true, shiftKey: true },
  DELETE: { key: 'Delete' },
  CANCEL: { key: 'Escape' },
  BACKSPACE_POINT: { key: 'Backspace' },
  NUDGE_LEFT: { key: 'ArrowLeft' },
  NUDGE_RIGHT: { key: 'ArrowRight' },
  NUDGE_UP: { key: 'ArrowUp' },
  NUDGE_DOWN: { key: 'ArrowDown' }
};

export const ACTION_NAMES: Record<string, string> = {
  TOOL_SELECT: '选择工具',
  TOOL_PAN: '平移工具',
  TOOL_RECTANGLE: '矩形工具',
  TOOL_POLYGON: '多边形工具',
  ZOOM_IN: '放大',
  ZOOM_OUT: '缩小',
  RESET_VIEW: '重置视图',
  UNDO: '撤销',
  REDO: '重做',
  DELETE: '删除选中',
  CANCEL: '取消操作',
  BACKSPACE_POINT: '撤销上一点',
  NUDGE_LEFT: '向左微调',
  NUDGE_RIGHT: '向右微调',
  NUDGE_UP: '向上微调',
  NUDGE_DOWN: '向下微调'
};