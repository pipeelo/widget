import { useEffect, useRef } from 'preact/hooks';

const stack: Array<() => void> = [];

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.stopPropagation();
  top();
}

export function useEscape(onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    const entry = () => handlerRef.current();
    if (stack.length === 0) document.addEventListener('keydown', onKeyDown, true);
    stack.push(entry);
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      if (stack.length === 0) document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
