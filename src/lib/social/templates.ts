/**
 * Real estate social media post templates.
 * Structured as fill-in-the-blank prompts that the AI caption
 * generator can use as starting points.
 */

export type SocialPostTemplateCategory =
  'property_launch' | 'site_visit' | 'testimonial' | 'offer' | 'general';

export interface SocialPostTemplate {
  id: string;
  title: string;
  category: SocialPostTemplateCategory;
  promptSeed: string; // Sent as `property_details` to the generate-caption API
  suggestedHashtags: string[];
}

export const SOCIAL_POST_TEMPLATES: SocialPostTemplate[] = [
  {
    id: 'new-launch',
    title: 'New Project Launch',
    category: 'property_launch',
    promptSeed:
      'New residential project launch. Highlight exclusivity and early-bird pricing.',
    suggestedHashtags: [
      '#NewLaunch',
      '#RealEstate',
      '#IndianRealty',
      '#DreamHome',
    ],
  },
  {
    id: 'site-visit-invite',
    title: 'Site Visit Invitation',
    category: 'site_visit',
    promptSeed:
      'Inviting leads to visit the site. Emphasize the experience and personal tour.',
    suggestedHashtags: ['#SiteVisit', '#PropertyTour', '#BookNow'],
  },
  {
    id: 'happy-client',
    title: 'Happy Client Story',
    category: 'testimonial',
    promptSeed:
      'Sharing a client success story. Warm, grateful, community-focused tone.',
    suggestedHashtags: ['#HappyClient', '#Testimonial', '#RealEstateIndia'],
  },
  {
    id: 'limited-offer',
    title: 'Limited-Time Offer',
    category: 'offer',
    promptSeed:
      'Special pricing or offer ending soon. Create urgency without being pushy.',
    suggestedHashtags: ['#LimitedOffer', '#EarlyBird', '#RealEstateDeals'],
  },
  {
    id: 'project-update',
    title: 'Project Construction Update',
    category: 'general',
    promptSeed:
      'Project construction milestone update. Build trust and excitement.',
    suggestedHashtags: ['#ConstructionUpdate', '#Progress', '#YourDreamHome'],
  },
];

export function getTemplatesByCategory(
  category?: SocialPostTemplateCategory | 'all'
): SocialPostTemplate[] {
  if (!category || category === 'all') return SOCIAL_POST_TEMPLATES;
  return SOCIAL_POST_TEMPLATES.filter((tpl) => tpl.category === category);
}

export function getTemplateById(id: string): SocialPostTemplate | undefined {
  return SOCIAL_POST_TEMPLATES.find((tpl) => tpl.id === id);
}
