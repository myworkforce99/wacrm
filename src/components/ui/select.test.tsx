import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
} from './select';

describe('Select Component UI/UX Enhancements', () => {
  it('renders the human-readable label of the selected item instead of raw value/UUID', () => {
    const html = renderToStaticMarkup(
      <Select value="d748beb4-3e42-4c4d-b5b5-186f087428cd">
        <SelectTrigger>
          <SelectValue placeholder="Select Agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Agents</SelectItem>
          <SelectItem value="d748beb4-3e42-4c4d-b5b5-186f087428cd">
            Ankit Mehta
          </SelectItem>
        </SelectContent>
      </Select>
    );

    expect(html).toContain('data-slot="select-value"');
    expect(html).toContain('Ankit Mehta');
    // Ensure the visible select-value does NOT show the UUID
    expect(html).not.toContain('>d748beb4-3e42-4c4d-b5b5-186f087428cd<');
  });

  it('renders budget range human-readable label instead of raw snake_case key', () => {
    const html = renderToStaticMarkup(
      <Select value="50l_to_1cr">
        <SelectTrigger>
          <SelectValue placeholder="Select Budget" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Values</SelectItem>
          <SelectItem value="under_50l">Under ₹50 L</SelectItem>
          <SelectItem value="50l_to_1cr">₹50 L – ₹1 Cr</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(html).toContain('₹50 L – ₹1 Cr');
    // Ensure visible select-value does not show raw snake_case key
    expect(html).not.toContain('>50l_to_1cr<');
  });

  it('renders the label prefix in SelectTrigger when provided', () => {
    const html = renderToStaticMarkup(
      <Select value="50l_to_1cr">
        <SelectTrigger label="Budget">
          <SelectValue placeholder="Select Budget" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Values</SelectItem>
          <SelectItem value="50l_to_1cr">₹50 L – ₹1 Cr</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(html).toContain('Budget:');
    expect(html).toContain('₹50 L – ₹1 Cr');
  });

  it('correctly resolves items generated dynamically via array.map', () => {
    const teamMembers = [
      { id: 'user-1', name: 'Priya Sharma' },
      { id: 'user-2', name: 'Rahul Verma' },
    ];

    const html = renderToStaticMarkup(
      <Select value="user-2">
        <SelectTrigger label="Agent">
          <SelectValue placeholder="All Agents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Agents</SelectItem>
          {teamMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

    expect(html).toContain('Agent:');
    expect(html).toContain('Rahul Verma');
    expect(html).not.toContain('>user-2<');
  });

  it('renders SelectLabel safely inside SelectContent without requiring SelectGroup', () => {
    expect(() =>
      renderToStaticMarkup(
        <Select value="all">
          <SelectTrigger label="Source">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectLabel>Filter by Source</SelectLabel>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="99acres">99acres</SelectItem>
          </SelectContent>
        </Select>
      )
    ).not.toThrow();

    const html = renderToStaticMarkup(
      <SelectLabel>Filter by Source</SelectLabel>
    );
    expect(html).toContain('Filter by Source');
    expect(html).toContain('data-slot="select-label"');
  });
});
