import { Point, ViewTransform, Annotation } from '../types';

export const screenToImage = (
  x: number,
  y: number,
  transform: ViewTransform
): Point => {
  return {
    x: (x - transform.x) / transform.scale,
    y: (y - transform.y) / transform.scale,
  };
};

export const imageToScreen = (
  x: number,
  y: number,
  transform: ViewTransform
): Point => {
  return {
    x: x * transform.scale + transform.x,
    y: y * transform.scale + transform.y,
  };
};

export const getDistance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const isPointNearVertex = (
  point: Point,
  vertex: Point,
  threshold: number,
  scale: number
) => {
  const screenDist = getDistance(
    { x: point.x * scale, y: point.y * scale },
    { x: vertex.x * scale, y: vertex.y * scale }
  );
  return screenDist < threshold;
};

// Returns the distance from point p to the segment v-w
export const getDistanceToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = Math.pow(w.x - v.x, 2) + Math.pow(w.y - v.y, 2);
  if (l2 === 0) return getDistance(p, v);
  
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projection = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  };
  
  return getDistance(p, projection);
};

// Calculate area of a polygon using Shoelace formula
export const calculatePolygonArea = (points: Point[]): number => {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};

// Get area for any annotation type
export const getAnnotationArea = (annotation: Annotation): number => {
  if (annotation.type === 'rectangle') {
    const width = Math.abs(annotation.points[0].x - annotation.points[1].x);
    const height = Math.abs(annotation.points[0].y - annotation.points[1].y);
    return width * height;
  } else if (annotation.type === 'polygon') {
    return calculatePolygonArea(annotation.points);
  }
  return 0;
};