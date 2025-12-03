
import React from 'react';
import { Eye, EyeOff, Trash2, Download, Settings, Crosshair, Pencil, Layers } from 'lucide-react';
import { Annotation } from '../types';
import { getLabelName } from '../constants';

interface SidebarProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onEditLabel: (id: string, e: React.MouseEvent) => void;
  onExport: () => void;
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
  onEditLabel,
  onExport,
  fillOpacity,
  onFillOpacityChange,
  showCrosshairs,
  onToggleCrosshairs,
}) => {

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full z-10 shadow-xl select-none">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
           <h2 className="text-lg font-semibold text-white mb-0.5 flex items-center gap-2">
             <Layers size={18} className="text-blue-500"/>
             标注列表
           </h2>
           <p className="text-xs text-gray-500">共 {annotations.length} 个瑕疵点</p>
        </div>
      </div>
      
      {/* Display Settings */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/30">
         <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
           <Settings size={12} /> 视图设置
         </h3>
         
         <div className="space-y-4">
           <div className="space-y-1">
             <div className="flex justify-between text-xs text-gray-400">
               <span>填充透明度</span>
               <span>{Math.round(fillOpacity * 100)}%</span>
             </div>
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.05"
               value={fillOpacity}
               onChange={(e) => onFillOpacityChange(parseFloat(e.target.value))}
               className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
             />
           </div>

           <div className="flex items-center justify-between cursor-pointer" onClick={onToggleCrosshairs}>
             <span className="text-xs text-gray-300 flex items-center gap-2">
               <Crosshair size={12} /> 十字辅助线
             </span>
             <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showCrosshairs ? 'bg-blue-600' : 'bg-gray-600'}`}>
               <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showCrosshairs ? 'translate-x-4' : 'translate-x-0'}`} />
             </div>
           </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm space-y-2">
            <Layers size={32} opacity={0.2} />
            <p>暂无瑕疵标注</p>
            <p className="text-xs">使用左侧工具开始</p>
          </div>
        ) : (
          annotations.slice().reverse().map((ann) => (
            <div
              key={ann.id}
              className={`group flex items-center p-2 rounded-lg transition-all border ${
                selectedId === ann.id 
                  ? 'bg-blue-900/20 border-blue-500/50' 
                  : 'bg-transparent border-transparent hover:bg-gray-800 hover:border-gray-700'
              }`}
              onClick={() => onSelect(ann.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(ann.id);
                }}
                className={`p-1.5 rounded-md hover:bg-gray-700 mr-2 transition-colors ${
                  ann.visible ? 'text-gray-400' : 'text-gray-600'
                }`}
                title={ann.visible ? "隐藏" : "显示"}
              >
                {ann.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <div className="flex-1 min-w-0 flex items-center">
                <div
                  className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: ann.color }}
                />
                <div className="flex flex-col min-w-0 flex-1">
                   <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onDoubleClick={(e) => onEditLabel(ann.id, e)}
                   >
                     <span className={`text-sm font-medium truncate ${selectedId === ann.id ? 'text-white' : 'text-gray-300'}`}>
                       {getLabelName(ann.label).split('(')[0]}
                     </span>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         onEditLabel(ann.id, e);
                       }}
                       className="text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                       title="修改类型"
                     >
                       <Pencil size={12} />
                     </button>
                   </div>
                   <span className="text-[10px] text-gray-600 truncate font-mono">
                     {ann.type === 'rectangle' ? 'RECT' : 'POLY'} #{ann.id.slice(-4)}
                   </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(ann.id);
                }}
                className="p-1.5 rounded-md text-gray-600 hover:bg-red-900/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-1"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-700 space-y-2 bg-gray-900">
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 px-4 rounded-lg transition-all text-sm font-medium border border-gray-700 hover:border-gray-600 shadow-sm"
        >
          <Download size={16} />
          <span>导出评级报告数据</span>
        </button>
      </div>
    </div>
  );
};
