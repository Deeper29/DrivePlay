import { WORLD, WORLD_MARGIN, carPolygon, clamp } from "./physics.js";

export function fitViewport(width, height, state, overlay = null) {
  const scale = Math.min(
    width / (WORLD.width - WORLD_MARGIN * 2),
    height / (WORLD.height - WORLD_MARGIN * 2),
  );
  const visibleWidth = width / scale,
    visibleHeight = height / scale;
  const body = carPolygon(state);
  const left = Math.min(...body.map((p) => p.x)),
    right = Math.max(...body.map((p) => p.x)),
    top = Math.min(...body.map((p) => p.y)),
    bottom = Math.max(...body.map((p) => p.y));
  const margin = 10 / scale;
  const centerX = clamp(
    WORLD.width / 2,
    right - visibleWidth / 2 + margin,
    left + visibleWidth / 2 - margin,
  );
  const centerY = clamp(
    WORLD.height / 2,
    bottom - visibleHeight / 2 + margin,
    top + visibleHeight / 2 - margin,
  );
  let offsetX = width / 2 - centerX * scale;
  const offsetY = height / 2 - centerY * scale;
  if (
    overlay &&
    right * scale + offsetX > overlay.x - 10 &&
    left * scale + offsetX < overlay.x + overlay.width &&
    bottom * scale + offsetY > overlay.y &&
    top * scale + offsetY < overlay.y + overlay.height + 10
  ) {
    offsetX = overlay.x - 10 - right * scale;
  }
  return {
    scale,
    offsetX,
    offsetY,
    // The drivable boundary follows the canvas edge, not the old inset rectangle.
    world: {
      x: -offsetX / scale - WORLD_MARGIN,
      y: -offsetY / scale - WORLD_MARGIN,
      width: visibleWidth + WORLD_MARGIN * 2,
      height: visibleHeight + WORLD_MARGIN * 2,
    },
  };
}
