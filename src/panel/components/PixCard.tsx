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

type CopyTarget = 'pix' | 'boleto';

export function PixCard({ pix }: { pix: PixDetails }) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const onCopy = (target: CopyTarget, text: string) => {
    void copyCode(text).then((done) => {
      if (!done) return;
      setCopied(target);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(null), COPIED_MS);
    });
  };

  const both = pix.code !== null && pix.digitableLine !== null;

  return (
    <div class="pix-card">
      <span class="pix-label">{pix.digitableLine ? STR.paymentTitle : STR.pixTitle}</span>
      {pix.productName && <span class="pix-name">{pix.productName}</span>}
      {pix.value !== null && <span class="pix-value">{brl.format(pix.value / 100)}</span>}
      {pix.code && (
        <PaymentOption
          title={both ? STR.pixOption : null}
          text={pix.code}
          copyLabel={STR.copyCode}
          copiedLabel={STR.codeCopied}
          copied={copied === 'pix'}
          onCopy={() => onCopy('pix', pix.code ?? '')}
        />
      )}
      {pix.digitableLine && (
        <PaymentOption
          title={STR.boletoOption}
          text={pix.digitableLine}
          copyLabel={STR.copyLine}
          copiedLabel={STR.lineCopied}
          copied={copied === 'boleto'}
          onCopy={() => onCopy('boleto', pix.digitableLine ?? '')}
        />
      )}
    </div>
  );
}

function PaymentOption(props: {
  title: string | null;
  text: string;
  copyLabel: string;
  copiedLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div class="pix-option">
      {props.title && <span class="pix-option-title">{props.title}</span>}
      <span class="pix-code">{props.text}</span>
      <button type="button" class={'pix-copy' + (props.copied ? ' pix-copy--done' : '')} onClick={props.onCopy}>
        {props.copied ? <CheckMark /> : <CopyIcon />}
        {props.copied ? props.copiedLabel : props.copyLabel}
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
