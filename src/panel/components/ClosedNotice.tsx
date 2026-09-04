import { STR } from '../lib/strings';
import { formatDayAndTime } from '../lib/time';

export function ClosedNotice(props: { endedAt: string | null; protocol: string | null }) {
  return (
    <div class="closed-notice" role="status">
      <span class="closed-notice-title">
        {props.endedAt ? STR.closedAt(formatDayAndTime(props.endedAt)) : STR.closedPlain}
      </span>
      {props.protocol && <span class="closed-notice-protocol">{STR.protocol(props.protocol)}</span>}
    </div>
  );
}
