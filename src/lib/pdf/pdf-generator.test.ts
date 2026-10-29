import { describe, expect, it } from 'vitest';
import {
  calculateCostSheet,
  generateCostSheetPdf,
  generatePropertyBrochurePdf,
} from './index';

describe('Real Estate Cost Sheet Calculation Engine', () => {
  it('calculates standard under-construction cost breakdown with 5% GST and 6% Stamp Duty', () => {
    const calc = calculateCostSheet({
      price: 15000000, // 1.5 Cr
      carpetArea: 1500,
      parkingCost: 400000,
      possessionStatus: 'under_construction',
    });

    expect(calc.agreementValue).toBe(15000000);
    expect(calc.parkingCost).toBe(400000);
    expect(calc.subtotal).toBe(15400000); // 1.5Cr + 4L
    expect(calc.gstPercent).toBe(5);
    expect(calc.gstAmount).toBe(Math.round((15400000 * 5) / 100)); // 770,000
    expect(calc.stampDutyPercent).toBe(6);
    expect(calc.stampDutyAmount).toBe(Math.round((15000000 * 6) / 100)); // 900,000
    expect(calc.registrationFee).toBe(30000);
    expect(calc.totalAllInclusive).toBe(15400000 + 770000 + 900000 + 30000);
    expect(calc.items.length).toBeGreaterThan(4);
  });

  it('exempts statutory GST for ready_to_move properties', () => {
    const calc = calculateCostSheet({
      price: 10000000, // 1 Cr
      possessionStatus: 'ready_to_move',
    });

    expect(calc.gstPercent).toBe(0);
    expect(calc.gstAmount).toBe(0);
    expect(calc.subtotal).toBe(10400000);
  });

  it('computes agreement value from carpetArea * baseRate when price is omitted', () => {
    const calc = calculateCostSheet({
      carpetArea: 1200,
      baseRate: 10000,
      parkingCost: 500000,
      floorRise: 100000,
    });

    expect(calc.agreementValue).toBe(12000000); // 1.2 Cr
    expect(calc.floorRiseAmount).toBe(100000);
    expect(calc.parkingCost).toBe(500000);
    expect(calc.subtotal).toBe(12600000);
  });

  it('handles zero and missing parameters gracefully', () => {
    const calc = calculateCostSheet({});
    expect(calc.agreementValue).toBeGreaterThan(0);
    expect(calc.totalAllInclusive).toBeGreaterThan(calc.agreementValue);
  });
});

describe('PDF Generation Engine (@react-pdf/renderer)', () => {
  it('generates a valid binary Cost Sheet PDF Blob', async () => {
    const blob = await generateCostSheetPdf({
      propertyTitle: 'Prestige Elm Park 3BHK',
      projectName: 'Prestige Elm Park',
      builderName: 'Prestige Group',
      location: 'Whitefield, Bangalore',
      configuration: '3BHK',
      bedrooms: 3,
      carpetArea: 1850,
      facing: 'East',
      possessionStatus: 'under_construction',
      reraId: 'PRM/KA/RERA/1251/446/PR/210928/004316',
      basePrice: 16500000,
      agentName: 'Aarav Sharma',
      agentPhone: '+91 98765 43210',
      clientName: 'Sunita Menon',
      clientPhone: '+91 98450 11223',
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });

  it('generates a valid binary Property Brochure PDF Blob', async () => {
    const blob = await generatePropertyBrochurePdf({
      propertyTitle: 'Sobha Neopolis Luxury Penthouse',
      projectName: 'Sobha Neopolis',
      builderName: 'Sobha Developers',
      location: 'Panathur, East Bangalore',
      price: 24000000,
      configuration: '4BHK',
      bedrooms: 4,
      carpetArea: 2600,
      facing: 'North-East',
      possessionStatus: 'nearing_possession',
      reraId: 'PRM/KA/RERA/1251/446/PR/230922/006289',
      tags: ['Greek Architecture', 'Clubhouse', 'Olympic Pool'],
      agentName: 'Priya Iyer',
      agentPhone: '+91 99001 22334',
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });

  it('generates Cost Sheet PDF with minimal required props', async () => {
    const blob = await generateCostSheetPdf({
      propertyTitle: 'Sample Apartment',
    });
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(500);
    expect(blob.type).toBe('application/pdf');
  });

  it('generates Property Brochure PDF with minimal required props', async () => {
    const blob = await generatePropertyBrochurePdf({
      propertyTitle: 'Sample Villa',
    });
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(500);
    expect(blob.type).toBe('application/pdf');
  });
});
