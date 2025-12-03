import { Point, ViewTransform } from '../types';

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