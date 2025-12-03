import React, { useState, useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { LabelSelector } from './components/LabelSelector';
import { SettingsModal } from './components/SettingsModal';
import { Annotation, ToolType, ViewTransform, Point, KeyMap } from './types';
import { COLORS, getLabelColor, DEFAULT_KEY_MAP } from './constants';
import { isShortcutPressed } from './utils/keyboard';
import { Upload } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  
  // History State
  const [history, setHistory] = useState<{ past: Annotation[][], future: Annotation[][] }>({ past: [], future: [] });
  
  // Display Settings
  const [fillOpacity, setFillOpacity] = useState(0.2);
  const [showCrosshairs, setShowCrosshairs] = useState(true);

  // Settings & Shortcuts
  const [keyMap, setKeyMap] = useState<KeyMap>(() => {
    const saved = localStorage.getItem('keyMap');
    return saved ? JSON.parse(saved) : DEFAULT_KEY_MAP;
  });
  const [showSettings, setShowSettings] = useState(false);

  // Popup State
  const [labelPopup, setLabelPopup] = useState<{ visible: boolean; x: number; y: number; id: string | null }>({
    visible: false,
    x: 0,
    y: 0,
    id: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Persist KeyMap
  useEffect(() => {
    localStorage.setItem('keyMap', JSON.stringify(keyMap));
  }, [keyMap]);

  // --- History Logic ---

  const snapshotHistory = () => {
    setHistory(prev => ({
      past: [...prev.past, annotations],
      future: []
    }));
  };

  const handleUndo = () => {
    if (history.past.length === 0) return;
    const newPast = [...history.past];
    const previous = newPast.pop();
    
    setHistory({
      past: newPast,
      future: [annotations, ...history.future]
    });
    
    if (previous) {
      setAnnotations(previous);
      setSelectedId(null);
    }
  };

  const handleRedo = () => {
    if (history.future.length === 0) return;
    const newFuture = [...history.future];
    const next = newFuture.shift();

    setHistory({
      past: [...history.past, annotations],
      future: newFuture
    });

    if (next) {
      setAnnotations(next);
      setSelectedId(null);
    }
  };

  // --- Global Keyboard Handler ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      // Tools
      if (isShortcutPressed(e, keyMap.TOOL_SELECT)) setCurrentTool('select');
      if (isShortcutPressed(e, keyMap.TOOL_PAN)) setCurrentTool('pan');
      if (isShortcutPressed(e, keyMap.TOOL_RECTANGLE)) setCurrentTool('rectangle');
      if (isShortcutPressed(e, keyMap.TOOL_POLYGON)) setCurrentTool('polygon');

      // Zoom
      if (isShortcutPressed(e, keyMap.ZOOM_IN)) handleZoom('in');
      if (isShortcutPressed(e, keyMap.ZOOM_OUT)) handleZoom('out');
      if (isShortcutPressed(e, keyMap.RESET_VIEW)) handleResetView();

      // History
      if (isShortcutPressed(e, keyMap.UNDO)) { e.preventDefault(); handleUndo(); }
      if (isShortcutPressed(e, keyMap.REDO)) { e.preventDefault(); handleRedo(); }

      // Delete
      if (isShortcutPressed(e, keyMap.DELETE) && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyMap, selectedId, history, annotations]); // Deps are critical for closures


  // --- Handlers ---
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        setImageSrc(src);
        const img = new Image();
        img.onload = () => {
          setImageSize({ width: img.width, height: img.height });
          const maxWidth = window.innerWidth - 384; 
          const maxHeight = window.innerHeight;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height) * 0.9;
          setTransform({
            scale,
            x: (window.innerWidth - 64 - 320 - img.width * scale) / 2,
            y: (window.innerHeight - img.height * scale) / 2
          });
          setAnnotations([]);
          setHistory({ past: [], future: [] });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setTransform(prev => ({
      ...prev,
      scale: direction === 'in' ? prev.scale * 1.2 : prev.scale / 1.2
    }));
  };

  const handleResetView = () => {
    if (imageSize.width === 0) return;
    const maxWidth = window.innerWidth - 384; 
    const maxHeight = window.innerHeight;
    const scale = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height) * 0.9;
    setTransform({
        scale,
        x: (window.innerWidth - 64 - 320 - imageSize.width * scale) / 2,
        y: (window.innerHeight - imageSize.height * scale) / 2
    });
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      version: "1.0",
      imageHeight: imageSize.height,
      imageWidth: imageSize.width,
      shapes: annotations.map(a => ({
        label: a.label,
        points: a.points.map(p => [p.x, p.y]),
        group_id: null,
        shape_type: a.type,
        flags: {}
      }))
    }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "grading_annotations.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleShapeComplete = (id: string, screenPos: Point) => {
    setLabelPopup({
      visible: true,
      x: screenPos.x + 64, 
      y: screenPos.y,
      id: id,
    });
    setCurrentTool('select');
  };

  const handleDelete = (id: string) => {
    snapshotHistory();
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleEditLabel = (id: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setLabelPopup({
      visible: true,
      x: rect.left - 290, 
      y: rect.top,
      id: id
    });
    setSelectedId(id);
  };

  const handleLabelSelect = (key: string) => {
    if (labelPopup.id) {
      snapshotHistory();
      setAnnotations(prev => prev.map(ann => {
        if (ann.id === labelPopup.id) {
          return { ...ann, label: key, color: getLabelColor(key) };
        }
        return ann;
      }));
    }
    setLabelPopup({ ...labelPopup, visible: false, id: null });
  };

  const getNextColor = () => COLORS[annotations.length % COLORS.length];

  if (!imageSrc) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full border-2 border-dashed border-gray-700 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition-colors">
          <Upload size={48} className="text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">上传卡片图片</h1>
          <p className="text-gray-400 mb-6 text-center">支持高分辨率图片，用于细节评级</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={fileInputRef}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            选择文件
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-gray-950 text-white font-sans relative">
      <Toolbar
        currentTool={currentTool}
        setTool={setCurrentTool}
        scale={transform.scale}
        onZoomIn={() => handleZoom('in')}
        onZoomOut={() => handleZoom('out')}
        onResetView={handleResetView}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        keyMap={keyMap}
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <CanvasArea
          imageSrc={imageSrc}
          imageSize={imageSize}
          annotations={annotations}
          currentTool={currentTool}
          selectedId={selectedId}
          transform={transform}
          onTransformChange={setTransform}
          onAnnotationsChange={setAnnotations}
          onSelect={setSelectedId}
          currentColor={getNextColor()}
          fillOpacity={fillOpacity}
          showCrosshairs={showCrosshairs}
          onShapeComplete={handleShapeComplete}
          onSnapshot={snapshotHistory}
          keyMap={keyMap}
        />
        
        {labelPopup.visible && (
          <LabelSelector
            position={{ x: labelPopup.x, y: labelPopup.y }}
            onSelect={handleLabelSelect}
            onClose={() => setLabelPopup({ ...labelPopup, visible: false })}
          />
        )}
      </div>

      <Sidebar
        annotations={annotations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={handleDelete}
        onToggleVisible={(id) => {
          setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
        }}
        onEditLabel={handleEditLabel}
        onExport={handleExport}
        fillOpacity={fillOpacity}
        onFillOpacityChange={setFillOpacity}
        showCrosshairs={showCrosshairs}
        onToggleCrosshairs={() => setShowCrosshairs(!showCrosshairs)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        keyMap={keyMap}
        onUpdateKeyMap={setKeyMap}
        onResetDefaults={() => setKeyMap(DEFAULT_KEY_MAP)}
      />
    </div>
  );
};

export default App;