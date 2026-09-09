const DISMISS_ZONE = '.messages, .header';
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 700;

function editable(node: Element | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  return node.tagName === 'TEXTAREA' || node.tagName === 'INPUT' || node.isContentEditable;
}

function inDismissZone(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(DISMISS_ZONE) !== null;
}

export function dismissKeyboardOnTapOutside(): () => void {
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let swallowClick = false;

  const onPointerDown = (event: PointerEvent) => {
    swallowClick = false;
    pointer = event.isPrimary && event.pointerType !== 'mouse' ? event.pointerId : -1;
    startX = event.clientX;
    startY = event.clientY;
    startedAt = event.timeStamp;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    const active = document.activeElement;
    if (!editable(active)) return;
    if (event.timeStamp - startedAt > TAP_MAX_MS) return;
    if (Math.abs(event.clientX - startX) > TAP_SLOP_PX) return;
    if (Math.abs(event.clientY - startY) > TAP_SLOP_PX) return;
    if (!inDismissZone(event.target)) return;
    active.blur();
    swallowClick = true;
  };

  const onPointerCancel = () => {
    pointer = -1;
  };

  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
  document.addEventListener('click', onClick, true);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerCancel, true);
    document.removeEventListener('click', onClick, true);
  };
}
