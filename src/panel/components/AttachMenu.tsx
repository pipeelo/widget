import type { ComponentChildren } from 'preact';
import { ACCEPT_AUDIO, ACCEPT_DOCUMENT, ACCEPT_GALLERY } from '../lib/files';
import { geoSupported } from '../lib/geo';
import { STR } from '../lib/strings';
import { AudioIcon, DocumentIcon, GalleryIcon, LocationIcon } from './icons';
import { Sheet } from './Sheet';

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
  onLocation(): void;
  onClose(): void;
}) {
  return (
    <Sheet title={STR.attach} onClose={props.onClose}>
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
      {geoSupported() && (
        <Row icon={<LocationIcon />} label={STR.locationLabel} onClick={props.onLocation} />
      )}
    </Sheet>
  );
}
