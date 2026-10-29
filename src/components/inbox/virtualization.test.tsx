import { describe, it, expect } from 'vitest';
import React, { useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import type { Message } from '@/types';

type FlatThreadItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; id: string; message: Message };

function flattenMessages(messages: Message[]): FlatThreadItem[] {
  const items: FlatThreadItem[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (day !== currentDate) {
      currentDate = day;
      items.push({ type: 'date', id: `date-${day}`, date: msg.created_at });
    }
    items.push({ type: 'message', id: msg.id, message: msg });
  }

  return items;
}

function VirtualListTestHarness({
  count,
  estimateSize,
}: {
  count: number;
  estimateSize: (index: number) => number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
  });

  return (
    <div ref={parentRef} data-testid="scroll-container">
      <div
        data-testid="virtual-inner"
        data-total-size={virtualizer.getTotalSize()}
        data-count={count}
      >
        Virtual Container
      </div>
    </div>
  );
}

describe('Inbox Virtualization (@tanstack/react-virtual)', () => {
  it('correctly flattens messages and injects date separators', () => {
    const mockMessages: Message[] = [
      {
        id: 'm1',
        conversation_id: 'c1',
        sender_type: 'agent',
        content_type: 'text',
        content_text: 'Hello from day 1',
        status: 'delivered',
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: 'm2',
        conversation_id: 'c1',
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'Another message on day 1',
        status: 'read',
        created_at: '2026-03-01T11:00:00Z',
      },
      {
        id: 'm3',
        conversation_id: 'c1',
        sender_type: 'agent',
        content_type: 'text',
        content_text: 'Message on day 2',
        status: 'sent',
        created_at: '2026-03-02T09:00:00Z',
      },
    ];

    const flattened = flattenMessages(mockMessages);
    expect(flattened).toHaveLength(5); // 2 date headers + 3 messages
    expect(flattened[0].type).toBe('date');
    expect(flattened[1].type).toBe('message');
    expect(flattened[2].type).toBe('message');
    expect(flattened[3].type).toBe('date');
    expect(flattened[4].type).toBe('message');

    // Sizing checks
    const estimateSize = (index: number) =>
      flattened[index]?.type === 'date' ? 36 : 72;
    expect(estimateSize(0)).toBe(36);
    expect(estimateSize(1)).toBe(72);
    expect(estimateSize(3)).toBe(36);
    expect(estimateSize(4)).toBe(72);
  });

  it('renders virtual container and computes estimated total sizes for conversation list', () => {
    const totalCount = 200;
    const itemHeight = 72;

    const html = renderToStaticMarkup(
      <VirtualListTestHarness
        count={totalCount}
        estimateSize={() => itemHeight}
      />
    );

    expect(html).toContain('data-testid="scroll-container"');
    expect(html).toContain('data-count="200"');
    // 200 items * 72px = 14400px
    expect(html).toContain('data-total-size="14400"');
  });

  it('computes mixed estimated sizes for virtual thread with date headers', () => {
    // 10 items: 2 dates (36px each) and 8 messages (72px each)
    // 2 * 36 + 8 * 72 = 72 + 576 = 648px
    const items = [
      { type: 'date' },
      { type: 'message' },
      { type: 'message' },
      { type: 'message' },
      { type: 'date' },
      { type: 'message' },
      { type: 'message' },
      { type: 'message' },
      { type: 'message' },
      { type: 'message' },
    ];

    const html = renderToStaticMarkup(
      <VirtualListTestHarness
        count={items.length}
        estimateSize={(index) => (items[index]?.type === 'date' ? 36 : 72)}
      />
    );

    expect(html).toContain('data-count="10"');
    expect(html).toContain('data-total-size="648"');
  });
});
