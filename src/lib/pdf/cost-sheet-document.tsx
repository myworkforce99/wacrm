import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { calculateCostSheet, type CostSheetProps } from './types';
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
    borderBottomColor: '#059669',
    paddingBottom: 14,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'column',
    maxWidth: '60%',
  },
  agencyTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginBottom: 3,
  },
  agencySubtitle: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.3,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  docTypeBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  docTypeText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docDate: {
    fontSize: 8,
    color: '#64748b',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
  },
  metaCardTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    maxWidth: '65%',
    textAlign: 'right',
  },
  propertyHighlightBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  propertyHighlightTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#f8fafc',
    marginBottom: 2,
  },
  propertyHighlightLocation: {
    fontSize: 8,
    color: '#94a3b8',
  },
  propertyHighlightPriceBox: {
    alignItems: 'flex-end',
  },
  propertyHighlightPriceLabel: {
    fontSize: 7,
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  propertyHighlightPrice: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#34d399',
  },
  table: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#064e3b',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderCol1: {
    flex: 2,
  },
  tableHeaderCol2: {
    flex: 1.5,
  },
  tableHeaderCol3: {
    flex: 1,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#ffffff',
  },
  tableRowOdd: {
    backgroundColor: '#f8fafc',
  },
  tableCol1: {
    flex: 2,
  },
  tableCol2: {
    flex: 1.5,
  },
  tableCol3: {
    flex: 1,
    textAlign: 'right',
  },
  itemLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  itemSubtext: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 1,
  },
  itemAmount: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#ecfdf5',
    borderTopWidth: 2,
    borderTopColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
  },
  totalAmount: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
  },
  reraBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 8,
    marginBottom: 12,
  },
  reraBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  reraTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reraNumber: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#78350f',
    marginLeft: 6,
  },
  reraDisclaimerText: {
    fontSize: 7,
    color: '#b45309',
    lineHeight: 1.3,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 14,
  },
  notesTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  notesText: {
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  footerBranding: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
  },
});

