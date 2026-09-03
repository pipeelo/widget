import { parseHex, relativeLuminance } from '../../shared/color';

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const FALLBACK: Rgb = [1, 213, 172];
const LIGHT_TINT_STEPS = [0.86, 0.76, 0.66, 0.56];
const MAX_TINT_LUMINANCE = 0.9;
const DARK_SHADE = 0.55;

function mix(base: Rgb, target: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(base[i]! * (1 - amount) + target[i]! * amount)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function mineBubbleColor(accent: string, dark: boolean): string {
  const base = parseHex(accent) ?? FALLBACK;
  if (dark) return toHex(mix(base, BLACK, DARK_SHADE));
  for (const amount of LIGHT_TINT_STEPS) {
    const tint = mix(base, WHITE, amount);
    if (relativeLuminance(tint) <= MAX_TINT_LUMINANCE) return toHex(tint);
  }
  return toHex(mix(base, WHITE, LIGHT_TINT_STEPS[LIGHT_TINT_STEPS.length - 1]!));
}
