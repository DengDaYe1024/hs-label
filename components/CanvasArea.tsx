import React, { useRef, useEffect, useState, CSSProperties } from 'react';
import { Annotation, Point, ToolType, ViewTransform, ImageSize } from '../types';
import { screenToImage, isPointNearVertex, getDistanceToSegment } from '../utils/geometry';
import { X, RotateCcw, Move, ArrowLeft, MousePointer2 } from 'lucide-react';

interface CanvasAreaProps {
  imageSrc: string;
  imageSize: ImageSize;
  annotations: Annotation[];
  currentTool: ToolType;
  selectedId: string | null;
  transform: ViewTransform;
  onTransformChange: (t: ViewTransform) => void;
  onAnnotationsChange: (anns: Annotation[]) => void;
  onSelect: (id: string | null) => void;
  currentColor: string;
  fillOpacity: number;
  showCrosshairs: boolean;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  imageSrc,
  imageSize,
  annotations,
  currentTool,
  selectedId,
  transform,
  onTransformChange,
  onAnnotationsChange,
  onSelect,
  currentColor,
  fillOpacity,
  showCrosshairs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentMouseImagePos, setCurrentMouseImagePos] = useState<Point | null>(null);
  const [isHoveringStartPoint, setIsHoveringStartPoint] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<{ id: string, index: number, point: Point } | null>(null);
  
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
      // x' = mouseX - (mouseX - x) * (newScale / oldScale)
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

  // --- Keyboard Shortcuts (Spacebar, Esc, Backspace) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Drawing Shortcuts
      if (pendingPoly.length > 0) {
        if (e.key === 'Escape') handleCancelDraw();
        if (e.key === 'Backspace') handleUndoPoint();
        return;
      }
      if (pendingRectStart) {
        if (e.key === 'Escape') handleCancelDraw();
        return;
      }

      // Nudge Selected Shape
      if (selectedId && !activeVertex) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          onAnnotationsChange(annotations.map(ann => {
            if (ann.id !== selectedId) return ann;
            // Divide by scale so nudge feels consistent on screen
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
        setIsDragging(false); // Stop dragging if space is released
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, annotations, activeVertex, pendingPoly, pendingRectStart, onAnnotationsChange, transform.scale]);


  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const imgPos = screenToImage(pos.x, pos.y, transform);

    // 1. Pan Mode (Spacebar or Middle Click or Tool)
    if (currentTool === 'pan' || isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Only Left Click for Drawing/Editing
    if (e.button !== 0) return;
    
    e.stopPropagation();

    // 2. Editing Mode (Select Tool)
    if (currentTool === 'select') {
      
      // A. Check for Handle/Vertex Clicks
      if (selectedId) {
        const ann = annotations.find(a => a.id === selectedId);
        if (ann) {
          const threshold = 10 / transform.scale;
          
          if (ann.type === 'rectangle') {
            const x1 = Math.min(ann.points[0].x, ann.points[1].x);
            const y1 = Math.min(ann.points[0].y, ann.points[1].y);
            const x2 = Math.max(ann.points[0].x, ann.points[1].x);
            const y2 = Math.max(ann.points[0].y, ann.points[1].y);
            
            const corners = [
              { x: x1, y: y1 }, // 0: TL
              { x: x2, y: y1 }, // 1: TR
              { x: x2, y: y2 }, // 2: BR
              { x: x1, y: y2 }  // 3: BL
            ];
            
            const hitIndex = corners.findIndex(c => isPointNearVertex(c, imgPos, threshold, 1));
            if (hitIndex !== -1) {
              setActiveVertex({ id: selectedId, index: hitIndex });
              return;
            }

          } else if (ann.type === 'polygon') {
            // Check existing vertices
            const clickedVertexIndex = ann.points.findIndex(p => 
              isPointNearVertex(p, imgPos, threshold, 1)
            );
            
            if (clickedVertexIndex !== -1) {
              // Alt+Click to Delete Vertex
              if (e.altKey) {
                if (ann.points.length > 3) {
                  const newPoints = ann.points.filter((_, i) => i !== clickedVertexIndex);
                  onAnnotationsChange(annotations.map(a => a.id === selectedId ? { ...a, points: newPoints } : a));
                }
                return;
              }
              setActiveVertex({ id: selectedId, index: clickedVertexIndex });
              return;
            }
            
            // Check for Edge Click (Insert Point)
            if (hoveredEdge && hoveredEdge.id === selectedId) {
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
      // Iterate backwards to hit top-most first
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.visible) continue;
        
        // Simple BBox hit test
        const xs = ann.points.map(p => p.x);
        const ys = ann.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const buffer = 5 / transform.scale;
        
        if (imgPos.x >= minX - buffer && imgPos.x <= maxX + buffer && 
            imgPos.y >= minY - buffer && imgPos.y <= maxY + buffer) {
           onSelect(ann.id);
           setDragStart(imgPos);
           setIsDragging(true);
           return;
        }
      }
      
      onSelect(null);
      return;
    }

    // 3. Drawing Rectangle
    if (currentTool === 'rectangle') {
      setPendingRectStart(imgPos);
      return;
    }

    // 4. Drawing Polygon
    if (currentTool === 'polygon') {
      // Close loop if near start
      if (pendingPoly.length >= 3) {
        const startPoint = pendingPoly[0];
        const distToStart = Math.sqrt(
          Math.pow(imgPos.x - startPoint.x, 2) + Math.pow(imgPos.y - startPoint.y, 2)
        );
        const threshold = 15 / transform.scale;

        if (distToStart < threshold) {
          const newPoly: Annotation = {
            id: Date.now().toString(),
            label: 'object',
            type: 'polygon',
            points: pendingPoly,
            color: currentColor,
            visible: true,
          };
          onAnnotationsChange([...annotations, newPoly]);
          onSelect(newPoly.id);
          setPendingPoly([]);
          return;
        }
      }
      setPendingPoly(prev => [...prev, imgPos]);
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const imgPos = screenToImage(pos.x, pos.y, transform);
    
    // Clamp coordinates for display and drawing
    const clampedPos = {
      x: Math.max(0, Math.min(imgPos.x, imageSize.width)),
      y: Math.max(0, Math.min(imgPos.y, imageSize.height))
    };
    setCurrentMouseImagePos(clampedPos);

    // 1. Hover Logic for Polygon Closing
    if (currentTool === 'polygon' && pendingPoly.length >= 3) {
       const startPoint = pendingPoly[0];
       const dist = Math.sqrt(Math.pow(imgPos.x - startPoint.x, 2) + Math.pow(imgPos.y - startPoint.y, 2));
       setIsHoveringStartPoint(dist < 15 / transform.scale);
    } else {
       setIsHoveringStartPoint(false);
    }

    // 2. Hover Logic for Edge Insertion (Select Tool)
    if (currentTool === 'select' && selectedId && !activeVertex && !isDragging) {
      const ann = annotations.find(a => a.id === selectedId);
      if (ann && ann.type === 'polygon') {
        const edgeThreshold = 8 / transform.scale;
        let foundEdge = null;
        for (let i = 0; i < ann.points.length; i++) {
          const p1 = ann.points[i];
          const p2 = ann.points[(i + 1) % ann.points.length];
          const dist = getDistanceToSegment(imgPos, p1, p2);
          if (dist < edgeThreshold) {
            foundEdge = { id: selectedId, index: i, point: imgPos }; // Projection logic could be better, but mouse pos is fine for insert
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

    // 3. Panning
    if ((currentTool === 'pan' || isSpacePressed || (e.buttons === 4 && dragStart)) && isDragging && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      onTransformChange({
        ...transform,
        x: transform.x + dx,
        y: transform.y + dy,
      });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 4. Vertex Editing
    if (activeVertex) {
      const ann = annotations.find(a => a.id === activeVertex.id);
      if (!ann) return;

      if (ann.type === 'rectangle') {
        let x1 = Math.min(ann.points[0].x, ann.points[1].x);
        let y1 = Math.min(ann.points[0].y, ann.points[1].y);
        let x2 = Math.max(ann.points[0].x, ann.points[1].x);
        let y2 = Math.max(ann.points[0].y, ann.points[1].y);

        // 0: TL, 1: TR, 2: BR, 3: BL
        switch(activeVertex.index) {
          case 0: x1 = imgPos.x; y1 = imgPos.y; break;
          case 1: x2 = imgPos.x; y1 = imgPos.y; break;
          case 2: x2 = imgPos.x; y2 = imgPos.y; break;
          case 3: x1 = imgPos.x; y2 = imgPos.y; break;
        }
        const newAnn = { ...ann, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
        onAnnotationsChange(annotations.map(a => a.id === ann.id ? newAnn : a));

      } else {
        // Polygon
        const newAnns = annotations.map(a => {
          if (a.id !== activeVertex.id) return a;
          const newPoints = [...a.points];
          newPoints[activeVertex.index] = imgPos;
          return { ...a, points: newPoints };
        });
        onAnnotationsChange(newAnns);
      }
      return;
    }

    // 5. Move Shape
    if (currentTool === 'select' && isDragging && dragStart && selectedId) {
       const dx = imgPos.x - dragStart.x;
       const dy = imgPos.y - dragStart.y;
       
       const newAnns = annotations.map(ann => {
          if (ann.id !== selectedId) return ann;
          return {
            ...ann,
            points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
          };
       });
       onAnnotationsChange(newAnns);
       setDragStart(imgPos); 
       return;
    }
  };

  const handleMouseUp = () => {
    // Finish Rectangle
    if (currentTool === 'rectangle' && pendingRectStart && currentMouseImagePos) {
      const w = Math.abs(pendingRectStart.x - currentMouseImagePos.x);
      const h = Math.abs(pendingRectStart.y - currentMouseImagePos.y);
      
      if (w > 2 && h > 2) { // Minimum 2px size
        const x1 = Math.min(pendingRectStart.x, currentMouseImagePos.x);
        const y1 = Math.min(pendingRectStart.y, currentMouseImagePos.y);
        const x2 = Math.max(pendingRectStart.x, currentMouseImagePos.x);
        const y2 = Math.max(pendingRectStart.y, currentMouseImagePos.y);

        const newRect: Annotation = {
          id: Date.now().toString(),
          label: 'object',
          type: 'rectangle',
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          color: currentColor,
          visible: true
        };
        onAnnotationsChange([...annotations, newRect]);
        onSelect(newRect.id);
      }
      setPendingRectStart(null);
    }

    setIsDragging(false);
    setActiveVertex(null);
  };

  // Determine Cursor
  let cursorStyle = 'default';
  if (currentTool === 'pan' || isSpacePressed) {
    cursorStyle = isDragging ? 'grabbing' : 'grab';
  } else if (currentTool === 'rectangle' || currentTool === 'polygon') {
    cursorStyle = 'crosshair';
  } else if (hoveredEdge) {
    cursorStyle = 'copy'; // Indicate add point
  } else if (currentTool === 'select' && activeVertex === null && selectedId) {
      // Logic could be refined to show 'move' only when hovering selected shape body
      cursorStyle = 'default';
  }

  const containerStyle = {
    '--scale': transform.scale,
    cursor: cursorStyle
  } as CSSProperties;

  return (
    <div className="flex-1 relative bg-gray-950 overflow-hidden flex flex-col">
      
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden outline-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={containerStyle}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: imageSize.width,
            height: imageSize.height,
            position: 'absolute',
            pointerEvents: 'none',
          }}
        >
          {/* Image */}
          <img
            src={imageSrc}
            alt="Workspace"
            className="select-none pointer-events-none"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />

          {/* SVG Overlay */}
          <svg
            width={imageSize.width}
            height={imageSize.height}
            className="absolute top-0 left-0 overflow-visible pointer-events-auto"
          >
            {/* 1. Existing Annotations */}
            {annotations.map((ann) => {
               if (!ann.visible) return null;
               const isSelected = selectedId === ann.id;
               
               const strokeWidth = `calc(${isSelected ? 3 : 2}px / var(--scale))`;
               const vertexRadius = `calc(${isSelected ? 5 : 3.5}px / var(--scale))`;

               if (ann.type === 'rectangle') {
                 const x1 = Math.min(ann.points[0].x, ann.points[1].x);
                 const y1 = Math.min(ann.points[0].y, ann.points[1].y);
                 const w = Math.abs(ann.points[1].x - ann.points[0].x);
                 const h = Math.abs(ann.points[1].y - ann.points[0].y);

                 const handles = isSelected ? [
                    { x: x1, y: y1, cursor: 'nw-resize' },
                    { x: x1 + w, y: y1, cursor: 'ne-resize' },
                    { x: x1 + w, y: y1 + h, cursor: 'se-resize' },
                    { x: x1, y: y1 + h, cursor: 'sw-resize' }
                 ] : [];

                 return (
                   <g key={ann.id}>
                     <rect
                       x={x1} y={y1} width={w} height={h}
                       fill={ann.color}
                       fillOpacity={fillOpacity}
                       stroke={ann.color}
                       style={{ strokeWidth, vectorEffect: 'non-scaling-stroke' }}
                     />
                     {handles.map((h, idx) => (
                       <circle
                         key={idx}
                         cx={h.x} cy={h.y}
                         r={0}
                         fill="white"
                         stroke={ann.color}
                         style={{ r: vertexRadius, strokeWidth: `calc(1.5px / var(--scale))`, cursor: h.cursor }}
                       />
                     ))}
                   </g>
                 );
               } else {
                 // Polygon
                 const pointsStr = ann.points.map(p => `${p.x},${p.y}`).join(' ');
                 return (
                   <g key={ann.id}>
                     <polygon
                       points={pointsStr}
                       fill={ann.color}
                       fillOpacity={fillOpacity}
                       stroke={ann.color}
                       style={{ strokeWidth, vectorEffect: 'non-scaling-stroke' }}
                     />
                     {isSelected && ann.points.map((p, idx) => (
                       <circle
                         key={idx}
                         cx={p.x} cy={p.y}
                         r={0}
                         fill="white"
                         stroke={ann.color}
                         style={{ 
                           r: vertexRadius, 
                           strokeWidth: `calc(1.5px / var(--scale))`,
                           cursor: 'move'
                         }}
                       />
                     ))}
                     {/* Hovered Edge Indicator */}
                     {hoveredEdge && hoveredEdge.id === ann.id && (
                       <circle
                         cx={hoveredEdge.point.x} cy={hoveredEdge.point.y}
                         r={0}
                         fill={ann.color}
                         stroke="white"
                         style={{ r: vertexRadius, strokeWidth: `calc(1px / var(--scale))`, opacity: 0.8 }}
                       />
                     )}
                   </g>
                 );
               }
            })}

            {/* 2. Pending Drawings */}
            {currentTool === 'rectangle' && pendingRectStart && currentMouseImagePos && (
              <rect
                x={Math.min(pendingRectStart.x, currentMouseImagePos.x)}
                y={Math.min(pendingRectStart.y, currentMouseImagePos.y)}
                width={Math.abs(currentMouseImagePos.x - pendingRectStart.x)}
                height={Math.abs(currentMouseImagePos.y - pendingRectStart.y)}
                fill={currentColor}
                fillOpacity={0.2}
                stroke={currentColor}
                strokeDasharray="4"
                style={{ strokeWidth: `calc(2px / var(--scale))` }}
              />
            )}

            {currentTool === 'polygon' && pendingPoly.length > 0 && (
              <g>
                <polyline
                  points={pendingPoly.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={currentColor}
                  style={{ strokeWidth: `calc(2px / var(--scale))` }}
                />
                {currentMouseImagePos && (
                  <line
                    x1={pendingPoly[pendingPoly.length - 1].x}
                    y1={pendingPoly[pendingPoly.length - 1].y}
                    x2={currentMouseImagePos.x}
                    y2={currentMouseImagePos.y}
                    stroke={currentColor}
                    strokeDasharray="4"
                    style={{ strokeWidth: `calc(1px / var(--scale))` }}
                  />
                )}
                {pendingPoly.map((p, i) => (
                   <circle
                     key={i}
                     cx={p.x}
                     cy={p.y}
                     r={0}
                     fill={i === 0 && isHoveringStartPoint ? '#fff' : currentColor}
                     stroke={currentColor}
                     style={{ 
                       r: i === 0 && isHoveringStartPoint 
                          ? `calc(8px / var(--scale))` 
                          : `calc(3px / var(--scale))`,
                       strokeWidth: `calc(1px / var(--scale))`
                     }}
                   />
                ))}
              </g>
            )}
            
            {/* 3. Crosshairs */}
            {showCrosshairs && currentMouseImagePos && (
               <g style={{ pointerEvents: 'none' }}>
                 <line 
                   x1={0} y1={currentMouseImagePos.y} 
                   x2={imageSize.width} y2={currentMouseImagePos.y}
                   stroke="rgba(255,255,255,0.6)"
                   style={{ strokeWidth: `calc(1px / var(--scale))` }}
                   strokeDasharray="3"
                 />
                 <line 
                   x1={currentMouseImagePos.x} y1={0} 
                   x2={currentMouseImagePos.x} y2={imageSize.height}
                   stroke="rgba(255,255,255,0.6)"
                   style={{ strokeWidth: `calc(1px / var(--scale))` }}
                   strokeDasharray="3"
                 />
               </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer Info */}
      <div className="h-8 bg-gray-900 border-t border-gray-700 flex items-center justify-between px-4 text-xs text-gray-400 select-none z-20">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1 tabular-nums">
            <Move size={12} />
            <span>
              {currentMouseImagePos ? Math.round(currentMouseImagePos.x) : 0}, 
              {currentMouseImagePos ? Math.round(currentMouseImagePos.y) : 0}
            </span>
          </span>
          <span className="tabular-nums">
            Zoom: {Math.round(transform.scale * 100)}%
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
           {selectedId && (
              <span className="text-gray-300 flex items-center gap-1">
                 <MousePointer2 size={12}/> Edit Mode
              </span>
           )}
           {pendingPoly.length > 0 && (
             <div className="flex items-center space-x-2 animate-pulse text-blue-400 font-semibold">
               <span>Drawing Polygon...</span>
               <button onClick={handleUndoPoint} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded hover:bg-gray-700">
                 <ArrowLeft size={10} /> Backspace
               </button>
               <button onClick={handleCancelDraw} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded hover:bg-gray-700 text-red-300">
                 <X size={10} /> Esc
               </button>
             </div>
           )}
           <div className="hidden md:flex space-x-3 text-gray-500">
             <span>Space+Drag to Pan</span>
             <span>Wheel to Zoom</span>
             <span>Alt+Click Del Point</span>
           </div>
        </div>
      </div>
    </div>
  );
};
