import React, { useState, useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { LabelSelector } from './components/LabelSelector';
import { SettingsModal } from './components/SettingsModal';
import { Annotation, ToolType, ViewTransform, Point, KeyMap, ImageFilters, GridSettings } from './types';
import { COLORS, getLabelColor, DEFAULT_KEY_MAP } from './constants';
import { isShortcutPressed } from './utils/keyboard';
import { Upload } from 'lucide-react';
import { getAnnotationBounds, moveAnnotation } from './utils/geometry';

interface HistoryItem {
  annotations: Annotation[];
  action: string;
}

const App: React.FC = () => {
  // --- State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  
  // Padding State
  const [canvasPadding, setCanvasPadding] = useState<{ x: number, y: number }>({ x: 50, y: 50 });

  // History State
  const [history, setHistory] = useState<{ past: HistoryItem[], future: HistoryItem[] }>({ past: [], future: [] });
  
  // Display Settings
  const [fillOpacity, setFillOpacity] = useState(0.2);
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [showImageName, setShowImageName] = useState(true);
  
  // Advanced Card Grading Settings
  const [imageFilters, setImageFilters] = useState<ImageFilters>({ brightness: 100, contrast: 100, saturation: 100 });
  const [gridSettings, setGridSettings] = useState<GridSettings>({ visible: false, size: 50, color: 'rgba(0, 255, 255, 0.4)' });

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

  const snapshotHistory = (action: string = '修改') => {
    setHistory(prev => ({
      past: [...prev.past, { annotations: [...annotations], action }],
      future: []
    }));
  };

  const handleUndo = () => {
    if (history.past.length === 0) return;
    const newPast = [...history.past];
    const previous = newPast.pop();
    
    // Valid redo action needs the *current* state before we revert
    // The action name for Redo is the one we are undoing
    const redoAction = previous?.action || '修改';

    setHistory({
      past: newPast,
      future: [{ annotations: annotations, action: redoAction }, ...history.future]
    });
    
    if (previous) {
      setAnnotations(previous.annotations);
      setSelectedIds([]);
    }
  };

  const handleRedo = () => {
    if (history.future.length === 0) return;
    const newFuture = [...history.future];
    const next = newFuture.shift();

    // When redoing, we push the current state to past
    // The action name for Past is the one we are redoing
    const undoAction = next?.action || '修改';

    setHistory({
      past: [...history.past, { annotations: annotations, action: undoAction }],
      future: newFuture
    });

    if (next) {
      setAnnotations(next.annotations);
      setSelectedIds([]);
    }
  };

  // --- Global Keyboard Handler ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (isShortcutPressed(e, keyMap.TOOL_SELECT)) setCurrentTool('select');
      if (isShortcutPressed(e, keyMap.TOOL_PAN)) setCurrentTool('pan');
      if (isShortcutPressed(e, keyMap.TOOL_RECTANGLE)) setCurrentTool('rectangle');
      if (isShortcutPressed(e, keyMap.TOOL_POLYGON)) setCurrentTool('polygon');

      if (isShortcutPressed(e, keyMap.ZOOM_IN)) handleZoom('in');
      if (isShortcutPressed(e, keyMap.ZOOM_OUT)) handleZoom('out');
      if (isShortcutPressed(e, keyMap.RESET_VIEW)) handleResetView();

      if (isShortcutPressed(e, keyMap.UNDO)) { e.preventDefault(); handleUndo(); }
      if (isShortcutPressed(e, keyMap.REDO)) { e.preventDefault(); handleRedo(); }

      if (isShortcutPressed(e, keyMap.DELETE) && selectedIds.length > 0) {
        // Prevent deleting locked items
        const hasLocked = selectedIds.some(id => annotations.find(a => a.id === id)?.locked);
        if (!hasLocked) {
           e.preventDefault();
           handleDelete(selectedIds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyMap, selectedIds, history, annotations]);


  // --- Handlers ---
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
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
          
          const x = (maxWidth - img.width * scale) / 2 - (canvasPadding.x * scale);
          const y = (maxHeight - img.height * scale) / 2 - (canvasPadding.y * scale);
          
          setTransform({ scale, x, y });
          setAnnotations([]);
          setHistory({ past: [], future: [] });
          // Reset filters on new image
          setImageFilters({ brightness: 100, contrast: 100, saturation: 100 });
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
    
    const x = (maxWidth - imageSize.width * scale) / 2 - (canvasPadding.x * scale);
    const y = (maxHeight - imageSize.height * scale) / 2 - (canvasPadding.y * scale);

    setTransform({ scale, x, y });
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      version: "1.0",
      imageHeight: imageSize.height,
      imageWidth: imageSize.width,
      imageName: fileName,
      shapes: annotations.map(a => ({
        label: a.label,
        points: a.points.map(p => [p.x, p.y]),
        group_id: null,
        shape_type: a.type,
        flags: {},
        locked: a.locked
      }))
    }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${fileName?.split('.')[0] || 'annotations'}.json`);
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

  const handleDelete = (ids: string[]) => {
    snapshotHistory('删除标注');
    setAnnotations(prev => prev.filter(a => !ids.includes(a.id)));
    setSelectedIds([]);
  };

  const handleToggleVisible = (id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
  };

  const handleToggleLock = (id: string) => {
    setAnnotations(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, locked: !a.locked };
      }
      return a;
    }));
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(sid => sid !== id));
    }
  };

  const handleEditLabel = (id: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setLabelPopup({
      visible: true,
      x: rect.left - 290, 
      y: rect.top,
      id: id
    });
    setSelectedIds([id]);
  };

  const handleLabelSelect = (key: string) => {
    if (labelPopup.id) {
      snapshotHistory('修改类型');
      setAnnotations(prev => prev.map(ann => {
        if (ann.id === labelPopup.id) {
          return { ...ann, label: key, color: getLabelColor(key) };
        }
        return ann;
      }));
    }
    setLabelPopup({ ...labelPopup, visible: false, id: null });
  };

  // --- Alignment & Distribution Logic ---

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedAnns = annotations.filter(a => selectedIds.includes(a.id));
    if (selectedAnns.length < 2) return;

    snapshotHistory('对齐标注');
    
    // Calculate bounds of all selected items
    const allBounds = selectedAnns.map(getAnnotationBounds);
    const groupMinX = Math.min(...allBounds.map(b => b.minX));
    const groupMaxX = Math.max(...allBounds.map(b => b.maxX));
    const groupMinY = Math.min(...allBounds.map(b => b.minY));
    const groupMaxY = Math.max(...allBounds.map(b => b.maxY));
    const groupCenterX = (groupMinX + groupMaxX) / 2;
    const groupCenterY = (groupMinY + groupMaxY) / 2;

    const newAnnotations = annotations.map(ann => {
      if (!selectedIds.includes(ann.id)) return ann;
      
      const bounds = getAnnotationBounds(ann);
      let dx = 0;
      let dy = 0;

      switch (type) {
        case 'left': dx = groupMinX - bounds.minX; break;
        case 'right': dx = groupMaxX - bounds.maxX; break;
        case 'center': dx = groupCenterX - bounds.centerX; break;
        case 'top': dy = groupMinY - bounds.minY; break;
        case 'bottom': dy = groupMaxY - bounds.maxY; break;
        case 'middle': dy = groupCenterY - bounds.centerY; break;
      }

      return moveAnnotation(ann, dx, dy);
    });

    setAnnotations(newAnnotations);
  };

  const handleDistribute = (type: 'horizontal' | 'vertical') => {
    const selectedAnns = annotations.filter(a => selectedIds.includes(a.id));
    if (selectedAnns.length < 3) return; // Need at least 3 to distribute

    snapshotHistory('分布标注');

    // Sort by position
    const sorted = [...selectedAnns].sort((a, b) => {
      const bA = getAnnotationBounds(a);
      const bB = getAnnotationBounds(b);
      return type === 'horizontal' ? bA.centerX - bB.centerX : bA.centerY - bB.centerY;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstBounds = getAnnotationBounds(first);
    const lastBounds = getAnnotationBounds(last);

    let start = type === 'horizontal' ? firstBounds.centerX : firstBounds.centerY;
    let end = type === 'horizontal' ? lastBounds.centerX : lastBounds.centerY;
    const step = (end - start) / (sorted.length - 1);

    const newAnnotations = [...annotations];

    sorted.forEach((ann, index) => {
      const bounds = getAnnotationBounds(ann);
      const targetPos = start + (step * index);
      const currentPos = type === 'horizontal' ? bounds.centerX : bounds.centerY;
      const diff = targetPos - currentPos;
      
      const annIndex = newAnnotations.findIndex(a => a.id === ann.id);
      if (annIndex !== -1) {
        newAnnotations[annIndex] = moveAnnotation(
          newAnnotations[annIndex], 
          type === 'horizontal' ? diff : 0, 
          type === 'vertical' ? diff : 0
        );
      }
    });

    setAnnotations(newAnnotations);
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

  const lastUndoAction = history.past.length > 0 ? history.past[history.past.length - 1].action : null;
  const nextRedoAction = history.future.length > 0 ? history.future[0].action : null;

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
        undoCount={history.past.length}
        redoCount={history.future.length}
        undoAction={lastUndoAction}
        redoAction={nextRedoAction}
        keyMap={keyMap}
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <CanvasArea
          imageSrc={imageSrc}
          fileName={fileName}
          showImageName={showImageName}
          imageSize={imageSize}
          annotations={annotations}
          currentTool={currentTool}
          selectedIds={selectedIds}
          transform={transform}
          onTransformChange={setTransform}
          onAnnotationsChange={setAnnotations}
          onSelect={setSelectedIds}
          currentColor={getNextColor()}
          fillOpacity={fillOpacity}
          showCrosshairs={showCrosshairs}
          onShapeComplete={handleShapeComplete}
          onSnapshot={snapshotHistory}
          keyMap={keyMap}
          padding={canvasPadding}
          imageFilters={imageFilters}
          gridSettings={gridSettings}
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
        imageSize={imageSize}
        annotations={annotations}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onDelete={handleDelete}
        onToggleVisible={handleToggleVisible}
        onToggleLock={handleToggleLock}
        onEditLabel={handleEditLabel}
        onExport={handleExport}
        fillOpacity={fillOpacity}
        onFillOpacityChange={setFillOpacity}
        showCrosshairs={showCrosshairs}
        onToggleCrosshairs={() => setShowCrosshairs(!showCrosshairs)}
        showImageName={showImageName}
        onToggleImageName={() => setShowImageName(!showImageName)}
        imageFilters={imageFilters}
        onUpdateFilters={setImageFilters}
        gridSettings={gridSettings}
        onUpdateGridSettings={setGridSettings}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
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