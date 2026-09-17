import { useEffect, useRef, useState } from 'preact/hooks';
import type { MediaField } from '../api/types';
import { formatSize } from '../lib/files';
import { MEDIA_LABELS, STR } from '../lib/strings';
import { useEscape } from '../state/useEscape';
import { AudioIcon, CloseIcon, DocumentIcon, SendIcon } from './icons';

export function AttachPreview(props: {
  field: MediaField;
  file: File;
  disabled: boolean;
  onSend(): void;
  onCancel(): void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const visual = props.field === 'image' || props.field === 'video';

  useEscape(props.onCancel);

  useEffect(() => {
    sendRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!visual) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(props.file);
    } catch {
      objectUrl = null;
    }
    setUrl(objectUrl);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.file, visual]);

  const showMedia = visual && url !== null;

  return (
    <div class="preview" role="dialog" aria-modal="true" aria-label={MEDIA_LABELS[props.field]}>
      <div class="preview-head">
        <span class="preview-title">{MEDIA_LABELS[props.field]}</span>
        <button type="button" class="preview-close" aria-label={STR.previewCancel} onClick={props.onCancel}>
          <CloseIcon />
        </button>
      </div>
      <div class={'preview-body' + (showMedia ? ' preview-body--media' : '')}>
        {showMedia && props.field === 'image' && <img class="preview-img" src={url} alt="" />}
        {showMedia && props.field === 'video' && (
          <video class="preview-video" src={url} controls playsInline />
        )}
        {!showMedia && (
          <div class="preview-doc">
            <span class="preview-doc-icon" aria-hidden="true">
              {props.field === 'audio' ? <AudioIcon /> : <DocumentIcon />}
            </span>
            <span class="preview-doc-name">{props.file.name}</span>
            <span class="preview-doc-size">{formatSize(props.file.size)}</span>
          </div>
        )}
      </div>
      <div class="preview-foot">
        <button type="button" class="preview-cancel" onClick={props.onCancel}>
          {STR.previewCancel}
        </button>
        <button
          ref={sendRef}
          type="button"
          class="preview-send"
          aria-label={STR.previewSend}
          disabled={props.disabled}
          onClick={props.onSend}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
