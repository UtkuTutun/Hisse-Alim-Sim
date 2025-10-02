import { PNG } from 'pngjs';

export type Candle = { x: Date; o: number; h: number; l: number; c: number };

const WIDTH = 1200;
const HEIGHT = 600;
const PADDING = 60;

function putPixel(png: PNG, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r; png.data[idx + 1] = g; png.data[idx + 2] = b; png.data[idx + 3] = a;
}

function drawLine(png: PNG, x0: number, y0: number, x1: number, y1: number, color = [229, 229, 229, 255]) {
  // Bresenham
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    putPixel(png, x0, y0, color[0], color[1], color[2], color[3]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawRect(png: PNG, x: number, y: number, w: number, h: number, color = [17, 24, 39, 255]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      putPixel(png, xx, yy, color[0], color[1], color[2], color[3]);
    }
  }
}

function drawAxes(ctx: any, minY: number, maxY: number) {
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  // horizontal grid lines
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const y = PADDING + ((HEIGHT - 2 * PADDING) * i) / steps;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(WIDTH - PADDING, y);
    ctx.stroke();
    // labels
    const value = maxY - ((maxY - minY) * i) / steps;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px Arial';
    ctx.fillText(value.toFixed(0), 10, y + 4);
  }
}

export async function renderCandles(title: string, data: Candle[]) {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  // background
  drawRect(png, 0, 0, WIDTH, HEIGHT, [255, 255, 255, 255]);
  if (!data || !data.length) return PNG.sync.write(png);
  const xs = data.map(d => d.x.getTime());
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  if (minX === maxX) maxX = minX + 1; // avoid zero span
  const lows = data.map(d => d.l);
  const highs = data.map(d => d.h);
  const minY = Math.min(...lows);
  const maxY = Math.max(...highs);

  // axes
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const y = Math.round(PADDING + ((HEIGHT - 2 * PADDING) * i) / steps);
    drawLine(png, PADDING, y, WIDTH - PADDING, y);
  }

  const plotW = WIDTH - 2 * PADDING;
  const plotH = HEIGHT - 2 * PADDING;
  const xToPx = (t: number) => Math.round(PADDING + ((t - minX) / (maxX - minX)) * plotW);
  const yToPx = (v: number) => Math.round(PADDING + (1 - (v - minY) / (maxY - minY)) * plotH);

  const candleW = Math.max(3, Math.min(12, (plotW / data.length) * 0.6)) | 0;
  for (const c of data) {
    const x = xToPx(c.x.getTime());
    const yHigh = yToPx(c.h);
    const yLow = yToPx(c.l);
    const yOpen = yToPx(c.o);
    const yClose = yToPx(c.c);
    const bullish = c.c >= c.o;
    const color = bullish ? [22, 163, 74, 255] : [220, 38, 38, 255];
    // wick
    drawLine(png, x, yHigh, x, yLow, color);
    // body
    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    drawRect(png, x - (candleW >> 1), bodyTop, candleW, bodyH, color);
  }

  return PNG.sync.write(png);
}

export async function renderLine(title: string, points: { x: Date; y: number }[], color = '#0aa') {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  drawRect(png, 0, 0, WIDTH, HEIGHT, [255, 255, 255, 255]);
  if (!points || !points.length) return PNG.sync.write(png);
  const xs = points.map(p => p.x.getTime());
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  if (minX === maxX) maxX = minX + 1;
  const ys = points.map(p => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // axes
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const y = Math.round(PADDING + ((HEIGHT - 2 * PADDING) * i) / steps);
    drawLine(png, PADDING, y, WIDTH - PADDING, y);
  }
  const plotW = WIDTH - 2 * PADDING;
  const plotH = HEIGHT - 2 * PADDING;
  const xToPx = (t: number) => Math.round(PADDING + ((t - minX) / (maxX - minX)) * plotW);
  const yToPx = (v: number) => Math.round(PADDING + (1 - (v - minY) / (maxY - minY)) * plotH);
  // polyline
  const col = color === '#0aa' ? [10, 170, 170, 255] : [17, 24, 39, 255];
  for (let i = 1; i < points.length; i++) {
    const x0 = xToPx(points[i - 1].x.getTime());
    const y0 = yToPx(points[i - 1].y);
    const x1 = xToPx(points[i].x.getTime());
    const y1 = yToPx(points[i].y);
    drawLine(png, x0, y0, x1, y1, col);
  }
  return PNG.sync.write(png);
}

export default { renderCandles, renderLine };
