import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewport, clampZoom, worldToScreen, screenToWorld, zoomAt, panBy,
  fitViewport, nodeRect, pointInRect, rectsIntersect, hitTestNode, nodesInRect,
  anchorPoints, edgePath, snapToGrid, moveNodeBy,
} from '../src/canvas/engine.mjs';

test('viewport transform round-trips between world and screen', () => {
  const viewport = createViewport({ x: 120, y: -40, zoom: 1.5 });
  const world = { x: 33.3, y: 78.9 };
  const screen = worldToScreen(world, viewport);
  const back = screenToWorld(screen, viewport);
  assert.ok(Math.abs(back.x - world.x) < 1e-9);
  assert.ok(Math.abs(back.y - world.y) < 1e-9);
});

test('clampZoom keeps zoom inside the allowed range', () => {
  assert.equal(clampZoom(0.01), 0.1);
  assert.equal(clampZoom(99), 4);
  assert.equal(clampZoom(Number.NaN), 1);
});

test('zoomAt keeps the world point under the cursor fixed', () => {
  const viewport = createViewport({ x: 10, y: 20, zoom: 1 });
  const cursor = { x: 300, y: 200 };
  const before = screenToWorld(cursor, viewport);
  const next = zoomAt(viewport, cursor, 2.5);
  const after = screenToWorld(cursor, next);
  assert.ok(Math.abs(after.x - before.x) < 1e-9);
  assert.ok(Math.abs(after.y - before.y) < 1e-9);
  assert.equal(next.zoom, 2.5);
});

test('panBy moves the viewport in screen pixels', () => {
  const viewport = createViewport({ x: 10, y: 20, zoom: 2 });
  const next = panBy(viewport, -30, 40);
  assert.deepEqual(next, { x: -20, y: 60, zoom: 2 });
});

test('nodeRect falls back to defaults and always returns finite numbers', () => {
  const rect = nodeRect({ layout: { x: 1, y: 2 } });
  assert.equal(rect.width, 569);
  assert.equal(rect.height, 320);
  const fallback = nodeRect({});
  assert.equal(fallback.x, 0);
  assert.equal(fallback.y, 0);
});

test('point and rect intersections behave as expected', () => {
  const rect = { x: 10, y: 10, width: 100, height: 50 };
  assert.equal(pointInRect({ x: 10, y: 10 }, rect), true);
  assert.equal(pointInRect({ x: 109.9, y: 59.9 }, rect), true);
  assert.equal(pointInRect({ x: 111, y: 60 }, rect), false);
  assert.equal(rectsIntersect(rect, { x: 50, y: 20, width: 200, height: 20 }), true);
  assert.equal(rectsIntersect(rect, { x: 200, y: 200, width: 10, height: 10 }), false);
});

test('hitTestNode returns the topmost node', () => {
  const nodes = [
    { id: 'a', layout: { x: 0, y: 0, width: 100, height: 100 } },
    { id: 'b', layout: { x: 50, y: 50, width: 100, height: 100 } },
  ];
  assert.equal(hitTestNode(nodes, { x: 20, y: 20 }).id, 'a');
  assert.equal(hitTestNode(nodes, { x: 75, y: 75 }).id, 'b');
  assert.equal(hitTestNode(nodes, { x: 500, y: 500 }), null);
});

test('nodesInRect returns every intersecting node', () => {
  const nodes = [
    { id: 'a', layout: { x: 0, y: 0, width: 100, height: 100 } },
    { id: 'b', layout: { x: 300, y: 0, width: 100, height: 100 } },
  ];
  assert.deepEqual(nodesInRect(nodes, { x: 50, y: 50, width: 100, height: 100 }).map((n) => n.id), ['a']);
  assert.deepEqual(nodesInRect(nodes, { x: 0, y: 0, width: 1000, height: 1000 }).map((n) => n.id), ['a', 'b']);
});

test('anchors sit on the right and left midpoints', () => {
  const from = { layout: { x: 0, y: 0, width: 100, height: 50 } };
  const to = { layout: { x: 300, y: 100, width: 100, height: 50 } };
  const { from: a, to: b } = anchorPoints(from, to);
  assert.deepEqual(a, { x: 100, y: 25 });
  assert.deepEqual(b, { x: 300, y: 125 });
});

test('edgePath is a cubic bezier from anchor to anchor', () => {
  const path = edgePath({ x: 0, y: 0 }, { x: 200, y: 100 });
  assert.match(path, /^M 0 0 C /);
  assert.ok(path.endsWith('200 100'));
});

test('snapToGrid and moveNodeBy keep node sizes', () => {
  assert.equal(snapToGrid(23, 20), 20);
  assert.equal(snapToGrid(31, 20), 40);
  const moved = moveNodeBy({ layout: { x: 13, y: 27, width: 500, height: 300 } }, 9, 9, 10);
  assert.deepEqual(moved.layout, { x: 20, y: 40, width: 500, height: 300 });
});

test('fitViewport centers the node bounds', () => {
  const viewport = fitViewport(
    [{ layout: { x: 0, y: 0, width: 100, height: 100 } }, { layout: { x: 300, y: 200, width: 100, height: 100 } }],
    { width: 1000, height: 800 },
  );
  const center = screenToWorld({ x: 500, y: 400 }, viewport);
  assert.ok(Math.abs(center.x - 200) < 1e-6);
  assert.ok(Math.abs(center.y - 150) < 1e-6);
  assert.ok(viewport.zoom > 0.1 && viewport.zoom <= 1);
});
