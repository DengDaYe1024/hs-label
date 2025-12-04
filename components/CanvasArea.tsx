import React, { useRef, useEffect, useState, CSSProperties } from 'react';
import { Annotation, Point, ToolType, ViewTransform, ImageSize, KeyMap, ImageFilters, GridSettings } from '../types';
import { screenToImage, isPointNearVertex, getDistanceToSegment, imageToScreen, getAnnotationArea } from '../utils/geometry';
import { getLabelName } from '../constants';
import { isShortcutPressed } from '../utils/keyboard';

interface CanvasAreaProps {
  imageSrc: string;
  fileName: string | null;
  showImageName: boolean;
  imageSize: ImageSize;
  annotations: Annotation[];
  currentTool: ToolType;
  selectedIds: string[];
  transform: ViewTransform;
  onTransformChange: (t: ViewTransform) => void;
  onAnnotationsChange: (anns: Annotation[]) => void;
  onSelect: (ids: string[]) => void;
  currentColor: string;
  fillOpacity: number;
  showCrosshairs: boolean;
  onShapeComplete: (id: string, screenPos: Point) => void;
  onSnapshot: (action: string) => void;
  keyMap: KeyMap;
  padding: { x: number; y: number };
  imageFilters: ImageFilters;
  gridSettings: GridSettings;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  imageSrc,
  fileName,
  showImageName,
  imageSize,
  annotations,
  currentTool,
  selectedIds,
  transform,
  onTransformChange,
  onAnnotationsChange,
  onSelect,
  currentColor,
  fillOpacity,
  showCrosshairs,
  onShapeComplete,
  onSnapshot,
  keyMap,
  padding,
  imageFilters,
  gridSettings
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentMouseImagePos, setCurrentMouseImagePos] = useState<Point | null>(null);
  const [isHoveringStartPoint, setIsHoveringStartPoint] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<{ id: string, index: number, point: Point } | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<Point | null>(null);
  
  // Drawing states
  const [pendingPoly, setPendingPoly] = useState<Point[]>([]);
  const [pendingRectStart, setPendingRectStart] = useState<Point | null>(null);

  // Editing states
  const [activeVertex, setActiveVertex] = useState<{ id: string; index: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Helper to get mouse pos relative to container
  const getMousePos = (e: MouseEvent | React.MouseEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Coordinate Conversion Helper with Padding
  const getRelativeImagePos = (e: MouseEvent | React.MouseEvent): Point => {
    const pos = getMousePos(e);
    // screenToImage returns pos relative to transform origin
    const rawPos = screenToImage(pos.x, pos.y, transform);
    // Adjust for padding offset
    return {
      x: rawPos.x - padding.x,
      y: rawPos.y - padding.y
    };
  };

  const handleCancelDraw = () => {
    setPendingPoly([]);
    setPendingRectStart(null);
  };

  const handleUndoPoint = () => {
    setPendingPoly(prev => prev.slice(0, -1));
  };

  // --- Wheel Zoom Logic (Mouse Centered) ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll
      
      const zoomIntensity = 0.1;
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = 1 + (direction * zoomIntensity);

      // Current mouse position relative to container
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new scale
      let newScale = transform.scale * factor;
      newScale = Math.max(0.1, Math.min(newScale, 50)); // Clamp zoom 0.1x to 50x

      // Calculate new offset to keep mouse position stable
      const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
      const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

      onTransformChange({
        scale: newScale,
        x: newX,
        y: newY
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [transform, onTransformChange]);

  // --- Keyboard Shortcuts (Spacebar, Esc, Backspace, Nudge) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      if (pendingPoly.length > 0) {
        if (isShortcutPressed(e, keyMap.CANCEL)) handleCancelDraw();
        if (isShortcutPressed(e, keyMap.BACKSPACE_POINT)) handleUndoPoint();
        return;
      }
      if (pendingRectStart) {
        if (isShortcutPressed(e, keyMap.CANCEL)) handleCancelDraw();
        return;
      }

      // Nudge selected items
      if (selectedIds.length > 0 && !activeVertex) {
        // Don't nudge if any selected item is locked
        const hasLocked = selectedIds.some(id => annotations.find(a => a.id === id)?.locked);
        if (hasLocked) return;

        let dx = 0, dy = 0;
        
        if (isShortcutPressed(e, keyMap.NUDGE_LEFT)) dx = -1;
        else if (isShortcutPressed(e, keyMap.NUDGE_RIGHT)) dx = 1;
        else if (isShortcutPressed(e, keyMap.NUDGE_UP)) dy = -1;
        else if (isShortcutPressed(e, keyMap.NUDGE_DOWN)) dy = 1;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          
          const step = e.shiftKey ? 10 : 1;
          dx *= step;
          dy *= step;

          onSnapshot('位置微调'); 
          onAnnotationsChange(annotations.map(ann => {
            if (!selectedIds.includes(ann.id)) return ann;
            const scaleFactor = 1 / transform.scale; 
            return {
              ...ann,
              points: ann.points.map(p => ({ x: p.x + dx * scaleFactor, y: p.y + dy * scaleFactor }))
            };
          }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsDragging(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, annotations, activeVertex, pendingPoly, pendingRectStart, onAnnotationsChange, transform.scale, onSnapshot, keyMap]);


  const handleMouseDown = (e: React.MouseEvent) => {
    const imgPos = getRelativeImagePos(e);

    if (currentTool === 'pan' || isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;
    
    e.stopPropagation();

    // 2. Editing Mode (Select Tool)
    if (currentTool === 'select') {
      
      // A. Check for Handle/Vertex Clicks (Only if exactly one item selected)
      if (selectedIds.length === 1) {
        const selectedId = selectedIds[0];
        const ann = annotations.find(a => a.id === selectedId);
        if (ann && !ann.locked) {
          const threshold = 10 / transform.scale;
          
          if (ann.type === 'rectangle') {
            const x1 = Math.min(ann.points[0].x, ann.points[1].x);
            const y1 = Math.min(ann.points[0].y, ann.points[1].y);
            const x2 = Math.max(ann.points[0].x, ann.points[1].x);
            const y2 = Math.max(ann.points[0].y, ann.points[1].y);
            
            const corners = [
              { x: x1, y: y1 }, 
              { x: x2, y: y1 }, 
              { x: x2, y: y2 }, 
              { x: x1, y: y2 } 
            ];
            
            const hitIndex = corners.findIndex(c => isPointNearVertex(c, imgPos, threshold, 1));
            if (hitIndex !== -1) {
              onSnapshot('调整矩形大小');
              setActiveVertex({ id: selectedId, index: hitIndex });
              return;
            }

          } else if (ann.type === 'polygon') {
            const clickedVertexIndex = ann.points.findIndex(p => 
              isPointNearVertex(p, imgPos, threshold, 1)
            );
            
            if (clickedVertexIndex !== -1) {
              if (e.altKey) {
                if (ann.points.length > 3) {
                  onSnapshot('删除顶点');
                  const newPoints = ann.points.filter((_, i) => i !== clickedVertexIndex);
                  onAnnotationsChange(annotations.map(a => a.id === selectedId ? { ...a, points: newPoints } : a));
                }
                return;
              }
              onSnapshot('调整顶点');
              setActiveVertex({ id: selectedId, index: clickedVertexIndex });
              return;
            }
            
            if (hoveredEdge && hoveredEdge.id === selectedId) {
               onSnapshot('添加顶点');
               const newPoints = [...ann.points];
               newPoints.splice(hoveredEdge.index + 1, 0, hoveredEdge.point);
               const newAnn = { ...ann, points: newPoints };
               onAnnotationsChange(annotations.map(a => a.id === selectedId ? newAnn : a));
               setActiveVertex({ id: selectedId, index: hoveredEdge.index + 1 });
               setHoveredEdge(null);
               return;
            }
          }
        }
      }

      // B. Check for Shape Body Click (Select & Move)
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.visible) continue;
        // Don't check for lock here to allow selection (we prevent drag later)
        // But typical UX is you can't even select locked items directly on canvas
        if (ann.locked) continue; 
        
        const xs = ann.points.map(p => p.x);
        const ys = ann.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const buffer = 5 / transform.scale;
        
        if (imgPos.x >= minX - buffer && imgPos.x <= maxX + buffer && 
            imgPos.y >= minY - buffer && imgPos.y <= maxY + buffer) {
           
           // Multi-selection logic
           if (e.ctrlKey || e.metaKey) {
             if (selectedIds.includes(ann.id)) {
               onSelect(selectedIds.filter(id => id !== ann.id));
             } else {
               onSelect([...selectedIds, ann.id]);
             }
           } else {
             if (!selectedIds.includes(ann.id)) {
                onSelect([ann.id]);
             }
             // If already selected and no ctrl key, keep selection (to allow batch drag)
           }

           onSnapshot('移动标注');
           setDragStart(imgPos);
           setIsDragging(true);
           return;
        }
      }
      
      // Clicked on empty space
      if (!e.shiftKey) { // Shift key might be used for marquee selection (future), for now clear
         onSelect([]);
      }
      return;
    }

    // 3. Drawing Rectangle
    if (currentTool === 'rectangle') {
      onSnapshot('创建矩形');
      setPendingRectStart(imgPos);
      return;
    }

    // 4. Drawing Polygon
    if (currentTool === 'polygon') {
      if (pendingPoly.length === 0) onSnapshot('创建多边形');

      if (pendingPoly.length >= 3) {
        const startPoint = pendingPoly[0];
        const distToStart = Math.sqrt(
          Math.pow(imgPos.x - startPoint.x, 2) + Math.pow(imgPos.y - startPoint.y, 2)
        );
        const threshold = 15 / transform.scale;

        if (distToStart < threshold) {
          const newPoly: Annotation = {
            id: Date.now().toString(),
            label: 'defect',
            type: 'polygon',
            points: pendingPoly,
            color: currentColor,
            visible: true,
            locked: false
          };
          onAnnotationsChange([...annotations, newPoly]);
          onSelect([newPoly.id]);
          setPendingPoly([]);
          
          const centerX = pendingPoly.reduce((sum, p) => sum + p.x, 0) / pendingPoly.length;
          const centerY = pendingPoly.reduce((sum, p) => sum + p.y, 0) / pendingPoly.length;
          const screenPos = imageToScreen(centerX + padding.x, centerY + padding.y, transform);
          onShapeComplete(newPoly.id, screenPos);
          return;
        }
      }
      setPendingPoly(prev => [...prev, imgPos]);
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const imgPos = getRelativeImagePos(e);
    
    const clampedPos = {
      x: Math.max(0, Math.min(imgPos.x, imageSize.width)),
      y: Math.max(0, Math.min(imgPos.y, imageSize.height))
    };
    setCurrentMouseImagePos(clampedPos);

    if (currentTool === 'polygon' && pendingPoly.length >= 3) {
       const startPoint = pendingPoly[0];
       const dist = Math.sqrt(Math.pow(imgPos.x - startPoint.x, 2) + Math.pow(imgPos.y - startPoint.y, 2));
       setIsHoveringStartPoint(dist < 15 / transform.scale);
    } else {
       setIsHoveringStartPoint(false);
    }

    if (currentTool === 'select' && selectedIds.length === 1 && !activeVertex && !isDragging) {
      const selectedId = selectedIds[0];
      const ann = annotations.find(a => a.id === selectedId);
      if (ann && ann.type === 'polygon' && !ann.locked) {
        const edgeThreshold = 8 / transform.scale;
        let foundEdge = null;
        for (let i = 0; i < ann.points.length; i++) {
          const p1 = ann.points[i];
          const p2 = ann.points[(i + 1) % ann.points.length];
          const dist = getDistanceToSegment(imgPos, p1, p2);
          if (dist < edgeThreshold) {
            foundEdge = { id: selectedId, index: i, point: imgPos }; 
            break;
          }
        }
        setHoveredEdge(foundEdge);
      } else {
        setHoveredEdge(null);
      }
    } else {
      setHoveredEdge(null);
    }

    if (!isDragging && !pendingRectStart && pendingPoly.length === 0) {
      let foundId = null;
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.visible) continue;
        
        const xs = ann.points.map(p => p.x);
        const ys = ann.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const buffer = 5 / transform.scale;
        
        if (imgPos.x >= minX - buffer && imgPos.x <= maxX + buffer && 
            imgPos.y >= minY - buffer && imgPos.y <= maxY + buffer) {
             foundId = ann.id;
             break;
        }
      }
      setHoveredAnnotationId(foundId);
      if (foundId) {
         setTooltipPos(pos);
      } else {
         setTooltipPos(null);
      }
    } else {
      setHoveredAnnotationId(null);
      setTooltipPos(null);
    }

    if ((currentTool === 'pan' || isSpacePressed || e.button === 1) && isDragging && dragStart) {
       const dx = e.clientX - dragStart.x;
       const dy = e.clientY - dragStart.y;
       onTransformChange({
         ...transform,
         x: transform.x + dx,
         y: transform.y + dy
       });
       setDragStart({ x: e.clientX, y: e.clientY });
       return;
    }

    if (isDragging && dragStart && selectedIds.length > 0 && !activeVertex && currentTool === 'select') {
      // Check if any selected item is locked
      const hasLocked = selectedIds.some(id => annotations.find(a => a.id === id)?.locked);
      if (hasLocked) return;

      const dx = imgPos.x - dragStart.x; 
      const dy = imgPos.y - dragStart.y; 

      const newAnnotations = annotations.map(ann => {
        if (!selectedIds.includes(ann.id)) return ann;
        return {
          ...ann,
          points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        };
      });
      onAnnotationsChange(newAnnotations);
      setDragStart(imgPos); 
      return;
    }

    if (activeVertex && selectedIds.length === 1) {
      const selectedId = selectedIds[0];
      const ann = annotations.find(a => a.id === selectedId);
      if (!ann || ann.locked) return;

      if (ann.type === 'rectangle') {
        const p1 = ann.points[0];
        const p2 = ann.points[1];
        
        let newP1 = { ...p1 };
        let newP2 = { ...p2 };
        
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (activeVertex.index === 0) { // TL
           newP1 = { x: imgPos.x, y: imgPos.y };
           newP2 = { x: maxX, y: maxY };
        } else if (activeVertex.index === 1) { // TR
           newP1 = { x: minX, y: imgPos.y };
           newP2 = { x: imgPos.x, y: maxY };
        } else if (activeVertex.index === 2) { // BR
           newP1 = { x: minX, y: minY };
           newP2 = { x: imgPos.x, y: imgPos.y };
        } else if (activeVertex.index === 3) { // BL
           newP1 = { x: imgPos.x, y: minY };
           newP2 = { x: maxX, y: imgPos.y };
        }

        const newAnn = { ...ann, points: [newP1, newP2] };
        onAnnotationsChange(annotations.map(a => a.id === selectedId ? newAnn : a));

      } else {
        const newPoints = [...ann.points];
        newPoints[activeVertex.index] = imgPos;
        const newAnn = { ...ann, points: newPoints };
        onAnnotationsChange(annotations.map(a => a.id === selectedId ? newAnn : a));
      }
      return;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setActiveVertex(null);

    if (pendingRectStart && currentTool === 'rectangle') {
      const imgPos = currentMouseImagePos || { x: 0, y: 0 };
      
      if (Math.abs(imgPos.x - pendingRectStart.x) > 1 && Math.abs(imgPos.y - pendingRectStart.y) > 1) {
        const newRect: Annotation = {
          id: Date.now().toString(),
          label: 'defect',
          type: 'rectangle',
          points: [pendingRectStart, imgPos],
          color: currentColor,
          visible: true,
          locked: false
        };
        onAnnotationsChange([...annotations, newRect]);
        onSelect([newRect.id]);
        
        const centerX = (pendingRectStart.x + imgPos.x) / 2;
        const centerY = (pendingRectStart.y + imgPos.y) / 2;
        const screenPos = imageToScreen(centerX + padding.x, centerY + padding.y, transform);
        onShapeComplete(newRect.id, screenPos);
      }
      setPendingRectStart(null);
    }
  };

  const style = {
    '--scale': transform.scale,
    cursor: isSpacePressed ? 'grab' : 
            currentTool === 'pan' ? (isDragging ? 'grabbing' : 'grab') :
            currentTool === 'rectangle' || currentTool === 'polygon' ? 'crosshair' : 
            hoveredEdge ? 'copy' :
            'default'
  } as React.CSSProperties;

  return (
    <div 
      className="flex-1 bg-gray-950 overflow-hidden relative select-none"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={style}
    >
      {showImageName && fileName && (
        <div className="absolute top-4 left-4 pointer-events-none z-50 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded text-xs text-white/80 font-mono border border-white/10 shadow-sm">
          {fileName}
        </div>
      )}

      <div 
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <div style={{ transform: `translate(${padding.x}px, ${padding.y}px)` }}>
            {/* 1. Image Layer with Filters */}
            <img 
              src={imageSrc} 
              alt="Workspace"
              className="pointer-events-none select-none block shadow-2xl transition-[filter] duration-200"
              style={{
                width: imageSize.width,
                height: imageSize.height,
                maxWidth: 'none',
                filter: `brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%) saturate(${imageFilters.saturation}%)`
              }}
              draggable={false}
            />

            {/* 2. SVG Overlay Layer */}
            <svg
              className="absolute top-0 left-0 pointer-events-none overflow-visible"
              width={imageSize.width}
              height={imageSize.height}
            >
              <defs>
                 {gridSettings.visible && (
                   <pattern id="gridPattern" width={gridSettings.size} height={gridSettings.size} patternUnits="userSpaceOnUse">
                      <path 
                        d={`M ${gridSettings.size} 0 L 0 0 0 ${gridSettings.size}`} 
                        fill="none" 
                        stroke={gridSettings.color} 
                        vectorEffect="non-scaling-stroke" 
                        style={{ strokeWidth: "calc(1px / var(--scale))" }}
                      />
                   </pattern>
                 )}
              </defs>

              {/* === Layer 1: Grid === */}
              {gridSettings.visible && (
                 <rect width="100%" height="100%" fill="url(#gridPattern)" />
              )}

              {/* === Layer 2: Annotation Bodies (Completed) === */}
              {annotations.map((ann) => {
                if (!ann.visible) return null;
                const isSelected = selectedIds.includes(ann.id);
                const isHovered = hoveredAnnotationId === ann.id;
                
                const opacity = isSelected ? Math.min(0.8, fillOpacity + 0.3) : isHovered ? Math.min(0.6, fillOpacity + 0.1) : fillOpacity;
                const strokeColor = ann.locked ? '#fbbf24' : ann.color;
                
                const strokeWidth = isSelected || isHovered ? "calc(3px / var(--scale))" : "calc(2px / var(--scale))";

                if (ann.type === 'rectangle') {
                  const x = Math.min(ann.points[0].x, ann.points[1].x);
                  const y = Math.min(ann.points[0].y, ann.points[1].y);
                  const w = Math.abs(ann.points[0].x - ann.points[1].x);
                  const h = Math.abs(ann.points[0].y - ann.points[1].y);

                  return (
                    <g key={ann.id} style={{ opacity: ann.locked ? 0.7 : 1 }}>
                      <rect
                        x={x} y={y} width={w} height={h}
                        fill={ann.color}
                        fillOpacity={opacity}
                        stroke={strokeColor}
                        style={{ strokeWidth }}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={ann.locked ? "4 2" : "none"} 
                      />
                    </g>
                  );
                } else {
                  const pointsStr = ann.points.map(p => `${p.x},${p.y}`).join(' ');
                  return (
                     <g key={ann.id} style={{ opacity: ann.locked ? 0.7 : 1 }}>
                       <polygon
                         points={pointsStr}
                         fill={ann.color}
                         fillOpacity={opacity}
                         stroke={strokeColor}
                         style={{ strokeWidth }}
                         strokeLinejoin="round"
                         strokeDasharray={ann.locked ? "4 2" : "none"}
                       />
                     </g>
                  );
                }
              })}

              {/* === Layer 3: Pending Shapes (Drawing) === */}
              {pendingRectStart && currentTool === 'rectangle' && currentMouseImagePos && (
                <rect
                  x={Math.min(pendingRectStart.x, currentMouseImagePos.x)}
                  y={Math.min(pendingRectStart.y, currentMouseImagePos.y)}
                  width={Math.abs(currentMouseImagePos.x - pendingRectStart.x)}
                  height={Math.abs(currentMouseImagePos.y - pendingRectStart.y)}
                  fill={currentColor}
                  fillOpacity={0.2}
                  stroke={currentColor}
                  style={{ strokeWidth: "calc(2px / var(--scale))" }}
                  strokeDasharray="4"
                />
              )}

              {pendingPoly.length > 0 && currentTool === 'polygon' && (
                <g>
                   <polyline
                     points={pendingPoly.map(p => `${p.x},${p.y}`).join(' ')}
                     fill="none"
                     stroke={currentColor}
                     style={{ strokeWidth: "calc(2px / var(--scale))" }}
                   />
                   {currentMouseImagePos && (
                     <line
                       x1={pendingPoly[pendingPoly.length - 1].x}
                       y1={pendingPoly[pendingPoly.length - 1].y}
                       x2={currentMouseImagePos.x}
                       y2={currentMouseImagePos.y}
                       stroke={currentColor}
                       style={{ strokeWidth: "calc(2px / var(--scale))" }}
                       strokeDasharray="4"
                     />
                   )}
                   {pendingPoly.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x} cy={p.y}
                        r={i === 0 && isHoveringStartPoint ? "calc(8px / var(--scale))" : "calc(4px / var(--scale))"}
                        fill={i === 0 ? "white" : currentColor}
                        stroke={currentColor}
                        style={{ strokeWidth: "calc(1px / var(--scale))" }}
                      />
                   ))}
                </g>
              )}

              {/* === Layer 4: Interactive Overlays (Handles & Highlights) === */}
              {selectedIds.map((id) => {
                const ann = annotations.find(a => a.id === id);
                if (!ann || !ann.visible || ann.locked) return null;

                // Only show handles if single selection to avoid clutter
                if (selectedIds.length > 1) return null; 

                const strokeColor = ann.color;
                const handleRadius = "calc(5px / var(--scale))";

                if (ann.type === 'rectangle') {
                   const x = Math.min(ann.points[0].x, ann.points[1].x);
                   const y = Math.min(ann.points[0].y, ann.points[1].y);
                   const w = Math.abs(ann.points[0].x - ann.points[1].x);
                   const h = Math.abs(ann.points[0].y - ann.points[1].y);
                   
                   return (
                     <g key={id}>
                        {[
                          { x: x, y: y }, 
                          { x: x + w, y: y }, 
                          { x: x + w, y: y + h }, 
                          { x: x, y: y + h } 
                        ].map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x} cy={p.y}
                            r={handleRadius} 
                            fill="white"
                            stroke={strokeColor}
                            style={{ strokeWidth: "calc(1.5px / var(--scale))" }}
                          />
                        ))}
                     </g>
                   );
                } else if (ann.type === 'polygon') {
                   return (
                     <g key={id}>
                        {ann.points.map((p, i) => (
                          <circle
                             key={i}
                             cx={p.x} cy={p.y}
                             r={handleRadius}
                             fill="white"
                             stroke={strokeColor}
                             style={{ strokeWidth: "calc(1.5px / var(--scale))" }}
                          />
                        ))}
                     </g>
                   );
                }
                return null;
              })}

              {/* Hovered Edge Indicator */}
              {hoveredEdge && (
                  <circle
                    cx={hoveredEdge.point.x}
                    cy={hoveredEdge.point.y}
                    r="calc(5px / var(--scale))"
                    fill={annotations.find(a => a.id === hoveredEdge?.id)?.color || 'white'}
                    opacity={0.8}
                  />
              )}

            </svg>
        </div>
      </div>
      
      {tooltipPos && hoveredAnnotationId && (
        <div 
          className="fixed z-50 px-2 py-1 bg-gray-900/90 text-white text-xs rounded border border-gray-700 pointer-events-none shadow-xl backdrop-blur-sm whitespace-nowrap"
          style={{ 
            left: tooltipPos.x + 15, 
            top: tooltipPos.y + 15 
          }}
        >
          {(() => {
            const ann = annotations.find(a => a.id === hoveredAnnotationId);
            if (!ann) return null;
            const area = getAnnotationArea(ann);
            const totalImageArea = imageSize.width * imageSize.height;
            const percentage = totalImageArea > 0 ? (area / totalImageArea * 100) : 0;
            return (
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-blue-300">
                  {getLabelName(ann.label).split('(')[0]} {ann.locked && '(Locked)'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {ann.type === 'rectangle' ? 'RECTANGLE' : 'POLYGON'} #{ann.id.slice(-4)}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  Area: {Math.round(area)}px² ({percentage < 0.01 ? '<0.01' : percentage.toFixed(2)}%)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {showCrosshairs && currentMouseImagePos && !isDragging && (
        <div className="absolute inset-0 pointer-events-none z-30 opacity-50">
           {/* Crosshair logic handled by cursor CSS */}
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-md border-t border-gray-800 text-gray-400 text-xs px-4 py-1.5 flex justify-between items-center z-40 select-none">
        <div className="flex gap-4 font-mono">
           {currentMouseImagePos ? (
             <span>
               X: {Math.round(currentMouseImagePos.x)}, Y: {Math.round(currentMouseImagePos.y)}
             </span>
           ) : (
             <span>Ready</span>
           )}
           {currentTool === 'polygon' && pendingPoly.length > 0 && (
             <span className="text-blue-400 font-bold">
               [多边形绘制中] 点: {pendingPoly.length} - 点击起点闭合 / Esc 取消 / Backspace 撤销点
             </span>
           )}
           {currentTool === 'rectangle' && pendingRectStart && (
             <span className="text-blue-400 font-bold">
               [矩形绘制中] 拖拽释放完成 / Esc 取消
             </span>
           )}
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-gray-500"></span>
             <span>Space+拖拽: 移动画布</span>
          </div>
          <div className="flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-gray-500"></span>
             <span>Ctrl+点击: 多选</span>
          </div>
          <div className="flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-gray-500"></span>
             <span>Shift+箭头: 快速微调</span>
          </div>
        </div>
      </div>
    </div>
  );
};