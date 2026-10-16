/**
 * Formats a property configuration value.
 * Handles legacy JSON strings (e.g. '{"bedrooms":3}'), plain strings ('2BHK', 'Villa', 'Plot'),
 * and numeric bedroom counts fallback.
 */
export function formatConfiguration(
  config?: string | null,
  bedrooms?: number | null
): string | null {
  if (config) {
    const trimmed = config.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as {
          bedrooms?: number;
          configuration?: string;
        };
        if (parsed.bedrooms) return `${parsed.bedrooms} BHK`;
        if (parsed.configuration) return String(parsed.configuration);
      } catch {
        // Fallback to raw string if JSON.parse fails
      }
    } else {
      return trimmed;
    }
  }
  if (bedrooms) {
    return `${bedrooms} BHK`;
  }
  return null;
}
