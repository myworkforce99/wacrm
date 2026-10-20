import { describe, it, expect, vi } from 'vitest';
import { generateReply } from './generate';
import type { AiConfig } from './types';

describe('TC-MAW-51: AI Co-Pilot Real Estate Assistant', () => {
  const config: AiConfig = {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY || 'test-gemini-key',
    systemPrompt:
      'You are an AI sales assistant for Apex Horizon Realty, a premier real estate firm in Mumbai. You help prospective buyers find their dream homes, schedule site visits, and share property brochures and cost breakdowns.',
    isActive: true,
    autoReplyEnabled: true,
    autoReplyMaxPerConversation: 5,
    handoffAgentId: null,
    embeddingsApiKey: null,
  };

  it('matches Apex Grandeur — 3BHK Lake View for query in Powai under ₹2 Cr', async () => {
    const query =
      'Can you recommend a 3BHK flat in Powai with possession in 2026 under ₹2 Cr?';
    const propertyKnowledge = [
      'Property 1: Apex Grandeur — 3BHK Lake View. Location: Powai, Mumbai. Price: ₹1.65 Cr. Configuration: 3BHK, 1500 sq ft. Ready to Move (2026). RERA: P51800028911.',
      'Property 2: Horizon Bay Towers — 4BHK Seafront. Location: Worli, Mumbai. Price: ₹4.50 Cr.',
    ];
    const systemPrompt = `You are a real estate assistant for Apex Horizon Realty. Use this inventory:\n${propertyKnowledge.join('\n')}\nWhen recommending, explicitly name the property, price, and suggest a site visit.`;

    // Mock Gemini API generateContent response
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text:
                      'Certainly! Based on your criteria, I recommend **Apex Grandeur — 3BHK Lake View** located in Powai, Mumbai.\n\n' +
                      '• **Price:** ₹1.65 Cr (well within your ₹2 Cr budget)\n' +
                      '• **Configuration:** 3BHK with 1,500 sq ft carpet area\n' +
                      '• **Status:** Ready to Move in 2026\n' +
                      '• **RERA:** P51800028911\n\n' +
                      'Would you like me to schedule an in-person site visit or send the complete cost sheet breakdown via WhatsApp?',
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 145,
            candidatesTokenCount: 95,
            totalTokenCount: 240,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    try {
      const res = await generateReply({
        config,
        systemPrompt,
        messages: [{ role: 'user', content: query }],
      });

      expect(res.text).toBeTruthy();
      expect(res.text).toContain('Apex Grandeur — 3BHK Lake View');
      expect(res.text).toContain('Powai');
      expect(res.text).toContain('₹1.65 Cr');
      expect(res.text.toLowerCase()).toContain('site visit');
      expect(res.handoff).toBe(false);
      expect(res.usage).not.toBeNull();
      expect(res.usage!.totalTokens).toBe(240);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
