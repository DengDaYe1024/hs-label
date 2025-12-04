import React from 'react';
import { MousePointer, Hand, Square, PenTool, ZoomIn, ZoomOut, RotateCcw, Undo2, Redo2, Settings } from 'lucide-react';
import { ToolType, KeyMap } from '../types';
import { formatShortcut } from '../utils/keyboard';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoCount?: number;
  redoCount?: number;
  undoAction?: string | null;
  redoAction?: string | null;
  keyMap: KeyMap;
  onOpenSettings: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  scale,
  onZoomIn,
  onZoomOut,
  onResetView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  undoAction,
  redoAction,
  keyMap,
  onOpenSettings
}) => {
  const tools = [
    { id: 'select', icon: MousePointer, label: `选择 (${formatShortcut(keyMap.TOOL_SELECT)})` },
    { id: 'pan', icon: Hand, label: `拖拽移动 (${formatShortcut(keyMap.TOOL_PAN)})` },
    { id: 'rectangle', icon: Square, label: `矩形工具 (${formatShortcut(keyMap.TOOL_RECTANGLE)})` },
    { id: 'polygon', icon: PenTool, label: `多边形工具 (${formatShortcut(keyMap.TOOL_POLYGON)})` },
  ] as const;

  const renderBadge = (count: number) => {
    if (count <= 0) return null;
    const isMultiDigit = count > 9;
    return (
      <span 
        className={`absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold h-[18px] flex items-center justify-center rounded-full border-2 border-gray-900 shadow-sm leading-none transition-all ${
          isMultiDigit ? 'min-w-[22px] px-1' : 'min-w-[18px]'
        }`}
      >
        {isMultiDigit ? '9+' : count}
      </span>
    );
  };

  return (
    <div className="w-16 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-10 shadow-xl">
      <div className="space-y-2 w-full px-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            title={tool.label}
            className={`w-full aspect-square flex items-center justify-center rounded-lg transition-colors ${
              currentTool === tool.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <tool.icon size={20} />
          </button>
        ))}
      </div>

      <div className="h-px w-8 bg-gray-700 my-2" />
      
      {/* Undo/Redo */}
      <div className="space-y-2 w-full px-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={canUndo && undoAction ? `撤销: ${undoAction} (${formatShortcut(keyMap.UNDO)})` : `撤销 (${formatShortcut(keyMap.UNDO)})`}
          className={`relative w-full aspect-square flex items-center justify-center rounded-lg transition-colors ${
            canUndo
              ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
              : 'text-gray-700 cursor-not-allowed'
          }`}
        >
          <Undo2 size={20} />
          {renderBadge(undoCount)}
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={canRedo && redoAction ? `重做: ${redoAction} (${formatShortcut(keyMap.REDO)})` : `重做 (${formatShortcut(keyMap.REDO)})`}
          className={`relative w-full aspect-square flex items-center justify-center rounded-lg transition-colors ${
            canRedo
              ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
              : 'text-gray-700 cursor-not-allowed'
          }`}
        >
          <Redo2 size={20} />
          {renderBadge(redoCount)}
        </button>
      </div>

      <div className="h-px w-8 bg-gray-700 my-2" />

      <div className="space-y-2 w-full px-2 flex flex-col items-center">
        <button
          onClick={onZoomIn}
          title={`放大 (${formatShortcut(keyMap.ZOOM_IN)})`}
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ZoomIn size={20} />
        </button>
        
        <div className="text-[10px] font-bold text-blue-400 select-none py-1 tabular-nums">
          {Math.round(scale * 100)}%
        </div>

        <button
          onClick={onZoomOut}
          title={`缩小 (${formatShortcut(keyMap.ZOOM_OUT)})`}
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={onResetView}
          title={`重置视图 (${formatShortcut(keyMap.RESET_VIEW)})`}
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <div className="mt-auto pb-2">
        <button
            onClick={onOpenSettings}
            title="设置"
            className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-800 hover:text-blue-400 transition-colors"
          >
            <Settings size={20} />
          </button>
      </div>
    </div>
  );
};