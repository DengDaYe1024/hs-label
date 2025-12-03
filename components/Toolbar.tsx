import React from 'react';
import { MousePointer, Hand, Square, PenTool, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  scale,
  onZoomIn,
  onZoomOut,
  onResetView,
}) => {
  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select (V)' },
    { id: 'pan', icon: Hand, label: 'Pan (H)' },
    { id: 'rectangle', icon: Square, label: 'Rectangle (R)' },
    { id: 'polygon', icon: PenTool, label: 'Polygon (P)' },
  ] as const;

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

      <div className="space-y-2 w-full px-2 flex flex-col items-center">
        <button
          onClick={onZoomIn}
          title="Zoom In (+)"
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ZoomIn size={20} />
        </button>
        
        <div className="text-[10px] font-bold text-blue-400 select-none py-1 tabular-nums">
          {Math.round(scale * 100)}%
        </div>

        <button
          onClick={onZoomOut}
          title="Zoom Out (-)"
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={onResetView}
          title="Reset View (0)"
          className="w-full aspect-square flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <RotateCcw size={20} />
        </button>
      </div>
    </div>
  );
};