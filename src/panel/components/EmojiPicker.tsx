import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { EmojiGroupId } from '../lib/emoji-data';
import { readStorage, writeStorage } from '../lib/storage';
import { STR } from '../lib/strings';
import { useEscape } from '../state/useEscape';

const RECENT_KEY = 'pipeelo:emoji-recent';
const RECENT_MAX = 32;

type TabId = 'recent' | EmojiGroupId;
type EmojiGroup = { id: EmojiGroupId; emojis: string };

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'recent', icon: '🕒', label: STR.emojiRecent },
  { id: 'smileys', icon: '😀', label: STR.emojiSmileys },
  { id: 'nature', icon: '🐻', label: STR.emojiNature },
  { id: 'food', icon: '🍔', label: STR.emojiFood },
  { id: 'activities', icon: '⚽', label: STR.emojiActivities },
  { id: 'travel', icon: '🚗', label: STR.emojiTravel },
  { id: 'objects', icon: '💡', label: STR.emojiObjects },
  { id: 'symbols', icon: '🔣', label: STR.emojiSymbols },
];

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const keepFocus = (event: Event) => event.preventDefault();

export function EmojiPicker(props: {
  anchor: RefObject<HTMLElement>;
  onPick(emoji: string): void;
  onClose(): void;
}) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [recent, setRecent] = useState(readRecent);
  const [tab, setTab] = useState<TabId>(recent.length > 0 ? 'recent' : 'smileys');
  const recentRef = useRef(recent);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;

  useEscape(() => closeRef.current());

  useEffect(() => {
    let cancelled = false;
    void import('../lib/emoji-data').then((mod) => {
      if (!cancelled) setGroups(mod.EMOJI_GROUPS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target) || props.anchor.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  const selectTab = (id: TabId) => {
    setRecent(recentRef.current);
    setTab(id);
  };

  const pick = (emoji: string) => {
    const next = [emoji, ...recentRef.current.filter((item) => item !== emoji)].slice(0, RECENT_MAX);
    recentRef.current = next;
    writeStorage(RECENT_KEY, JSON.stringify(next));
    if (tab !== 'recent') setRecent(next);
    props.onPick(emoji);
  };

  const tabs = recent.length > 0 ? TABS : TABS.filter((item) => item.id !== 'recent');
  const emojis =
    tab === 'recent' ? recent : (groups?.find((group) => group.id === tab)?.emojis.split(' ') ?? []);

  return (
    <div ref={rootRef} class="emoji-popover" role="dialog" aria-label={STR.emoji}>
      <div class="emoji-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            class={'emoji-tab' + (item.id === tab ? ' emoji-tab--active' : '')}
            aria-label={item.label}
            aria-selected={item.id === tab}
            title={item.label}
            onPointerDown={keepFocus}
            onClick={() => selectTab(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </div>
      <div class="emoji-grid" role="tabpanel">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            class="emoji-cell"
            onPointerDown={keepFocus}
            onClick={() => pick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
