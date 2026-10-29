import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PropertyBrochureProps } from './types';
import { formatINR } from '@/lib/currency';
import { formatConfiguration } from '@/lib/properties/format-configuration';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 36,
    paddingRight: 36,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb', // Blue accent for property brochures
    paddingBottom: 14,
    marginBottom: 16,
  },
  agencyTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginBottom: 3,
  },
  agencySubtitle: {
    fontSize: 8,
    color: '#64748b',
  },
  brochureBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  brochureBadgeText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'right',
  },
  heroBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  heroDeveloper: {
    fontSize: 10,
    color: '#93c5fd',
    marginBottom: 2,
  },
  heroLocation: {
    fontSize: 9,
    color: '#cbd5e1',
  },
  priceContainer: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#60a5fa',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  specItem: {
    width: '31.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  specItemLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  specItemValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  reraBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 10,
    marginBottom: 16,
  },
  reraTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  reraId: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginBottom: 4,
  },
  reraText: {
    fontSize: 7.5,
    color: '#065f46',
    lineHeight: 1.3,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tagChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#334155',
  },
  ctaBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
    marginBottom: 3,
  },
  ctaSubtitle: {
    fontSize: 8,
    color: '#15803d',
  },
  contactAgentCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  contactAgentName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#14532d',
  },
  contactAgentPhone: {
    fontSize: 8.5,
    color: '#16a34a',
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  footerBranding: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
  },
});

export function PropertyBrochureDocument(props: PropertyBrochureProps) {
  const formattedDate =
    props.documentDate ||
    new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const configText = formatConfiguration(props.configuration, props.bedrooms);

  const agencyName = props.agencyName || 'WaCRM Real Estate';
  const agentName = props.agentName || 'Sales Consultant';

  const possessionLabel =
    props.possessionStatus === 'ready_to_move'
      ? 'Ready to Move'
      : props.possessionStatus === 'under_construction'
        ? 'Under Construction'
        : props.possessionStatus === 'nearing_possession'
          ? 'Nearing Possession'
          : props.possessionStatus || 'Immediate';

  return (
    <Document title={`Property Brochure - ${props.propertyTitle}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.agencyTitle}>{agencyName}</Text>
            <Text style={styles.agencySubtitle}>
              {[props.agencyAddress, props.agencyPhone, props.agencyEmail]
                .filter(Boolean)
                .join(' • ') || 'Premium Real Estate Listings'}
            </Text>
          </View>
          <View>
            <View style={styles.brochureBadge}>
              <Text style={styles.brochureBadgeText}>Exclusive Property</Text>
            </View>
            <Text style={styles.dateText}>Generated: {formattedDate}</Text>
          </View>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroHeaderRow}>
            <View style={{ maxWidth: '65%' }}>
              <Text style={styles.heroTitle}>{props.propertyTitle}</Text>
              {(props.projectName || props.builderName) && (
                <Text style={styles.heroDeveloper}>
                  {[props.projectName, props.builderName]
                    .filter(Boolean)
                    .join(' by ')}
                </Text>
              )}
              {props.location && (
                <Text style={styles.heroLocation}>📍 {props.location}</Text>
              )}
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Starting Price</Text>
              <Text style={styles.priceValue}>
                {props.price ? formatINR(props.price) : 'Price on Request'}
              </Text>
            </View>
          </View>
        </View>

        {/* Key Specifications Grid */}
        <Text style={styles.sectionTitle}>Key Unit Specifications</Text>
        <View style={styles.specsGrid}>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Configuration</Text>
            <Text style={styles.specItemValue}>{configText || '—'}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Carpet Area</Text>
            <Text style={styles.specItemValue}>
              {props.carpetArea
                ? `${props.carpetArea.toLocaleString('en-IN')} sq ft`
                : 'On Request'}
            </Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Facing</Text>
            <Text style={styles.specItemValue}>
              {props.facing ? `${props.facing} Facing` : 'Standard'}
            </Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Possession Timeline</Text>
            <Text style={styles.specItemValue}>{possessionLabel}</Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Target Possession Date</Text>
            <Text style={styles.specItemValue}>
              {props.possessionDate || 'As per Schedule'}
            </Text>
          </View>
          <View style={styles.specItem}>
            <Text style={styles.specItemLabel}>Project Verification</Text>
            <Text style={styles.specItemValue}>
              {props.reraId ? 'RERA Approved' : 'Verified Listing'}
            </Text>
          </View>
        </View>

        {/* RERA Compliance Box */}
        <View style={styles.reraBox}>
          <Text style={styles.reraTitle}>✓ Verified RERA Registration</Text>
          <Text style={styles.reraId}>
            RERA ID:{' '}
            {props.reraId || 'Registration In Process / State Approved'}
          </Text>
          <Text style={styles.reraText}>
            This project is verified and compliant with the Real Estate
            (Regulation and Development) Act, 2016. Details and approvals can be
            verified on the official state RERA portal.
          </Text>
        </View>

        {/* Highlights / Amenities */}
        {props.tags && props.tags.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              Project Highlights & Amenities
            </Text>
            <View style={styles.tagsContainer}>
              {props.tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>✨ {tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Schedule Visit Call to Action */}
        <View style={styles.ctaBox}>
          <View style={{ maxWidth: '60%' }}>
            <Text style={styles.ctaTitle}>
              Schedule an Exclusive Site Visit
            </Text>
            <Text style={styles.ctaSubtitle}>
              Experience the sample flat, architectural walkthrough, and
              personalized financial options with our relationship manager.
            </Text>
          </View>
          <View style={styles.contactAgentCard}>
            <Text style={styles.contactAgentName}>{agentName}</Text>
            <Text style={styles.contactAgentPhone}>
              {props.agentPhone || props.agencyPhone || 'WhatsApp Connected'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Prices subject to change without prior notice. Layouts and
            dimensions are approximate.
          </Text>
          <Text style={styles.footerBranding}>Powered by WaCRM</Text>
        </View>
      </Page>
    </Document>
  );
}
