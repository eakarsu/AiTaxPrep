/**
 * Alternative Minimum Tax (AMT) and Net Investment Income Tax (NIIT) Service
 * Handles Form 6251 calculations
 */

class AMTService {
  constructor() {
    // 2024 AMT exemption amounts
    this.exemptions = {
      single: 85700,
      married_filing_jointly: 133300,
      married_filing_separately: 66650,
      head_of_household: 85700,
      qualifying_widow: 133300
    };

    // Phase-out thresholds
    this.phaseOutThresholds = {
      single: 609350,
      married_filing_jointly: 1218700,
      married_filing_separately: 609350,
      head_of_household: 609350,
      qualifying_widow: 1218700
    };

    // AMT tax rates
    this.amtRates = [
      { threshold: 232600, rate: 0.26 }, // Up to this amount
      { threshold: Infinity, rate: 0.28 } // Above this amount
    ];

    // NIIT threshold (3.8% on investment income for high earners)
    this.niitThresholds = {
      single: 200000,
      married_filing_jointly: 250000,
      married_filing_separately: 125000,
      head_of_household: 200000,
      qualifying_widow: 250000
    };
  }

  /**
   * Calculate Alternative Minimum Tax
   */
  calculateAMT(taxData) {
    const {
      filingStatus,
      regularTaxableIncome,
      regularTax,
      stateLocalTaxDeduction = 0,
      miscItemizedDeductions = 0,
      privatActivityBondInterest = 0,
      exercisedISOs = 0,
      depreciationAdjustment = 0,
      netOperatingLossDeduction = 0
    } = taxData;

    // Step 1: Calculate AMT Income (AMTI)
    let amtIncome = regularTaxableIncome;

    // Add back preference items and adjustments
    amtIncome += stateLocalTaxDeduction; // SALT deduction not allowed for AMT
    amtIncome += miscItemizedDeductions; // 2% misc deductions not allowed
    amtIncome += privatActivityBondInterest; // Tax-exempt interest from private activity bonds
    amtIncome += exercisedISOs; // ISO bargain element
    amtIncome += depreciationAdjustment; // Depreciation preference

    // Step 2: Calculate exemption with phase-out
    const exemption = this.calculateExemption(filingStatus, amtIncome);

    // Step 3: Calculate AMT taxable income
    const amtTaxableIncome = Math.max(0, amtIncome - exemption);

    // Step 4: Calculate tentative minimum tax
    const tentativeMinimumTax = this.calculateTentativeMinimumTax(amtTaxableIncome, filingStatus);

    // Step 5: AMT is excess of tentative minimum tax over regular tax
    const amt = Math.max(0, tentativeMinimumTax - regularTax);

    return {
      amtIncome: Math.round(amtIncome * 100) / 100,
      exemption: Math.round(exemption * 100) / 100,
      amtTaxableIncome: Math.round(amtTaxableIncome * 100) / 100,
      tentativeMinimumTax: Math.round(tentativeMinimumTax * 100) / 100,
      regularTax: Math.round(regularTax * 100) / 100,
      amt: Math.round(amt * 100) / 100,
      totalTax: Math.round((regularTax + amt) * 100) / 100,
      isSubjectToAMT: amt > 0,
      adjustments: {
        stateLocalTaxAddBack: stateLocalTaxDeduction,
        miscDeductionsAddBack: miscItemizedDeductions,
        privatActivityBondInterest,
        isoAdjustment: exercisedISOs,
        depreciationAdjustment
      }
    };
  }

  /**
   * Calculate AMT exemption with phase-out
   */
  calculateExemption(filingStatus, amtIncome) {
    const baseExemption = this.exemptions[filingStatus] || this.exemptions.single;
    const phaseOutStart = this.phaseOutThresholds[filingStatus] || this.phaseOutThresholds.single;

    if (amtIncome <= phaseOutStart) {
      return baseExemption;
    }

    // Exemption reduced by 25% of amount over threshold
    const excessIncome = amtIncome - phaseOutStart;
    const exemptionReduction = excessIncome * 0.25;

    return Math.max(0, baseExemption - exemptionReduction);
  }

