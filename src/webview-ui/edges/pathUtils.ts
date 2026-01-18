/**
 * Path building utility functions
 *
 * Provides helper functions for path manipulation and validation.
 */

/**
 * Ensure the final segment has minimum length for arrow visibility
 */
export function ensureMinFinalSegment(points: number[]): void {
  const minFinalSegment = 25;
  if (points.length >= 4) {
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    const prevX = points[points.length - 4];
    const prevY = points[points.length - 3];

    const finalDx = Math.abs(lastX - prevX);
    const finalDy = Math.abs(lastY - prevY);

    if (finalDx < 5 && finalDy < minFinalSegment && finalDy > 0) {
      const extension = minFinalSegment - finalDy;
      if (lastY > prevY) {
        points[points.length - 3] = prevY - extension;
      } else {
        points[points.length - 3] = prevY + extension;
      }
    } else if (finalDy < 5 && finalDx < minFinalSegment && finalDx > 0) {
      const extension = minFinalSegment - finalDx;
      if (lastX > prevX) {
        points[points.length - 4] = prevX - extension;
      } else {
        points[points.length - 4] = prevX + extension;
      }
    }
  }
}
