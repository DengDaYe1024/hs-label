
import React, { useState, useEffect, useRef } from 'react';
import { LABEL_MAP, LABEL_COLORS, LABEL_GROUPS, getLabelColor } from '../constants';
import { X, Search } from 'lucide-react';

interface LabelSelectorProps {
  position: { x: number; y: number };
  onSelect: (key: string) => void;
  onClose: () => void;
}

export const LabelSelector: React.FC<LabelSelectorProps> = ({ position, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Calculate screen bounds to prevent overflow
  const screenHeight = window.innerHeight;
  const maxHeight = 400;
  const topPos = Math.min(position.y, screenHeight - maxHeight - 20);

  // Filter groups based on search
  const filteredGroups = LABEL_GROUPS.map(group => {
    const filteredItems = group.items.filter(key => {
      const label = LABEL_MAP[key] || key;
      const term = searchTerm.toLowerCase();
      return label.toLowerCase().includes(term) || key.toLowerCase().includes(term);
    });
    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  // Flatten for keyboard navigation if needed, or just use first match
  const firstMatchKey = filteredGroups[0]?.items[0];

  return (
    <div 
      className="absolute z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col w-72 overflow-hidden"
      style={{ 
        left: position.x, 
        top: topPos,
        maxHeight: maxHeight,
        transform: 'translate(0, 0)' 
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-bold text-gray-200">选择瑕疵类型</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 bg-gray-900">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索瑕疵 (如: 角, scratch)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-950 text-white text-sm py-2 pl-9 pr-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && firstMatchKey) {
                onSelect(firstMatchKey);
              }
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-3 custom-scrollbar">
        {filteredGroups.map((group) => (
          <div key={group.name}>
            <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800 mb-1">
              {group.name}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {group.items.map((key) => {
                const labelName = LABEL_MAP[key] || key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelect(key)}
                    className="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-gray-800 text-left transition-colors group border border-transparent hover:border-gray-700"
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                      style={{ backgroundColor: getLabelColor(key) }} 
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-gray-300 group-hover:text-white font-medium truncate">
                        {labelName.split('(')[0]} 
                      </span>
                      <span className="text-[10px] text-gray-600 group-hover:text-gray-400 truncate">
                        {key}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500">
            未找到匹配的瑕疵类型
          </div>
        )}
      </div>
    </div>
  );
};
