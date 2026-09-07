import { STR } from '../lib/strings';

export function PushInvite(props: { busy: boolean; onEnable(): void; onDismiss(): void }) {
  return (
    <div class="push-invite" role="status">
      <span class="push-invite__text">{STR.pushInvite}</span>
      <div class="push-invite__actions">
        <button type="button" class="push-invite__enable" onClick={props.onEnable} disabled={props.busy}>
          {STR.pushEnable}
        </button>
        <button
          type="button"
          class="push-invite__later"
          aria-label={STR.dismissNotice}
          onClick={props.onDismiss}
          disabled={props.busy}
        >
          ×
        </button>
      </div>
    </div>
  );
}
