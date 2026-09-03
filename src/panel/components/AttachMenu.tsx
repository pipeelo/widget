import type { ComponentChildren } from 'preact';
import { ACCEPT_AUDIO, ACCEPT_CAMERA, ACCEPT_DOCUMENT, ACCEPT_GALLERY } from '../lib/files';
import { STR } from '../lib/strings';
import { Sheet } from './Sheet';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="m21 16-5.2-5.2a1.5 1.5 0 0 0-2.1 0L6 18.5" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm0 0v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

function Row(props: { icon: ComponentChildren; label: string; onClick(): void }) {
  return (
    <button type="button" class="sheet-row sheet-row--icon" onClick={props.onClick}>
      <span class="sheet-row-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span class="sheet-row-title">{props.label}</span>
    </button>
  );
}

export function AttachMenu(props: {
  onPick(accept: string, capture: boolean): void;
  onClose(): void;
}) {
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <Sheet title={STR.attach} onClose={props.onClose}>
      {coarse && (
        <Row
          icon={<CameraIcon />}
          label={STR.attachCamera}
          onClick={() => props.onPick(ACCEPT_CAMERA, true)}
        />
      )}
      <Row
        icon={<GalleryIcon />}
        label={STR.attachGallery}
        onClick={() => props.onPick(ACCEPT_GALLERY, false)}
      />
      <Row
        icon={<DocumentIcon />}
        label={STR.attachDocument}
        onClick={() => props.onPick(ACCEPT_DOCUMENT, false)}
      />
      <Row
        icon={<AudioIcon />}
        label={STR.attachAudio}
        onClick={() => props.onPick(ACCEPT_AUDIO, false)}
      />
    </Sheet>
  );
}
