import re

with open("src/components/broadcasts/step2-select-audience.tsx", "r") as f:
    content = f.read()

# Add Building2 to imports
content = re.sub(r'X,\n} from \'lucide-react\';', r'X,\n  Building2,\n  Plus,\n  Trash2,\n} from \'lucide-react\';', content)

# Change AudienceType
content = content.replace("type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv';", "type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv' | 'lead_segment';")

# Change AudienceConfig
content = content.replace("excludeTagIds?: string[];\n}", "excludeTagIds?: string[];\n  leadSegment?: {\n    filters: { field: string; operator: 'contains' | 'equals' | 'gte'; value: string }[];\n  };\n}")

# Add lead_segment to audienceOptions
opt_to_add = """      {
        type: 'lead_segment',
        label: t('selectAudience.method.leadSegment') || 'Lead Details Segment',
        description: t('selectAudience.leadSegmentDesc') || 'Filter by BHK, budget, location, etc.',
        icon: Building2,
      },"""
content = re.sub(r'(\{\n\s*type: \'csv\',[^\}]+\},)\n\s*\]', r'\1\n' + opt_to_add + r'\n    ]', content)

# Update fetchEstimatedCount for lead_segment
fetch_code = """      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else if (
        audience.type === 'lead_segment' &&
        audience.leadSegment?.filters &&
        audience.leadSegment.filters.length > 0
      ) {
        let q = supabase.from('lead_details').select('contact_id');
        for (const f of audience.leadSegment.filters) {
          if (f.operator === 'equals') q = q.eq(f.field, f.value);
          else if (f.operator === 'contains') q = q.ilike(f.field, `%${f.value}%`);
          else if (f.operator === 'gte') q = q.gte(f.field, f.value);
        }
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else {"""
content = content.replace("""      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {""", fetch_code)

# Add dependencies for fetchEstimatedCount
content = content.replace("audience.excludeTagIds,", "audience.excludeTagIds,\n    audience.leadSegment,")

# update handle change logic (wiping other fields)
content = content.replace("csvContacts:\n                      option.type === 'csv' ? audience.csvContacts : undefined,", "csvContacts:\n                      option.type === 'csv' ? audience.csvContacts : undefined,\n                    leadSegment:\n                      option.type === 'lead_segment' ? audience.leadSegment : undefined,")

# update isValid
is_valid_code = """    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0) ||
    (audience.type === 'lead_segment' &&
      audience.leadSegment?.filters &&
      audience.leadSegment.filters.length > 0 &&
      audience.leadSegment.filters.every(f => f.field && f.value));"""
content = content.replace("""    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);""", is_valid_code)

# Add UI for lead_segment
ui_code = """
      {audience.type === 'lead_segment' && (
        <div className="border-border bg-card/50 space-y-3 rounded-xl border p-4">
          <p className="text-foreground text-sm font-medium">Lead Details Segment</p>
          <div className="space-y-2">
            {(audience.leadSegment?.filters ?? []).map((filter, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={filter.field}
                  onChange={(e) => {
                    const newFilters = [...(audience.leadSegment?.filters ?? [])];
                    newFilters[index].field = e.target.value;
                    onUpdate({ ...audience, leadSegment: { filters: newFilters } });
                  }}
                  className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
                >
                  <option value="">Select field...</option>
                  <option value="configuration_preference">BHK / Configuration</option>
                  <option value="location_preference">Location</option>
                  <option value="budget_min">Min Budget</option>
                  <option value="budget_max">Max Budget</option>
                  <option value="source">Lead Source</option>
                  <option value="intent">Intent</option>
                  <option value="property_type">Property Type</option>
                </select>
                <select
                  value={filter.operator}
                  onChange={(e) => {
                    const newFilters = [...(audience.leadSegment?.filters ?? [])];
                    newFilters[index].operator = e.target.value as any;
                    onUpdate({ ...audience, leadSegment: { filters: newFilters } });
                  }}
                  className="border-border bg-muted text-foreground focus:border-primary focus:ring-primary h-9 rounded-lg border px-2.5 text-sm outline-none focus:ring-1"
                >
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="gte">Greater than or equal (>=)</option>
                </select>
                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => {
                    const newFilters = [...(audience.leadSegment?.filters ?? [])];
                    newFilters[index].value = e.target.value;
                    onUpdate({ ...audience, leadSegment: { filters: newFilters } });
                  }}
                  placeholder="Value..."
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-9 rounded-lg border px-2.5 text-sm outline-none focus:ring-1 flex-1"
                />
                <button
                  onClick={() => {
                    const newFilters = audience.leadSegment?.filters.filter((_, i) => i !== index);
                    onUpdate({ ...audience, leadSegment: { filters: newFilters || [] } });
                  }}
                  className="text-muted-foreground hover:text-destructive flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-destructive/10 hover:border-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {(audience.leadSegment?.filters?.length ?? 0) < 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newFilters = [...(audience.leadSegment?.filters ?? []), { field: '', operator: 'contains', value: '' } as const];
                  onUpdate({ ...audience, leadSegment: { filters: newFilters } });
                }}
                className="mt-2 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Condition
              </Button>
            )}
          </div>
        </div>
      )}
"""
content = content.replace("      {/* Exclude list — applies regardless of audience type */}", ui_code + "\n      {/* Exclude list — applies regardless of audience type */}")

with open("src/components/broadcasts/step2-select-audience.tsx", "w") as f:
    f.write(content)

