import { useEffect, useRef, useState } from 'preact/hooks';
import { STR } from '../lib/strings';
import type { PixDetails } from '../state/store';

const COPIED_MS = 2000;
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M9 9h10v12H9zM5 15V3h10"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function copyWithExecCommand(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let done = false;
  try {
    done = document.execCommand('copy');
  } catch {
    done = false;
  }
  area.remove();
  return done;
}

async function copyCode(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }
  return copyWithExecCommand(text);
}

export function PixCard({ pix }: { pix: PixDetails }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const onCopy = () => {
    void copyCode(pix.code).then((done) => {
      if (!done) return;
      setCopied(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    });
  };

  return (
    <div class="pix-card">
      <span class="pix-label">{STR.pixTitle}</span>
      {pix.productName && <span class="pix-name">{pix.productName}</span>}
      {pix.value !== null && <span class="pix-value">{brl.format(pix.value / 100)}</span>}
      <span class="pix-code">{pix.code}</span>
      <button type="button" class={'pix-copy' + (copied ? ' pix-copy--done' : '')} onClick={onCopy}>
        {copied ? <CheckMark /> : <CopyIcon />}
        {copied ? STR.codeCopied : STR.copyCode}
      </button>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
