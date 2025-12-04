import React from 'react';
import { Eye, EyeOff, Trash2, Download, Settings, Crosshair, Pencil, Layers, FileText, Ruler, Lock, Unlock, Sun, Contrast, Droplet, Grid, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, StretchHorizontal, StretchVertical } from 'lucide-react';
import { Annotation, ImageSize, ImageFilters, GridSettings } from '../types';
import { getLabelName } from '../constants';
import { getAnnotationArea } from '../utils/geometry';

interface SidebarProps {
  imageSize: ImageSize;
  annotations: Annotation[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onEditLabel: (id: string, e: React.MouseEvent) => void;
  onExport: () => void;
  fillOpacity: number;
  onFillOpacityChange: (val: number) => void;
  showCrosshairs: boolean;
  onToggleCrosshairs: () => void;
  showImageName: boolean;
  onToggleImageName: () => void;
  imageFilters: ImageFilters;
  onUpdateFilters: (f: ImageFilters) => void;
  gridSettings: GridSettings;
  onUpdateGridSettings: (g: GridSettings) => void;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute: (type: 'horizontal' | 'vertical') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  imageSize,
  annotations,
  selectedIds,
  onSelect,
  onDelete,
  onToggleVisible,
  onToggleLock,
  onEditLabel,
  onExport,
  fillOpacity,
  onFillOpacityChange,
  showCrosshairs,
  onToggleCrosshairs,
  showImageName,
  onToggleImageName,
  imageFilters,
  onUpdateFilters,
  gridSettings,
  onUpdateGridSettings,
  onAlign,
  onDistribute
}) => {
  const totalImageArea = imageSize.width * imageSize.height;

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
      
      {/* Scrollable container for settings */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Alignment Tools (Only show if multiple selected) */}
        {selectedIds.length > 1 && (
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
             <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2 mb-3">
               批量操作 (已选 {selectedIds.length} 个)
             </h3>
             <div className="grid grid-cols-4 gap-2 mb-2">
                <button onClick={() => onAlign('left')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="左对齐">
                  <AlignLeft size={16} />
                </button>
                <button onClick={() => onAlign('center')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="水平居中对齐">
                  <AlignCenter size={16} />
                </button>
                <button onClick={() => onAlign('right')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="右对齐">
                  <AlignRight size={16} />
                </button>
                <button onClick={() => onDistribute('horizontal')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="水平等间距分布">
                  <StretchHorizontal size={16} />
                </button>
             </div>
             <div className="grid grid-cols-4 gap-2">
                <button onClick={() => onAlign('top')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="顶对齐">
                  <AlignStartVertical size={16} />
                </button>
                <button onClick={() => onAlign('middle')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="垂直居中对齐">
                  <AlignCenterVertical size={16} />
                </button>
                <button onClick={() => onAlign('bottom')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="底对齐">
                  <AlignEndVertical size={16} />
                </button>
                <button onClick={() => onDistribute('vertical')} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex justify-center" title="垂直等间距分布">
                  <StretchVertical size={16} />
                </button>
             </div>
          </div>
        )}

        {/* Display Settings */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/30">
           <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
             <Settings size={12} /> 视图设置
           </h3>
           
           <div className="space-y-4">
             {/* Opacity */}
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

             {/* Toggles */}
             <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between cursor-pointer" onClick={onToggleCrosshairs}>
                 <span className="text-xs text-gray-300 flex items-center gap-2">
                   <Crosshair size={12} /> 十字辅助线
                 </span>
                 <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showCrosshairs ? 'bg-blue-600' : 'bg-gray-600'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showCrosshairs ? 'translate-x-4' : 'translate-x-0'}`} />
                 </div>
               </div>

               <div className="flex items-center justify-between cursor-pointer" onClick={onToggleImageName}>
                 <span className="text-xs text-gray-300 flex items-center gap-2">
                   <FileText size={12} /> 显示文件名
                 </span>
                 <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showImageName ? 'bg-blue-600' : 'bg-gray-600'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showImageName ? 'translate-x-4' : 'translate-x-0'}`} />
                 </div>
               </div>
             </div>
           </div>
        </div>

        {/* Image Enhancement */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/30">
           <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
             <Sun size={12} /> 图像增强
           </h3>
           <div className="space-y-3">
              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                   <span className="flex items-center gap-1"><Sun size={10}/> 亮度</span>
                   <span>{imageFilters.brightness}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={imageFilters.brightness}
                  onChange={(e) => onUpdateFilters({...imageFilters, brightness: parseInt(e.target.value)})}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
              </div>
              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                   <span className="flex items-center gap-1"><Contrast size={10}/> 对比度</span>
                   <span>{imageFilters.contrast}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={imageFilters.contrast}
                  onChange={(e) => onUpdateFilters({...imageFilters, contrast: parseInt(e.target.value)})}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400"
                />
              </div>
              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                   <span className="flex items-center gap-1"><Droplet size={10}/> 饱和度</span>
                   <span>{imageFilters.saturation}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={imageFilters.saturation}
                  onChange={(e) => onUpdateFilters({...imageFilters, saturation: parseInt(e.target.value)})}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>
           </div>
        </div>

        {/* Grid Settings */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/30">
           <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
             <Grid size={12} /> 网格辅助
           </h3>
           <div className="space-y-3">
             <div className="flex items-center justify-between cursor-pointer" onClick={() => onUpdateGridSettings({...gridSettings, visible: !gridSettings.visible})}>
                 <span className="text-xs text-gray-300">启用网格</span>
                 <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${gridSettings.visible ? 'bg-blue-600' : 'bg-gray-600'}`}>
                   <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${gridSettings.visible ? 'translate-x-4' : 'translate-x-0'}`} />
                 </div>
             </div>
             {gridSettings.visible && (
               <div className="space-y-1">
                 <div className="flex justify-between text-xs text-gray-400">
                    <span>网格大小</span>
                    <span>{gridSettings.size}px</span>
                 </div>
                 <input 
                    type="range" min="10" max="200" step="10" value={gridSettings.size}
                    onChange={(e) => onUpdateGridSettings({...gridSettings, size: parseInt(e.target.value)})}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                 />
               </div>
             )}
           </div>
        </div>

        {/* Annotations List */}
        <div className="p-2 space-y-1">
          {annotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-gray-600 text-sm space-y-2 mt-4">
              <p>暂无瑕疵标注</p>
            </div>
          ) : (
            annotations.slice().reverse().map((ann) => {
              const area = getAnnotationArea(ann);
              const percentage = totalImageArea > 0 ? (area / totalImageArea * 100) : 0;
              const isSelected = selectedIds.includes(ann.id);

              return (
                <div
                  key={ann.id}
                  className={`group flex items-center p-2 rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-blue-900/20 border-blue-500/50' 
                      : 'bg-transparent border-transparent hover:bg-gray-800 hover:border-gray-700'
                  }`}
                  onClick={(e) => {
                    if (ann.locked) return;
                    if (e.ctrlKey || e.metaKey) {
                      if (isSelected) {
                        onSelect(selectedIds.filter(id => id !== ann.id));
                      } else {
                        onSelect([...selectedIds, ann.id]);
                      }
                    } else {
                      onSelect([ann.id]);
                    }
                  }}
                >
                  <div className="flex flex-col gap-1 mr-2">
                     <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisible(ann.id);
                        }}
                        className={`p-1 rounded-md hover:bg-gray-700 transition-colors ${
                          ann.visible ? 'text-gray-400' : 'text-gray-600'
                        }`}
                        title={ann.visible ? "隐藏" : "显示"}
                      >
                        {ann.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLock(ann.id);
                        }}
                        className={`p-1 rounded-md hover:bg-gray-700 transition-colors ${
                          ann.locked ? 'text-yellow-500' : 'text-gray-600'
                        }`}
                        title={ann.locked ? "解锁" : "锁定"}
                      >
                        {ann.locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                  </div>

                  <div className="flex-1 min-w-0 flex items-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: ann.color }}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div 
                          className={`flex items-center gap-2 ${!ann.locked ? 'cursor-pointer' : 'cursor-default'}`}
                          onDoubleClick={(e) => !ann.locked && onEditLabel(ann.id, e)}
                      >
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'} ${ann.locked ? 'opacity-70' : ''}`}>
                          {getLabelName(ann.label).split('(')[0]}
                        </span>
                        {!ann.locked && (
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
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[10px] text-gray-600 truncate font-mono">
                           #{ann.id.slice(-4)}
                         </span>
                         <span className="text-[10px] text-gray-500 flex items-center gap-0.5" title="面积占比">
                            <Ruler size={10} />
                            {percentage < 0.01 ? '<0.01%' : `${percentage.toFixed(2)}%`}
                         </span>
                      </div>
                    </div>
                  </div>

                  {!ann.locked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete([ann.id]);
                      }}
                      className="p-1.5 rounded-md text-gray-600 hover:bg-red-900/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-1"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {ann.locked && (
                    <div className="p-1.5 text-gray-700 ml-1">
                      <Lock size={14} opacity={0.5} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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