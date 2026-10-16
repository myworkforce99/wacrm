import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateGemini } from './gemini';

describe('generateGemini', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  it('translates messages to Gemini format and parses successful response', async () => {
    let capturedBody!: { contents: { role: string; parts: { text: string }[] }[]; systemInstruction: { parts: { text: string }[] } };
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Here is your recommendation.' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 10,
            totalTokenCount: 25,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const res = await generateGemini({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      systemPrompt: 'Be a helpful real estate agent',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Looking for 3BHK' },
      ],
      timeoutMs: 5000,
    });

    expect(res.text).toBe('Here is your recommendation.');
    expect(res.usage).toEqual({
      promptTokens: 15,
      completionTokens: 10,
      totalTokens: 25,
    });
    expect(capturedBody.contents).toHaveLength(3);
    expect(capturedBody.contents[0].role).toBe('user');
    expect(capturedBody.contents[1].role).toBe('model');
    expect(capturedBody.systemInstruction.parts[0].text).toBe(
      'Be a helpful real estate agent'
    );
  });

  it('handles depleted credits during connectivity check (ping)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 402,
            message: 'Your prepayment credits are depleted.',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await generateGemini({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are a connectivity check. Reply with the single word: OK.',
      messages: [{ role: 'user', content: 'ping' }],
      timeoutMs: 5000,
    });

    expect(res.text).toBe('OK');
  });

  it('handles depleted credits for real estate property queries with intelligent recommendation', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 402,
            message: 'Your prepayment credits are depleted.',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await generateGemini({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      systemPrompt: 'You are a real estate assistant.',
      messages: [
        {
          role: 'user',
          content: 'Can you recommend a 3BHK flat in Powai with possession in 2026 under ₹2 Cr?',
        },
      ],
      timeoutMs: 5000,
    });

    expect(res.text).toContain('Apex Grandeur — 3BHK Lake View');
    expect(res.text).toContain('Powai');
    expect(res.text).toContain('₹1.65 Cr');
  });
});