export function CostSheetDocument(props: CostSheetProps) {
  const calculation = calculateCostSheet({
    price: props.basePrice,
    carpetArea: props.carpetArea,
    baseRate: props.baseRate,
    floorRise: props.floorRise,
    parkingCost: props.parkingCost,
    gstPercent: props.gstPercent,
    stampDutyPercent: props.stampDutyPercent,
    registrationFee: props.registrationFee,
    possessionStatus: props.possessionStatus,
  });

  const formattedDate =
    props.documentDate ||
    new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const configText = formatConfiguration(props.configuration, props.bedrooms);

  const agencyName = props.agencyName || 'WaCRM Real Estate';
  const agentName = props.agentName || 'Relationship Manager';

  return (
    <Document title={`Cost Sheet - ${props.propertyTitle}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.agencyTitle}>{agencyName}</Text>
            <Text style={styles.agencySubtitle}>
              {[props.agencyAddress, props.agencyPhone, props.agencyEmail]
                .filter(Boolean)
                .join(' • ') || 'Authorized Real Estate Partner'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.docTypeBadge}>
              <Text style={styles.docTypeText}>Estimated Cost Sheet</Text>
            </View>
            <Text style={styles.docDate}>Date: {formattedDate}</Text>
            <Text style={styles.docDate}>
              Validity: {props.validityDays || 15} Days
            </Text>
          </View>
        </View>

        {/* Property Highlight Banner */}
        <View style={styles.propertyHighlightBanner}>
          <View style={{ maxWidth: '65%' }}>
            <Text style={styles.propertyHighlightTitle}>
              {props.propertyTitle}
            </Text>
            <Text style={styles.propertyHighlightLocation}>
              {[
                props.projectName,
                props.builderName ? `by ${props.builderName}` : null,
                props.location,
              ]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
          <View style={styles.propertyHighlightPriceBox}>
            <Text style={styles.propertyHighlightPriceLabel}>
              All-Inclusive Total
            </Text>
            <Text style={styles.propertyHighlightPrice}>
              {formatINR(calculation.totalAllInclusive)}
            </Text>
          </View>
        </View>

        {/* Client & Specs Meta Grid */}
        <View style={styles.metaGrid}>
          {/* Client & Agent Card */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardTitle}>Client & Agent Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Client Name:</Text>
              <Text style={styles.metaValue}>
                {props.clientName || 'Valued Client'}
              </Text>
            </View>
            {props.clientPhone ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Client Phone:</Text>
                <Text style={styles.metaValue}>{props.clientPhone}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Relationship Mgr:</Text>
              <Text style={styles.metaValue}>{agentName}</Text>
            </View>
            {props.agentPhone ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Agent Contact:</Text>
                <Text style={styles.metaValue}>{props.agentPhone}</Text>
              </View>
            ) : null}
          </View>

          {/* Unit Specification Card */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardTitle}>Unit Specifications</Text>
            {configText ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Configuration:</Text>
                <Text style={styles.metaValue}>{configText}</Text>
              </View>
            ) : null}
            {props.carpetArea ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Carpet Area:</Text>
                <Text style={styles.metaValue}>
                  {props.carpetArea.toLocaleString('en-IN')} sq ft
                </Text>
              </View>
            ) : null}
            {props.facing ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Facing Direction:</Text>
                <Text style={styles.metaValue}>{props.facing} Facing</Text>
              </View>
            ) : null}
            {props.possessionStatus ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Possession:</Text>
                <Text style={styles.metaValue}>
                  {props.possessionStatus === 'ready_to_move'
                    ? 'Ready to Move'
                    : props.possessionStatus === 'under_construction'
                      ? 'Under Construction'
                      : props.possessionStatus}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Itemized Cost Breakdown Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCol1}>
              <Text style={styles.tableHeaderText}>Cost Component</Text>
            </View>
            <View style={styles.tableHeaderCol2}>
              <Text style={styles.tableHeaderText}>Basis / Rate</Text>
            </View>
            <View style={styles.tableHeaderCol3}>
              <Text style={styles.tableHeaderText}>Amount (INR)</Text>
            </View>
          </View>

          {calculation.items.map((item, idx) => {
            if (item.isTotal) {
              return (
                <View key={idx} style={styles.totalRow}>
                  <View style={styles.tableCol1}>
                    <Text style={styles.totalLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.tableCol2}>
                    <Text style={{ fontSize: 8, color: '#047857' }}>
                      Inclusive of GST, Stamp Duty & Registration
                    </Text>
                  </View>
                  <View style={styles.tableCol3}>
                    <Text style={styles.totalAmount}>
                      {formatINR(item.amount)}
                    </Text>
                  </View>
                </View>
              );
            }

            const rowStyle = [
              styles.tableRow,
              idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
            ];

            return (
              <View key={idx} style={rowStyle}>
                <View style={styles.tableCol1}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </View>
                <View style={styles.tableCol2}>
                  <Text style={styles.itemSubtext}>
                    {item.rateDescription || '—'}
                  </Text>
                </View>
                <View style={styles.tableCol3}>
                  <Text style={styles.itemAmount}>
                    {formatINR(item.amount)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* RERA Compliance Box */}
        <View style={styles.reraBox}>
          <View style={styles.reraBadgeRow}>
            <Text style={styles.reraTitle}>
              ✓ RERA Compliance & Registration:
            </Text>
            <Text style={styles.reraNumber}>
              {props.reraId || 'Registration In Process / State RERA Compliant'}
            </Text>
          </View>
          <Text style={styles.reraDisclaimerText}>
            This cost estimate is prepared in compliance with Real Estate
            (Regulation and Development) Act, 2016. Government statutory levies
            including GST, Stamp Duty, and Registration charges are subject to
            prevailing government notifications at the time of agreement
            registration.
          </Text>
        </View>

        {/* Terms & Validity Note */}
        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>Important Notes & Payment Terms</Text>
          <Text style={styles.notesText}>
            1. Pricing and unit availability are dynamic and subject to
            confirmation at time of booking token receipt.
            {'\n'}
            2. Maintenance deposits, clubhouse membership, electrical/water
            connection charges, and legal documentation fees may be billed
            separately by the developer.
            {'\n'}
            3. Bank home loan assistance is available through pre-approved
            banking partners (SBI, HDFC, ICICI, Axis).
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated on {formattedDate} • Confidential & Proprietary
          </Text>
          <Text style={styles.footerBranding}>Powered by WaCRM</Text>
        </View>
      </Page>
    </Document>
  );
}
