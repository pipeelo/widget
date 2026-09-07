export const PEAK_COUNT = 64;

const PEAK_MAX = 100;
const BAR_WIDTH = 2;
const BAR_STEP = 4;
const NEUTRAL_LEVEL = 0.25;
const MUTED_ALPHA = 0.3;

function barCount(width: number): number {
  return Math.max(1, Math.floor(width / BAR_STEP));
}

function bucket(values: number[], count: number): number[] {
  const size = values.length / count;
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * size);
    const to = Math.max(from + 1, Math.floor((index + 1) * size));
    let max = 0;
    for (let i = from; i < to && i < values.length; i++) max = Math.max(max, values[i]!);
    return max;
  });
}

export function toPeaks(levels: number[]): number[] {
  const bars = bucket(levels, PEAK_COUNT);
  const max = Math.max(...bars);
  return bars.map((bar) => (max > 0 ? Math.round((bar / max) * PEAK_MAX) : 0));
}

export function waveBars(peaks: number[] | null, width: number): number[] {
  const count = Math.min(PEAK_COUNT, barCount(width));
  if (!peaks) return new Array<number>(count).fill(NEUTRAL_LEVEL);
  return bucket(peaks, count).map((peak) => peak / PEAK_MAX);
}

export function liveBars(levels: number[], width: number): number[] {
  const count = barCount(width);
  return Array.from({ length: count }, (_, index) => levels[levels.length - count + index] ?? 0);
}

export function drawBars(canvas: HTMLCanvasElement, bars: number[], played: number): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || !width || !height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);
  ctx.lineWidth = BAR_WIDTH;
  ctx.lineCap = 'round';
  ctx.strokeStyle = getComputedStyle(canvas).color;
  const step = width / bars.length;
  bars.forEach((bar, index) => {
    const x = (index + 0.5) * step;
    const half = Math.max(0.5, (bar * (height - BAR_WIDTH)) / 2);
    ctx.globalAlpha = x / width <= played ? 1 : MUTED_ALPHA;
    ctx.beginPath();
    ctx.moveTo(x, height / 2 - half);
    ctx.lineTo(x, height / 2 + half);
    ctx.stroke();
  });
}
