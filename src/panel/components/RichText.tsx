import type { ComponentChildren } from 'preact';
import type { Block, Inline } from '../lib/format';

function renderInline(nodes: Inline[]): ComponentChildren {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'text':
        return node.text;
      case 'code':
        return (
          <code key={index} class="msg-code">
            {node.text}
          </code>
        );
      case 'link':
        return (
          <a key={index} href={node.url} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children)}
          </a>
        );
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case 'em':
        return <em key={index}>{renderInline(node.children)}</em>;
      case 'del':
        return <s key={index}>{renderInline(node.children)}</s>;
    }
  });
}

function renderList(block: Extract<Block, { kind: 'list' }>, key: number) {
  const items = block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>);
  return block.ordered ? (
    <ol key={key} class="msg-list" start={block.start}>
      {items}
    </ol>
  ) : (
    <ul key={key} class="msg-list">
      {items}
    </ul>
  );
}

export function RichText({ blocks }: { blocks: Block[] }) {
  return (
    <span class="msg-text">
      {blocks.map((block, index) =>
        block.kind === 'list'
          ? renderList(block, index)
          : block.lines.map((line, lineIndex) => [lineIndex > 0 ? '\n' : null, renderInline(line)])
      )}
    </span>
  );
}
