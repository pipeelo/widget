import { MEDIA_LABELS, STR } from '../lib/strings';
import type { ChatMessage } from '../state/store';
import { AudioMessage } from './AudioMessage';

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Zm0 0v5h5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function MediaContent({
  message,
  onMediaError,
}: {
  message: ChatMessage;
  onMediaError(): void;
}) {
  if (message.kind === 'location' && message.location) {
    const { latitude, longitude } = message.location;
    return (
      <a
        class="msg-doc"
        href={`https://maps.google.com/?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="msg-doc-icon" aria-hidden="true">
          <PinIcon />
        </span>
        <span class="msg-doc-name">{STR.locationLabel}</span>
        <span class="msg-doc-open">{STR.openMap}</span>
      </a>
    );
  }

  if (message.kind === 'contacts' && message.contacts) {
    return (
      <>
        {message.contacts.map((contact, index) => (
          <div class="msg-doc" key={index}>
            <span class="msg-doc-icon" aria-hidden="true">
              <ContactIcon />
            </span>
            <span class="msg-doc-name">{contact.name ?? STR.contactLabel}</span>
            {contact.phone && (
              <a class="msg-doc-open" href={`tel:${contact.phone}`}>
                {contact.phone}
              </a>
            )}
          </div>
        ))}
      </>
    );
  }

  const url = message.mediaUrl;
  const documentName =
    message.pendingFile?.name ?? message.filename ?? MEDIA_LABELS[message.kind] ?? STR.documentLabel;

  if (!url) return <span class="msg-doc-name">{documentName}</span>;

  if (message.kind === 'image') {
    return (
      <a class="msg-media-link" href={url} target="_blank" rel="noopener noreferrer">
        <img
          class="msg-image"
          src={url}
          alt={STR.imageAlt}
          loading="lazy"
          onError={onMediaError}
        />
      </a>
    );
  }

  if (message.kind === 'audio') {
    return <AudioMessage url={url} peaks={message.peaks} onMediaError={onMediaError} />;
  }

  if (message.kind === 'video') {
    return (
      <video class="msg-video" controls preload="metadata" src={url} onError={onMediaError}>
        {STR.videoUnsupported}
      </video>
    );
  }

  return (
    <a class="msg-doc" href={url} target="_blank" rel="noopener noreferrer">
      <span class="msg-doc-icon" aria-hidden="true">
        <DocIcon />
      </span>
      <span class="msg-doc-name">{documentName}</span>
      <span class="msg-doc-open">{STR.openFile}</span>
    </a>
  );
}
