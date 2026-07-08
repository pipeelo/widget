import { STR } from '../lib/strings';
import type { ChatMessage } from '../state/store';

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

// media_url é presigned com validade de 1h: onError avisa o App, que renova
// via refetch do histórico (upsert troca a URL e o elemento tenta de novo).
export function MediaContent({
  message,
  onMediaError,
}: {
  message: ChatMessage;
  onMediaError(): void;
}) {
  const url = message.mediaUrl;
  const documentName = message.pendingFile?.name ?? STR.documentLabel;

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
    return <audio class="msg-audio" controls preload="none" src={url} onError={onMediaError} />;
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
