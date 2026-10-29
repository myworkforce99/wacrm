import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryProvider } from './query-provider';
import { useQueryClient } from '@tanstack/react-query';

function ConsumerComponent() {
  const queryClient = useQueryClient();
  const defaultOptions = queryClient.getDefaultOptions();
  return (
    <div
      data-testid="consumer"
      data-stale-time={defaultOptions.queries?.staleTime}
      data-gc-time={defaultOptions.queries?.gcTime}
      data-refetch-focus={defaultOptions.queries?.refetchOnWindowFocus}
    >
      Provider Active
    </div>
  );
}

describe('QueryProvider', () => {
  it('renders children and configures TanStack Query default options', () => {
    const html = renderToStaticMarkup(
      <QueryProvider>
        <ConsumerComponent />
      </QueryProvider>
    );

    expect(html).toContain('Provider Active');
    expect(html).toContain('data-stale-time="120000"'); // 2 minutes
    expect(html).toContain('data-gc-time="600000"'); // 10 minutes
    expect(html).toContain('data-refetch-focus="false"');
  });
});
