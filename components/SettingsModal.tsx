import React, { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { KeyMap, ActionId, KeyBinding } from '../types';
import { ACTION_NAMES } from '../constants';
import { formatShortcut } from '../utils/keyboard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyMap: KeyMap;
  onUpdateKeyMap: (newMap: KeyMap) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  keyMap,
  onUpdateKeyMap,
  onResetDefaults
}) => {
  const [editingAction, setEditingAction] = useState<ActionId | null>(null);

  useEffect(() => {
    if (!editingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Avoid capturing modifier keys alone
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const newBinding: KeyBinding = {
        key: e.key,
        ctrlKey: e.ctrlKey || e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      };

      onUpdateKeyMap({
        ...keyMap,
        [editingAction]: newBinding
      });
      setEditingAction(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingAction, keyMap, onUpdateKeyMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Keyboard size={24} className="text-blue-500" />
            快捷键设置 (Keyboard Shortcuts)
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {(Object.keys(ACTION_NAMES) as ActionId[]).map((actionId) => (
              <div 
                key={actionId} 
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
              >
                <span className="text-sm text-gray-300 font-medium">
                  {ACTION_NAMES[actionId]}
                </span>
                
                <button
                  onClick={() => setEditingAction(actionId)}
                  className={`relative min-w-[100px] h-8 px-3 rounded text-xs font-mono font-bold transition-all ${
                    editingAction === actionId
                      ? 'bg-blue-600 text-white animate-pulse ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900'
                      : 'bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                  }`}
                >
                  {editingAction === actionId 
                    ? '请输入按键...' 
                    : formatShortcut(keyMap[actionId])}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-between items-center rounded-b-xl">
          <div className="text-xs text-gray-500">
            点击按键框即可录入新的快捷键
          </div>
          <button
            onClick={onResetDefaults}
            className="text-sm text-gray-400 hover:text-red-400 px-4 py-2 hover:bg-red-900/10 rounded transition-colors"
          >
            恢复默认设置
          </button>
          <button
            onClick={onClose}
            className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            完成
          </button>
        </div>

      </div>
    </div>
  );
};