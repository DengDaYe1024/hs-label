import React, { useRef, useEffect, useState, CSSProperties } from 'react';
import { Annotation, Point, ToolType, ViewTransform, ImageSize, KeyMap } from '../types';
import { screenToImage, isPointNearVertex, getDistanceToSegment, imageToScreen } from '../utils/geometry';
import { getLabelName } from '../constants';
import { isShortcutPressed } from '../utils/keyboard';

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
  onShapeComplete: (id: string, screenPos: Point) => void;
  onSnapshot: () => void;
  keyMap: KeyMap;
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
  onShapeComplete,
  onSnapshot,
  keyMap
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

  // --- Keyboard Shortcuts (Spacebar, Esc, Backspace, Nudge) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      // Special handling for spacebar as it is often held down
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Drawing Shortcuts
      if (pendingPoly.length > 0) {
        if (isShortcutPressed(e, keyMap.CANCEL)) handleCancelDraw();
        if (isShortcutPressed(e, keyMap.BACKSPACE_POINT)) handleUndoPoint();
        return;
      }
      if (pendingRectStart) {
        if (isShortcutPressed(e, keyMap.CANCEL)) handleCancelDraw();
        return;
      }

      // Nudge Selected Shape
      if (selectedId && !activeVertex) {
        let dx = 0, dy = 0;
        
        if (isShortcutPressed(e, keyMap.NUDGE_LEFT)) dx = -1;
        else if (isShortcutPressed(e, keyMap.NUDGE_RIGHT)) dx = 1;
        else if (isShortcutPressed(e, keyMap.NUDGE_UP)) dy = -1;
        else if (isShortcutPressed(e, keyMap.NUDGE_DOWN)) dy = 1;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          
          // Multiply by 10 if Shift is held (hardcoded accelerator, or could be configurable)
          const step = e.shiftKey ? 10 : 1;
          dx *= step;
          dy *= step;

          onSnapshot(); // Snapshot before nudge
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
  }, [selectedId, annotations, activeVertex, pendingPoly, pendingRectStart, onAnnotationsChange, transform.scale, onSnapshot, keyMap]);


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
              onSnapshot(); // Snapshot before resize
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
                  onSnapshot();
                  const newPoints = ann.points.filter((_, i) => i !== clickedVertexIndex);
                  onAnnotationsChange(annotations.map(a => a.id === selectedId ? { ...a, points: newPoints } : a));
                }
                return;
              }
              onSnapshot();
              setActiveVertex({ id: selectedId, index: clickedVertexIndex });
              return;
            }
            
            // Check for Edge Click (Insert Point)
            if (hoveredEdge && hoveredEdge.id === selectedId) {
               onSnapshot();
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
           onSnapshot();
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
      onSnapshot();
      setPendingRectStart(imgPos);
      return;
    }

    // 4. Drawing Polygon
    if (currentTool === 'polygon') {
      if (pendingPoly.length === 0) onSnapshot();

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
          
          // Trigger label popup at center of polygon
          const centerX = pendingPoly.reduce((sum, p) => sum + p.x, 0) / pendingPoly.length;
          const centerY = pendingPoly.reduce((sum, p) => sum + p.y, 0) / pendingPoly.length;
          const screenPos = imageToScreen(centerX, centerY, transform);
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

    // 3. Hover Detection for Tooltip (When not dragging/drawing)
    if (!isDragging && !pendingRectStart && pendingPoly.length === 0) {
      let foundId = null;
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.visible) continue;
        
        // BBox Check (Reused from selection logic)
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

    // 4. Panning
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

    // 5. Dragging Whole Shape
    if (isDragging && dragStart && selectedId && !activeVertex && currentTool === 'select') {
      const dx = imgPos.x - dragStart.x; // Delta in image coordinates
      const dy = imgPos.y - dragStart.y; // This logic is slightly flawed for raw drag, better to use delta screen and convert

      // Improved Drag Logic:
      // We need delta in image space. 
      // Previous imgPos was `dragStart` (in image space). Current `imgPos`.
      // Delta = imgPos - dragStart.
      // But we update dragStart to current imgPos after applying.
      
      const newAnnotations = annotations.map(ann => {
        if (ann.id !== selectedId) return ann;
        return {
          ...ann,
          points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        };
      });
      onAnnotationsChange(newAnnotations);
      setDragStart(imgPos); // Reset drag start to current to avoid compounding acceleration
      return;
    }

    // 6. Dragging Vertex / Handle
    if (activeVertex && selectedId) {
      const ann = annotations.find(a => a.id === selectedId);
      if (!ann) return;

      if (ann.type === 'rectangle') {
        // Rectangle Resize Logic
        const p1 = ann.points[0];
        const p2 = ann.points[1];
        
        let newP1 = { ...p1 };
        let newP2 = { ...p2 };
        
        // Calculate current bounds
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        // activeVertex.index maps to: 0:TL, 1:TR, 2:BR, 3:BL
        // We update the bounds based on which corner is dragged
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
        // Polygon Vertex Move
        const newPoints = [...ann.points];
        newPoints[activeVertex.index] = imgPos;
        const newAnn = { ...ann, points: newPoints };
        onAnnotationsChange(annotations.map(a => a.id === selectedId ? newAnn : a));
      }
      return;
    }

    // 7. Drawing Rectangle
    if (pendingRectStart && currentTool === 'rectangle') {
       // Just visual update handled by render, nothing to commit yet
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setActiveVertex(null);

    // Finish Rectangle
    if (pendingRectStart && currentTool === 'rectangle') {
      const imgPos = currentMouseImagePos || { x: 0, y: 0 };
      
      // Prevent tiny rectangles
      if (Math.abs(imgPos.x - pendingRectStart.x) > 1 && Math.abs(imgPos.y - pendingRectStart.y) > 1) {
        const newRect: Annotation = {
          id: Date.now().toString(),
          label: 'object',
          type: 'rectangle',
          points: [pendingRectStart, imgPos],
          color: currentColor,
          visible: true
        };
        onAnnotationsChange([...annotations, newRect]);
        onSelect(newRect.id);
        
        // Popup
        const centerX = (pendingRectStart.x + imgPos.x) / 2;
        const centerY = (pendingRectStart.y + imgPos.y) / 2;
        const screenPos = imageToScreen(centerX, centerY, transform);
        onShapeComplete(newRect.id, screenPos);
      }
      setPendingRectStart(null);
    }
  };

  // --- Render Helpers ---
  
  // Dynamic CSS variables for high-performance rendering
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
      {/* Container for the transformable content */}
      <div 
        className="origin-top-left absolute will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {/* The Image */}
        <img 
          src={imageSrc} 
          alt="workarea" 
          className="block pointer-events-none"
          draggable={false}
        />

        {/* SVG Overlay */}
        <svg 
          width={imageSize.width} 
          height={imageSize.height}
          className="absolute top-0 left-0 overflow-visible"
        >
          {/* 1. Existing Annotations */}
          {annotations.map((ann) => {
            if (!ann.visible) return null;
            const isSelected = selectedId === ann.id;
            const isHovered = hoveredAnnotationId === ann.id;
            
            // Dynamic stroke width calculation using CSS vars
            const strokeWidth = isHovered ? "calc(3px / var(--scale))" : "calc(2px / var(--scale))";
            const opacity = isSelected || isHovered ? Math.max(0.4, fillOpacity) : fillOpacity;
            const dashArray = ""; // Could add dashed lines for specific types

            if (ann.type === 'rectangle') {
              const x = Math.min(ann.points[0].x, ann.points[1].x);
              const y = Math.min(ann.points[0].y, ann.points[1].y);
              const w = Math.abs(ann.points[0].x - ann.points[1].x);
              const h = Math.abs(ann.points[0].y - ann.points[1].y);

              return (
                <g key={ann.id}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    fill={ann.color}
                    fillOpacity={opacity}
                    stroke={ann.color}
                    style={{ strokeWidth }}
                  />
                  {/* Resize Handles (only if selected) */}
                  {isSelected && (
                     <>
                        {[
                          {x, y}, {x: x+w, y}, {x: x+w, y: y+h}, {x, y: y+h}
                        ].map((p, idx) => (
                           <rect
                             key={idx}
                             x={p.x} y={p.y}
                             width="1" height="1" // Size handled by stroke/scale
                             fill="white"
                             stroke="black"
                             style={{ 
                               strokeWidth: "calc(1px / var(--scale))",
                               transformBox: "fill-box",
                               transformOrigin: "center",
                               transform: "scale(calc(6 / var(--scale))) translate(-50%, -50%)"
                             }}
                           />
                        ))}
                     </>
                  )}
                </g>
              );
            } else {
              const pointsStr = ann.points.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <g key={ann.id}>
                  <polygon
                    points={pointsStr}
                    fill={ann.color}
                    fillOpacity={opacity}
                    stroke={ann.color}
                    style={{ strokeWidth }}
                  />
                  {/* Vertices (only if selected) */}
                  {isSelected && ann.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x} cy={p.y}
                      r="1" // Radius handled by scale
                      fill="white"
                      stroke="black"
                      style={{ 
                         strokeWidth: "calc(1px / var(--scale))",
                         transform: "scale(calc(4 / var(--scale)))"
                      }}
                    />
                  ))}
                  {/* Hover Edge Indicator */}
                  {hoveredEdge && hoveredEdge.id === ann.id && (
                    <circle
                      cx={hoveredEdge.point.x} cy={hoveredEdge.point.y}
                      r="1"
                      fill="lime"
                      stroke="black"
                      style={{ 
                         strokeWidth: "calc(1px / var(--scale))",
                         transform: "scale(calc(4 / var(--scale)))"
                      }}
                    />
                  )}
                </g>
              );
            }
          })}

          {/* 2. Pending Polygon */}
          {pendingPoly.length > 0 && (
            <g>
               <polyline
                 points={pendingPoly.map(p => `${p.x},${p.y}`).join(' ')}
                 fill="none"
                 stroke={currentColor}
                 style={{ strokeWidth: "calc(2px / var(--scale))" }}
               />
               {pendingPoly.map((p, idx) => (
                 <circle
                   key={idx}
                   cx={p.x} cy={p.y}
                   r="1"
                   fill="white"
                   stroke={currentColor}
                   style={{ 
                      strokeWidth: "calc(1px / var(--scale))",
                      transform: idx === 0 && isHoveringStartPoint ? "scale(calc(8 / var(--scale)))" : "scale(calc(4 / var(--scale)))",
                      transition: "transform 0.1s"
                   }}
                 />
               ))}
               {/* Rubber band line */}
               {currentMouseImagePos && (
                 <line
                   x1={pendingPoly[pendingPoly.length - 1].x}
                   y1={pendingPoly[pendingPoly.length - 1].y}
                   x2={currentMouseImagePos.x}
                   y2={currentMouseImagePos.y}
                   stroke={currentColor}
                   strokeDasharray="4,4"
                   style={{ strokeWidth: "calc(1.5px / var(--scale))" }}
                 />
               )}
            </g>
          )}

          {/* 3. Pending Rectangle */}
          {pendingRectStart && currentMouseImagePos && (
            <rect
              x={Math.min(pendingRectStart.x, currentMouseImagePos.x)}
              y={Math.min(pendingRectStart.y, currentMouseImagePos.y)}
              width={Math.abs(pendingRectStart.x - currentMouseImagePos.x)}
              height={Math.abs(pendingRectStart.y - currentMouseImagePos.y)}
              fill={currentColor}
              fillOpacity={0.2}
              stroke={currentColor}
              style={{ strokeWidth: "calc(2px / var(--scale))" }}
            />
          )}
        </svg>
      </div>
      
      {/* UI Overlays (Crosshairs, Tooltips, Coordinates) - Fixed Screen Position */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Crosshairs */}
        {showCrosshairs && currentMouseImagePos && (
          <>
             <div 
               className="absolute bg-blue-500/50" 
               style={{ 
                 left: 0, right: 0, height: '1px', 
                 top: (currentMouseImagePos.y * transform.scale + transform.y)
               }} 
             />
             <div 
               className="absolute bg-blue-500/50" 
               style={{ 
                 top: 0, bottom: 0, width: '1px', 
                 left: (currentMouseImagePos.x * transform.scale + transform.x) 
               }} 
             />
          </>
        )}

        {/* Hover Tooltip */}
        {tooltipPos && hoveredAnnotationId && (() => {
           const ann = annotations.find(a => a.id === hoveredAnnotationId);
           if (!ann) return null;
           return (
             <div 
               className="absolute z-50 bg-gray-900/90 text-white text-xs px-2 py-1 rounded shadow-lg border border-gray-700 pointer-events-none"
               style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}
             >
               <div className="font-bold">{getLabelName(ann.label).split('(')[0]}</div>
               <div className="text-gray-400 text-[10px]">{ann.type}</div>
             </div>
           );
        })()}

        {/* Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700 p-1 flex justify-between items-center px-4 text-[10px] text-gray-400">
           <div className="flex space-x-4">
             {currentMouseImagePos && (
               <span>X: {Math.round(currentMouseImagePos.x)} Y: {Math.round(currentMouseImagePos.y)}</span>
             )}
             {selectedId && <span>选中: #{selectedId.slice(-4)}</span>}
           </div>
           
           <div className="flex space-x-3">
             {pendingPoly.length > 0 && (
                <>
                  <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Enter</kbd> 完成</span>
                  <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Backspace</kbd> 撤销点</span>
                  <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Esc</kbd> 取消</span>
                </>
             )}
             {currentTool === 'select' && selectedId && (
               <>
                  <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Delete</kbd> 删除</span>
                  <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Arrows</kbd> 微调</span>
               </>
             )}
             <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Space</kbd> 拖拽平移</span>
             <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded">Wheel</kbd> 缩放</span>
           </div>
        </div>
      </div>
    </div>
  );
};