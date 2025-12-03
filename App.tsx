import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { Annotation, ToolType, ViewTransform, ShapeType } from './types';
import { COLORS, DEFAULT_LABEL } from './constants';
import { detectObjects } from './services/geminiService';
import { Upload } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);
  
  // Display Settings
  const [fillOpacity, setFillOpacity] = useState(0.2);
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  
  // Ref to access current image data for AI
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          // Center image
          const maxWidth = window.innerWidth - 384; // Toolbar + Sidebar approx
          const maxHeight = window.innerHeight;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height) * 0.9;
          setTransform({
            scale,
            x: (window.innerWidth - 64 - 320 - img.width * scale) / 2, // Center in canvas area
            y: (window.innerHeight - img.height * scale) / 2
          });
          setAnnotations([]);
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

  // Keyboard shortcuts (Zoom only here, others moved to CanvasArea for better context)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case 'v': setCurrentTool('select'); break;
        case 'h': setCurrentTool('pan'); break;
        case 'r': setCurrentTool('rectangle'); break;
        case 'p': setCurrentTool('polygon'); break;
        case '=': handleZoom('in'); break;
        case '-': handleZoom('out'); break;
        case '0': handleResetView(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageSize]);

  // AI Auto Labeling
  const handleAutoLabel = async () => {
    if (!imageSrc) return;
    setIsAutoLabeling(true);
    try {
      const detected = await detectObjects(imageSrc);
      
      const newAnnotations: Annotation[] = detected.map((obj, index) => {
        // Convert normalized coordinates to image coordinates
        const x1 = obj.xmin * imageSize.width;
        const y1 = obj.ymin * imageSize.height;
        const x2 = obj.xmax * imageSize.width;
        const y2 = obj.ymax * imageSize.height;

        return {
          id: Date.now().toString() + index,
          label: obj.label,
          type: 'rectangle',
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          color: COLORS[(annotations.length + index) % COLORS.length],
          visible: true
        };
      });

      setAnnotations(prev => [...prev, ...newAnnotations]);
    } catch (error) {
      alert("Failed to auto-detect objects. Check console and ensure valid API Key.");
    } finally {
      setIsAutoLabeling(false);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      imagePath: "image.png", // Placeholder
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
    downloadAnchorNode.setAttribute("download", "annotations.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const getNextColor = () => COLORS[annotations.length % COLORS.length];

  if (!imageSrc) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full border-2 border-dashed border-gray-700 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition-colors">
          <Upload size={48} className="text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Upload Image</h1>
          <p className="text-gray-400 mb-6 text-center">Select an image to start annotating with AI assistance.</p>
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
            Choose File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-gray-950 text-white font-sans">
      <Toolbar
        currentTool={currentTool}
        setTool={setCurrentTool}
        scale={transform.scale}
        onZoomIn={() => handleZoom('in')}
        onZoomOut={() => handleZoom('out')}
        onResetView={handleResetView}
      />
      
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
      />

      <Sidebar
        annotations={annotations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={(id) => {
          setAnnotations(prev => prev.filter(a => a.id !== id));
          if (selectedId === id) setSelectedId(null);
        }}
        onToggleVisible={(id) => {
          setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
        }}
        onChangeLabel={(id, label) => {
          setAnnotations(prev => prev.map(a => a.id === id ? { ...a, label } : a));
        }}
        onExport={handleExport}
        onAutoLabel={handleAutoLabel}
        isAutoLabeling={isAutoLabeling}
        fillOpacity={fillOpacity}
        onFillOpacityChange={setFillOpacity}
        showCrosshairs={showCrosshairs}
        onToggleCrosshairs={() => setShowCrosshairs(!showCrosshairs)}
      />
    </div>
  );
};

export default App;