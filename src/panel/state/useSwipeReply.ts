import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const SLOP_PX = 10;
const MAX_PX = 72;
const TRIGGER_PX = 56;
const LONG_PRESS_MS = 400;
const SETTLE_MS = 200;
const IGNORED = '.sheet-backdrop, video';

export function useSwipeReply(scrollerRef: RefObject<HTMLElement>, onReply: (id: string) => void): void {
  const handlerRef = useRef(onReply);
  handlerRef.current = onReply;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let row: HTMLElement | null = null;
    let pointer = -1;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let offset = 0;
    let locked = false;
    let swallowClick = false;

    const settle = (target: HTMLElement) => {
      target.dataset.swipe = 'back';
      target.style.setProperty('--pip-swipe-x', '0px');
      target.style.setProperty('--pip-swipe-progress', '0');
      window.setTimeout(() => {
        if (target.dataset.swipe !== 'back') return;
        delete target.dataset.swipe;
        target.style.removeProperty('--pip-swipe-x');
        target.style.removeProperty('--pip-swipe-progress');
      }, SETTLE_MS);
    };

    const end = () => {
      if (row && locked) settle(row);
      row = null;
      pointer = -1;
      locked = false;
      offset = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      swallowClick = false;
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(IGNORED)) return;
      const candidate = target.closest<HTMLElement>('.msg-row[data-reply]');
      if (!candidate) return;
      row = candidate;
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startedAt = event.timeStamp;
      locked = false;
      offset = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointer || !row) return;
      const moveX = event.clientX - startX;
      if (!locked) {
        if (Math.abs(event.clientY - startY) > SLOP_PX || event.timeStamp - startedAt > LONG_PRESS_MS) {
          end();
          return;
        }
        if (moveX < SLOP_PX) return;
        locked = true;
        row.dataset.swipe = 'drag';
      }
      offset = Math.max(0, Math.min(MAX_PX, moveX));
      row.style.setProperty('--pip-swipe-x', `${offset}px`);
      row.style.setProperty('--pip-swipe-progress', String(Math.min(1, offset / TRIGGER_PX)));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointer || !row) return;
      if (locked) {
        swallowClick = true;
        const id = row.dataset.id;
        if (offset >= TRIGGER_PX && id) handlerRef.current(id);
      }
      end();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointer) end();
    };

    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    scroller.addEventListener('pointerdown', onPointerDown, true);
    scroller.addEventListener('pointermove', onPointerMove);
    scroller.addEventListener('pointerup', onPointerUp);
    scroller.addEventListener('pointercancel', onPointerCancel);
    scroller.addEventListener('click', onClick, true);

    return () => {
      scroller.removeEventListener('pointerdown', onPointerDown, true);
      scroller.removeEventListener('pointermove', onPointerMove);
      scroller.removeEventListener('pointerup', onPointerUp);
      scroller.removeEventListener('pointercancel', onPointerCancel);
      scroller.removeEventListener('click', onClick, true);
    };
  }, []);
}
