import { STR } from '../lib/strings';
import { formatDayAndTime } from '../lib/time';

export function ClosedNotice(props: {
  endedAt: string | null;
  protocol: string | null;
  canStartNew: boolean;
  onStartNew(): void;
}) {
  return (
    <div class="closed-notice" role="status">
      <p class="closed-notice-title">
        {props.endedAt ? STR.closedAt(formatDayAndTime(props.endedAt)) : STR.closedPlain}
      </p>
      {props.protocol && <p class="closed-notice-protocol">{STR.protocol(props.protocol)}</p>}
      {props.canStartNew && (
        <button type="button" class="conv-new" onClick={props.onStartNew}>
          {STR.newConversation}
        </button>
      )}
    </div>
  );
}
