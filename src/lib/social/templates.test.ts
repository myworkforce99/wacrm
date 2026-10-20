import { describe, it, expect } from 'vitest';
import {
  SOCIAL_POST_TEMPLATES,
  getTemplatesByCategory,
  getTemplateById,
} from './templates';

describe('SOCIAL_POST_TEMPLATES', () => {
  it('contains predefined real estate templates', () => {
    expect(SOCIAL_POST_TEMPLATES.length).toBeGreaterThanOrEqual(5);

    const categories = SOCIAL_POST_TEMPLATES.map((t) => t.category);
    expect(categories).toContain('property_launch');
    expect(categories).toContain('site_visit');
    expect(categories).toContain('testimonial');
    expect(categories).toContain('offer');
    expect(categories).toContain('general');
  });

  it('each template has valid fields, promptSeed and suggestedHashtags', () => {
    for (const tpl of SOCIAL_POST_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.title).toBeTruthy();
      expect(tpl.promptSeed).toBeTruthy();
      expect(Array.isArray(tpl.suggestedHashtags)).toBe(true);
      expect(tpl.suggestedHashtags.length).toBeGreaterThan(0);
      for (const tag of tpl.suggestedHashtags) {
        expect(tag.startsWith('#')).toBe(true);
      }
    }
  });

  it('filters by category correctly', () => {
    const launchTemplates = getTemplatesByCategory('property_launch');
    expect(launchTemplates.length).toBeGreaterThan(0);
    expect(launchTemplates.every((t) => t.category === 'property_launch')).toBe(
      true
    );

    const allTemplates = getTemplatesByCategory('all');
    expect(allTemplates.length).toBe(SOCIAL_POST_TEMPLATES.length);
  });

  it('finds template by id', () => {
    const template = getTemplateById('new-launch');
    expect(template).toBeDefined();
    expect(template?.title).toBe('New Project Launch');

    const nonExistent = getTemplateById('non-existent');
    expect(nonExistent).toBeUndefined();
  });
});
