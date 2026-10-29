import { formatINR } from '@/lib/currency';

export interface CostSheetItem {
  label: string;
  amount: number;
  rateDescription?: string;
  isTotal?: boolean;
}

export interface CostSheetCalculation {
  agreementValue: number;
  carpetArea: number;
  baseRatePerSqFt: number;
  floorRiseAmount: number;
  parkingCost: number;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  stampDutyPercent: number;
  stampDutyAmount: number;
  registrationFee: number;
  totalAllInclusive: number;
  items: CostSheetItem[];
}

export interface CostSheetProps {
  agencyName?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  agentName?: string;
  agentPhone?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  propertyTitle: string;
  projectName?: string | null;
  builderName?: string | null;
  location?: string | null;
  configuration?: string | null;
  bedrooms?: number | null;
  carpetArea?: number | null;
  facing?: string | null;
  possessionStatus?: string | null;
  possessionDate?: string | null;
  reraId?: string | null;
  basePrice?: number | null;
  baseRate?: number | null;
  floorRise?: number | null;
  parkingCost?: number | null;
  gstPercent?: number | null;
  stampDutyPercent?: number | null;
  registrationFee?: number | null;
  documentDate?: string;
  validityDays?: number;
  notes?: string;
}

export interface PropertyBrochureProps {
  agencyName?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  agentName?: string;
  agentPhone?: string;
  propertyTitle: string;
  projectName?: string | null;
  builderName?: string | null;
  location?: string | null;
  price?: number | null;
  configuration?: string | null;
  bedrooms?: number | null;
  carpetArea?: number | null;
  facing?: string | null;
  possessionStatus?: string | null;
  possessionDate?: string | null;
  reraId?: string | null;
  tags?: string[] | null;
  description?: string | null;
  documentDate?: string;
}

/**
 * Standard Indian Real Estate Cost Calculation Engine.
 * Follows RERA and state-level stamp duty guidelines.
 */
export function calculateCostSheet(params: {
  price?: number | null;
  carpetArea?: number | null;
  baseRate?: number | null;
  floorRise?: number | null;
  parkingCost?: number | null;
  gstPercent?: number | null;
  stampDutyPercent?: number | null;
  registrationFee?: number | null;
  possessionStatus?: string | null;
}): CostSheetCalculation {
  const carpetArea = Number(params.carpetArea) || 1000;
  const defaultBaseRate = 8500;
  const baseRatePerSqFt = Number(params.baseRate) || defaultBaseRate;

  // If a fixed price is provided, use it; otherwise compute carpetArea * baseRate
  const agreementValue =
    params.price !== undefined && params.price !== null && params.price > 0
      ? Number(params.price)
      : carpetArea * baseRatePerSqFt;

  const floorRiseAmount = Number(params.floorRise) || 0;
  const parkingCost =
    params.parkingCost !== undefined && params.parkingCost !== null
      ? Number(params.parkingCost)
      : 400000; // Standard 1 covered car park (₹4 Lakhs)

  const subtotal = agreementValue + floorRiseAmount + parkingCost;

  // Ready-to-move projects with Occupancy Certificate (OC) attract 0% GST in India
  const isReadyToMove =
    params.possessionStatus?.toLowerCase() === 'ready_to_move';
  const defaultGstPercent = isReadyToMove ? 0 : 5;
  const gstPercent =
    params.gstPercent !== undefined && params.gstPercent !== null
      ? Number(params.gstPercent)
      : defaultGstPercent;

  const gstAmount = Math.round((subtotal * gstPercent) / 100);

  // Standard stamp duty is 6% in most major states (Maharashtra, Karnataka, etc.)
  const stampDutyPercent =
    params.stampDutyPercent !== undefined && params.stampDutyPercent !== null
      ? Number(params.stampDutyPercent)
      : 6;
  const stampDutyAmount = Math.round((agreementValue * stampDutyPercent) / 100);

  // Standard flat registration fee + documentation
  const registrationFee =
    params.registrationFee !== undefined && params.registrationFee !== null
      ? Number(params.registrationFee)
      : 30000;

  const totalAllInclusive =
    subtotal + gstAmount + stampDutyAmount + registrationFee;

  const items: CostSheetItem[] = [
    {
      label: 'Base Agreement Value',
      amount: agreementValue,
      rateDescription: `${carpetArea.toLocaleString('en-IN')} sq ft @ ${formatINR(baseRatePerSqFt)}/sq ft`,
    },
  ];

  if (floorRiseAmount > 0) {
    items.push({
      label: 'Floor Rise Premium',
      amount: floorRiseAmount,
      rateDescription: 'Floor rise charges',
    });
  }

  items.push(
    {
      label: 'Covered Car Parking',
      amount: parkingCost,
      rateDescription: '1 Covered Allotment',
    },
    {
      label: `Statutory GST (${gstPercent}%)`,
      amount: gstAmount,
      rateDescription: isReadyToMove
        ? 'Exempt (Ready-to-move with OC)'
        : `${gstPercent}% on construction consideration`,
    },
    {
      label: `Stamp Duty (${stampDutyPercent}%)`,
      amount: stampDutyAmount,
      rateDescription: `${stampDutyPercent}% of Agreement Value`,
    },
    {
      label: 'Registration & Documentation',
      amount: registrationFee,
      rateDescription: 'State Government Fee',
    },
    {
      label: 'Total All-Inclusive Estimate',
      amount: totalAllInclusive,
      isTotal: true,
    }
  );

  return {
    agreementValue,
    carpetArea,
    baseRatePerSqFt,
    floorRiseAmount,
    parkingCost,
    subtotal,
    gstPercent,
    gstAmount,
    stampDutyPercent,
    stampDutyAmount,
    registrationFee,
    totalAllInclusive,
    items,
  };
}
