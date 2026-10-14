import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { DealTable } from './deal-table';
import type { Deal, PipelineStage, Contact } from '@/types';
import enMessages from '../../../messages/en.json';

const mockStages: PipelineStage[] = [
  {
    id: 'stage-1',
    pipeline_id: 'pipe-1',
    name: 'Site Visit Scheduled',
    position: 1,
    color: '#3b82f6',
    created_at: new Date().toISOString(),
  },
  {
    id: 'stage-2',
    pipeline_id: 'pipe-1',
    name: 'Token Advance / Booking',
    position: 2,
    color: '#10b981',
    created_at: new Date().toISOString(),
  },
];

type ExtendedContact = Contact & {
  lead_details?: {
    id: string;
    account_id: string;
    contact_id: string;
    location_preference?: string;
    bhk_preference?: string[];
    created_at: string;
    updated_at: string;
  } | null;
};

const mockDeals: (Deal & { contact?: ExtendedContact })[] = [
  {
    id: 'deal-1',
    user_id: 'user-1',
    pipeline_id: 'pipe-1',
    stage_id: 'stage-1',
    contact_id: 'contact-1',
    title: 'Prestige 3BHK Lakeview',
    value: 18500000,
    currency: 'INR',
    expected_close_date: '2026-11-15',
    status: 'open',
    created_at: new Date().toISOString(),
    contact: {
      id: 'contact-1',
      user_id: 'user-1',
      account_id: 'acc-1',
      name: 'Rahul Verma',
      phone: '+919876543210',
      email: 'rahul@example.com',
      avatar_url: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lead_details: {
        id: 'ld-1',
        account_id: 'acc-1',
        contact_id: 'contact-1',
        location_preference: 'Whitefield',
        bhk_preference: ['3 BHK'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
];

describe('DealTable Component', () => {
  it('renders deal rows with formatted currency, BHK, contact info, and actions', () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages}
        timeZone="Asia/Kolkata"
      >
        <DealTable
          deals={mockDeals}
          stages={mockStages}
          defaultCurrency="INR"
          onEditDeal={() => {}}
          onMoveDeal={() => {}}
          onScheduleVisit={() => {}}
        />
      </NextIntlClientProvider>
    );

    // Verify key real estate vertical CRM elements appear in the rendered table
    expect(markup).toContain('Prestige 3BHK Lakeview');
    expect(markup).toContain('3 BHK');
    expect(markup).toContain('Rahul Verma');
    expect(markup).toContain('Whitefield');
    expect(markup).toContain('Site Visit Scheduled');
    // INR formatting for 1,85,00,000 (1.85 Cr)
    expect(markup).toMatch(/1\.85\s*Cr|1,85,00,000/);
    // WhatsApp (inbox link) and Call quick action links
    expect(markup).toContain('/inbox?contactId=contact-1');
    expect(markup).toContain('tel:+919876543210');
  });

  it('renders empty state when there are no deals', () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages}
        timeZone="Asia/Kolkata"
      >
        <DealTable
          deals={[]}
          stages={mockStages}
          defaultCurrency="INR"
          onEditDeal={() => {}}
          onMoveDeal={() => {}}
          onScheduleVisit={() => {}}
        />
      </NextIntlClientProvider>
    );

    expect(markup).toContain('No deals match your search and filter criteria.');
  });
});
