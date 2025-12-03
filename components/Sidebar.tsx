import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Download, Upload, Cpu, Loader2, Settings, Crosshair } from 'lucide-react';
import { Annotation } from '../types';

interface SidebarProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onChangeLabel: (id: string, newLabel: string) => void;
  onExport: () => void;
  onAutoLabel: () => void;
  isAutoLabeling: boolean;
  fillOpacity: number;
  onFillOpacityChange: (val: number) => void;
  showCrosshairs: boolean;
  onToggleCrosshairs: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  annotations,
  selectedId,
  onSelect,
  onDelete,
  onToggleVisible,
  onChangeLabel,
  onExport,
  onAutoLabel,
  isAutoLabeling,
  fillOpacity,
  onFillOpacityChange,
  showCrosshairs,
  onToggleCrosshairs,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleLabelClick = (id: string) => {
    setEditingId(id);
  };

  const handleLabelBlur = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      setEditingId(null);
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full z-10 shadow-xl">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-1">Annotations</h2>
        <p className="text-xs text-gray-400">{annotations.length} items</p>
      </div>
      
      {/* Display Settings */}
      <div className="p-4 border-b border-gray-700 space-y-4">
         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
           <Settings size={12} /> Display Settings
         </h3>
         
         <div className="space-y-1">
           <div className="flex justify-between text-xs text-gray-300">
             <span>Fill Opacity</span>
             <span>{Math.round(fillOpacity * 100)}%</span>
           </div>
           <input 
             type="range" 
             min="0" 
             max="1" 
             step="0.05"
             value={fillOpacity}
             onChange={(e) => onFillOpacityChange(parseFloat(e.target.value))}
             className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
           />
         </div>

         <div className="flex items-center justify-between">
           <span className="text-xs text-gray-300 flex items-center gap-2">
             <Crosshair size={12} /> Show Crosshairs
           </span>
           <button 
             onClick={onToggleCrosshairs}
             className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showCrosshairs ? 'bg-blue-600' : 'bg-gray-700'}`}
           >
             <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showCrosshairs ? 'translate-x-4' : 'translate-x-0'}`} />
           </button>
         </div>
      </div>

      <div className="p-4 border-b border-gray-700 space-y-3">
         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Tools</h3>
         <button
          onClick={onAutoLabel}
          disabled={isAutoLabeling}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition-colors text-sm font-medium"
        >
          {isAutoLabeling ? <Loader2 className="animate-spin" size={16} /> : <Cpu size={16} />}
          <span>Auto-Detect Objects</span>
        </button>
        <p className="text-[10px] text-gray-500 leading-tight">
          Uses Gemini 2.5 Flash to automatically detect bounding boxes. Requires API Key.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {annotations.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No annotations yet.
            <br />
            Draw something!
          </div>
        ) : (
          annotations.map((ann) => (
            <div
              key={ann.id}
              className={`group flex items-center p-2 rounded-md transition-colors cursor-pointer ${
                selectedId === ann.id ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
              onClick={() => onSelect(ann.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(ann.id);
                }}
                className={`p-1 rounded hover:bg-gray-600 mr-2 ${
                  ann.visible ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {ann.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <div className="flex-1 min-w-0 flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: ann.color }}
                />
                {editingId === ann.id ? (
                  <input
                    type="text"
                    value={ann.label}
                    autoFocus
                    onChange={(e) => onChangeLabel(ann.id, e.target.value)}
                    onBlur={handleLabelBlur}
                    onKeyDown={(e) => handleKeyDown(e, ann.id)}
                    className="w-full bg-gray-900 text-white text-sm px-1 rounded border border-blue-500 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-sm text-gray-200 truncate"
                    onDoubleClick={() => handleLabelClick(ann.id)}
                  >
                    {ann.label}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(ann.id);
                }}
                className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-700 space-y-2">
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
        >
          <Download size={16} />
          <span>Export JSON</span>
        </button>
      </div>
    </div>
  );
};