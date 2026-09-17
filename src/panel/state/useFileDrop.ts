import { useEffect, useRef, useState } from 'preact/hooks';

const DRAG_IDLE_MS = 150;

export function draggingFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return Boolean(types) && Array.from(types!).indexOf('Files') !== -1;
}

export function useFileDrop(onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const handlerRef = useRef(onFile);
  handlerRef.current = onFile;

  useEffect(() => {
    let timer: number | undefined;
    const onDragOver = (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
      setDragging(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDragging(false), DRAG_IDLE_MS);
    };
    const onDrop = (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      event.preventDefault();
      window.clearTimeout(timer);
      setDragging(false);
      const file = event.dataTransfer!.files[0];
      if (file) handlerRef.current(file);
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, []);

  return dragging;
}
