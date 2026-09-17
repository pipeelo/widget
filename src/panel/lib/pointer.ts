function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function finePointer(): boolean {
  return matches('(hover: hover) and (pointer: fine)');
}

export function coarsePointer(): boolean {
  return matches('(pointer: coarse)');
}