  /**
   * Calculate tentative minimum tax
   */
  calculateTentativeMinimumTax(amtTaxableIncome, filingStatus) {
    // For married filing separately, the 26% bracket threshold is half
    const bracketThreshold = filingStatus === 'married_filing_separately' ? 116300 : 232600;

    if (amtTaxableIncome <= bracketThreshold) {
      return amtTaxableIncome * 0.26;
    }

    return (bracketThreshold * 0.26) + ((amtTaxableIncome - bracketThreshold) * 0.28);
  }

  /**
   * Calculate Net Investment Income Tax (NIIT)
   * 3.8% tax on lesser of net investment income or excess MAGI over threshold
   */
  calculateNIIT(taxData) {
    const {
      filingStatus,
      modifiedAGI,
      netInvestmentIncome = 0 // Interest, dividends, capital gains, rental income, passive income
    } = taxData;

    const threshold = this.niitThresholds[filingStatus] || this.niitThresholds.single;

    if (modifiedAGI <= threshold) {
      return {
        isSubjectToNIIT: false,
        threshold,
        excessMAGI: 0,
        netInvestmentIncome,
        taxableAmount: 0,
        niitTax: 0
      };
    }

    const excessMAGI = modifiedAGI - threshold;
    const taxableAmount = Math.min(netInvestmentIncome, excessMAGI);
    const niitTax = taxableAmount * 0.038;

    return {
      isSubjectToNIIT: niitTax > 0,
      threshold,
      excessMAGI: Math.round(excessMAGI * 100) / 100,
      netInvestmentIncome: Math.round(netInvestmentIncome * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      niitTax: Math.round(niitTax * 100) / 100
    };
  }

  /**
   * Calculate both AMT and NIIT
   */
  calculateAdditionalTaxes(taxData) {
    const amtResult = this.calculateAMT(taxData);
    const niitResult = this.calculateNIIT(taxData);

    return {
      amt: amtResult,
      niit: niitResult,
      totalAdditionalTax: amtResult.amt + niitResult.niitTax,
      summary: {
        regularTax: amtResult.regularTax,
        alternativeMinimumTax: amtResult.amt,
        netInvestmentIncomeTax: niitResult.niitTax,
        totalFederalTax: amtResult.regularTax + amtResult.amt + niitResult.niitTax
      }
    };
  }

  /**
   * Check if taxpayer is likely subject to AMT
   */
  assessAMTRisk(taxData) {
    const indicators = [];
    let riskScore = 0;

    // High income
    if (taxData.regularTaxableIncome > 200000) {
      indicators.push('High income increases AMT risk');
      riskScore += 20;
    }

    // Large SALT deduction
    if (taxData.stateLocalTaxDeduction > 10000) {
      indicators.push('State/local tax deduction above $10,000 (add-back for AMT)');
      riskScore += 30;
    }

    // Exercised ISOs
    if (taxData.exercisedISOs > 0) {
      indicators.push('Exercised incentive stock options');
      riskScore += 40;
    }

    // Private activity bonds
    if (taxData.privatActivityBondInterest > 0) {
      indicators.push('Private activity bond interest');
      riskScore += 15;
    }

    // Many dependents (personal exemptions used to be an adjustment)
    if (taxData.dependents > 3) {
      indicators.push('Multiple dependents');
      riskScore += 10;
    }

    return {
      riskLevel: riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
      riskScore: Math.min(100, riskScore),
      indicators,
      recommendation: riskScore >= 50
        ? 'You should calculate AMT to determine if additional tax is owed.'
        : riskScore >= 25
        ? 'Consider reviewing AMT calculations as a precaution.'
        : 'AMT is unlikely to apply to your situation.'
    };
  }
}

module.exports = new AMTService();
