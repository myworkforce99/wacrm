'use client';

import { useState, useCallback } from 'react';
import { formatINR } from '@/lib/currency';

interface EmiCalculatorProps {
  /** Property price in INR — pre-fills loan amount at 80% LTV. */
  propertyPrice?: number | null;
  /**
   * Lead's budget_max used as a proxy for affordability check.
   * If set, EMI is compared against 40% of (budget_max / 12).
   */
  budgetMax?: number | null;
}

/**
 * Section R7 — EMI calculator embedded in the property detail page.
 * Pure client component: all calculations are local, no network calls.
 */
export function EmiCalculator({
  propertyPrice,
  budgetMax,
}: EmiCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState(
    propertyPrice ? Math.round(propertyPrice * 0.8) : 5000000
  );
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenureYears, setTenureYears] = useState(20);

  const calculateEmi = useCallback(
    (principal: number, annualRate: number, years: number): number => {
      if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
      const r = annualRate / 100 / 12;
      const n = years * 12;
      return Math.round(
        (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      );
    },
    []
  );

  const emi = calculateEmi(loanAmount, interestRate, tenureYears);
  const totalPayable = emi * tenureYears * 12;
  const totalInterest = totalPayable - loanAmount;

  const monthlyBudgetProxy = budgetMax ? Math.round(budgetMax / 12) : null;
  const isAffordable =
    monthlyBudgetProxy && emi > 0 ? emi <= monthlyBudgetProxy * 0.4 : null;

  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">EMI Calculator</h3>

      <div className="space-y-4">
        <div>
          <label className="text-muted-foreground mb-1 block text-sm">
            Loan Amount
          </label>
          <input
            type="number"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={loanAmount}
            min={0}
            step={100000}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            aria-label="Loan amount in rupees"
          />
          {loanAmount > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatINR(loanAmount)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-sm">
              Rate (% p.a.)
            </label>
            <input
              type="number"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={interestRate}
              min={1}
              max={30}
              step={0.1}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              aria-label="Annual interest rate"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-sm">
              Tenure (Years)
            </label>
            <input
              type="number"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={tenureYears}
              min={1}
              max={30}
              step={1}
              onChange={(e) => setTenureYears(Number(e.target.value))}
              aria-label="Loan tenure in years"
            />
          </div>
        </div>
      </div>

      {emi > 0 && (
        <div className="bg-muted/50 mt-4 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Monthly EMI</span>
            <span className="text-primary text-lg font-bold">
              {formatINR(emi)}
            </span>
          </div>
          <div className="text-muted-foreground mt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total Interest</span>
              <span>{formatINR(totalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Payable</span>
              <span>{formatINR(totalPayable)}</span>
            </div>
          </div>

          {isAffordable !== null && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${
                isAffordable
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {isAffordable
                ? '✓ Fits budget — EMI is within 40% of monthly budget'
                : '⚠ May stretch budget — EMI exceeds 40% of monthly budget'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
