/**
 * Validation Service
 * Comprehensive tax data validation with IRS rules enforcement
 */

class ValidationService {
  constructor() {
    // 2024 limits and thresholds
    this.limits = {
      // SALT cap (State and Local Tax deduction)
      saltCap: 10000,
      saltCapMFS: 5000, // Married filing separately

      // Standard deductions
      standardDeductions: {
        single: 14600,
        married_filing_jointly: 29200,
        married_filing_separately: 14600,
        head_of_household: 21900,
        qualifying_widow: 29200
      },

      // Contribution limits
      ira: { under50: 7000, over50: 8000 },
      hsa: { individual: 4150, family: 8300, catchUp: 1000 },
      '401k': { under50: 23000, over50: 30500 },

      // Credit phase-outs
      childTaxCredit: {
        amount: 2000,
        refundableMax: 1700,
        phaseOutStart: { single: 200000, married_filing_jointly: 400000 },
        phaseOutRate: 0.05 // $50 per $1000 over threshold
      },

      eitc: {
        maxCredits: {
          0: 632,   // No children
          1: 4213,  // 1 child
          2: 6960,  // 2 children
          3: 7830   // 3+ children
        },
        incomeLimit: {
          single: { 0: 18591, 1: 49084, 2: 55768, 3: 59899 },
          married_filing_jointly: { 0: 25511, 1: 56004, 2: 62688, 3: 66819 }
        }
      },

      // Income thresholds
      socialSecurityTaxable: {
        base: 25000, // Single
        married: 32000
      },

      // Self-employment
      selfEmploymentTaxRate: 0.153,
      socialSecurityWageBase: 168600,

      // Estimated tax safe harbor
      estimatedTaxSafeHarbor: 0.90, // 90% of current year or 100% of prior year

      // Filing thresholds
      filingThresholds: {
        single: { under65: 14600, over65: 16550 },
        married_filing_jointly: { bothUnder65: 29200, oneOver65: 30750, bothOver65: 32300 },
        married_filing_separately: { any: 5 },
        head_of_household: { under65: 21900, over65: 23850 },
        qualifying_widow: { under65: 29200, over65: 30750 }
      }
    };
  }

  /**
   * Validate complete tax return
   */
  validateTaxReturn(taxReturn) {
    const errors = [];
    const warnings = [];
    const suggestions = [];

    // Personal information validation
    const personalValidation = this.validatePersonalInfo(taxReturn);
    errors.push(...personalValidation.errors);
    warnings.push(...personalValidation.warnings);

    // Income validation
    const incomeValidation = this.validateIncome(taxReturn);
    errors.push(...incomeValidation.errors);
    warnings.push(...incomeValidation.warnings);
    suggestions.push(...incomeValidation.suggestions);

    // Deduction validation
    const deductionValidation = this.validateDeductions(taxReturn);
    errors.push(...deductionValidation.errors);
    warnings.push(...deductionValidation.warnings);
    suggestions.push(...deductionValidation.suggestions);

    // Credit validation
    const creditValidation = this.validateCredits(taxReturn);
    errors.push(...creditValidation.errors);
    warnings.push(...creditValidation.warnings);
    suggestions.push(...creditValidation.suggestions);

    // Math validation
    const mathValidation = this.validateMath(taxReturn);
    errors.push(...mathValidation.errors);

    // Filing requirement validation
    const filingValidation = this.validateFilingRequirement(taxReturn);
    warnings.push(...filingValidation.warnings);
    suggestions.push(...filingValidation.suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
        suggestionCount: suggestions.length
      }
    };
  }

  /**
   * Validate personal information
   */
  validatePersonalInfo(taxReturn) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!taxReturn.firstName || !taxReturn.lastName) {
      errors.push({ field: 'name', message: 'First and last name are required' });
    }

    if (!taxReturn.ssn) {
      errors.push({ field: 'ssn', message: 'Social Security Number is required' });
    } else if (!/^\d{3}-?\d{2}-?\d{4}$/.test(taxReturn.ssn.replace(/\D/g, ''))) {
      errors.push({ field: 'ssn', message: 'Invalid Social Security Number format' });
    }

    if (!taxReturn.filingStatus) {
      errors.push({ field: 'filingStatus', message: 'Filing status is required' });
    }

    // Spouse validation for joint filers
    if (taxReturn.filingStatus === 'married_filing_jointly') {
      if (!taxReturn.spouseSSN) {
        warnings.push({ field: 'spouseSSN', message: 'Spouse SSN recommended for joint filing' });
      }
    }

    // Head of Household validation
    if (taxReturn.filingStatus === 'head_of_household') {
      if (!taxReturn.dependents || taxReturn.dependents === 0) {
        warnings.push({
          field: 'filingStatus',
          message: 'Head of Household typically requires a qualifying dependent'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate income entries
   */
  validateIncome(taxReturn) {
    const errors = [];
    const warnings = [];
    const suggestions = [];

    // Negative income validation
    if ((taxReturn.wages || 0) < 0) {
      errors.push({ field: 'wages', message: 'Wages cannot be negative' });
    }

    // W-2 consistency check
    if (taxReturn.wages > 0 && !taxReturn.federalWithheld) {
      warnings.push({
        field: 'federalWithheld',
        message: 'You reported wages but no federal withholding. Please verify.'
      });
    }

    // Self-employment validation
    if (taxReturn.selfEmploymentIncome > 0) {
      if (!taxReturn.selfEmploymentTax || taxReturn.selfEmploymentTax === 0) {
        warnings.push({
          field: 'selfEmploymentTax',
          message: 'Self-employment income requires self-employment tax calculation'
        });
      }

      // Check if estimated taxes were paid
      if (taxReturn.selfEmploymentIncome > 5000 && !taxReturn.estimatedPayments) {
        suggestions.push({
          field: 'estimatedPayments',
          message: 'Self-employed individuals typically need to make quarterly estimated tax payments'
        });
      }
    }

    // Capital gains validation
    if (taxReturn.capitalGains !== 0 && taxReturn.capitalGains !== undefined) {
      if (!taxReturn.hasScheduleD) {
        warnings.push({
          field: 'capitalGains',
          message: 'Capital gains/losses require Schedule D'
        });
      }
    }

    // Social Security taxation
    if (taxReturn.socialSecurityBenefits > 0) {
      const agi = taxReturn.agi || 0;
      const threshold = taxReturn.filingStatus === 'married_filing_jointly'
        ? this.limits.socialSecurityTaxable.married
        : this.limits.socialSecurityTaxable.base;

      const provisionalIncome = agi + (taxReturn.socialSecurityBenefits * 0.5);
      if (provisionalIncome > threshold && !taxReturn.taxableSocialSecurity) {
        warnings.push({
          field: 'socialSecurityBenefits',
          message: 'Some Social Security benefits may be taxable based on your income'
        });
      }
    }

    // Large income warning
    if ((taxReturn.totalIncome || 0) > 200000) {
      suggestions.push({
        field: 'income',
        message: 'High income may trigger AMT or NIIT. Consider reviewing these calculations.'
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate deductions with limits enforcement
   */
  validateDeductions(taxReturn) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    const filingStatus = taxReturn.filingStatus || 'single';

    // SALT cap enforcement
    const saltDeduction = (taxReturn.stateLocalTaxDeduction || 0) +
                         (taxReturn.propertyTaxDeduction || 0);
    const saltCap = filingStatus === 'married_filing_separately'
      ? this.limits.saltCapMFS
      : this.limits.saltCap;

    if (saltDeduction > saltCap) {
      warnings.push({
        field: 'saltDeduction',
        message: `State and local tax deduction capped at $${saltCap.toLocaleString()}. You entered $${saltDeduction.toLocaleString()}.`,
        correction: saltCap
      });
    }

    // Standard vs itemized comparison
    const standardDeduction = this.limits.standardDeductions[filingStatus] || this.limits.standardDeductions.single;
    const itemizedDeductions = taxReturn.totalItemizedDeductions || 0;

    if (itemizedDeductions > 0 && itemizedDeductions < standardDeduction) {
      suggestions.push({
        field: 'deductions',
        message: `Your itemized deductions ($${itemizedDeductions.toLocaleString()}) are less than the standard deduction ($${standardDeduction.toLocaleString()}). Consider using the standard deduction.`
      });
    }

    // Mortgage interest validation
    if (taxReturn.mortgageInterest > 0) {
      // Check if it seems reasonable (rough validation)
      if (taxReturn.mortgageInterest > 50000) {
        warnings.push({
          field: 'mortgageInterest',
          message: 'Mortgage interest deduction is unusually high. Please verify Form 1098.'
        });
      }
    }

    // Charitable contributions limits
    const charitableContributions = taxReturn.charitableContributions || 0;
    const agi = taxReturn.agi || 0;
    const charitableLimit = agi * 0.60; // 60% of AGI for cash contributions

    if (charitableContributions > charitableLimit) {
      warnings.push({
        field: 'charitableContributions',
        message: `Charitable contributions may be limited to 60% of AGI ($${Math.round(charitableLimit).toLocaleString()}). Excess can be carried forward.`
      });
    }

    // Medical expense threshold
    if (taxReturn.medicalExpenses > 0) {
      const medicalThreshold = agi * 0.075;
      if (taxReturn.medicalExpenses < medicalThreshold) {
        warnings.push({
          field: 'medicalExpenses',
          message: `Medical expenses only deductible above 7.5% of AGI ($${Math.round(medicalThreshold).toLocaleString()}). Your expenses may not qualify.`
        });
      }
    }

    // IRA contribution limits
    if (taxReturn.iraContribution > 0) {
      const age = taxReturn.age || 30;
      const iraLimit = age >= 50 ? this.limits.ira.over50 : this.limits.ira.under50;

      if (taxReturn.iraContribution > iraLimit) {
        errors.push({
          field: 'iraContribution',
          message: `IRA contribution ($${taxReturn.iraContribution.toLocaleString()}) exceeds limit ($${iraLimit.toLocaleString()})`,
          correction: iraLimit
        });
      }
    }

    // HSA contribution limits
    if (taxReturn.hsaContribution > 0) {
      const hsaCoverage = taxReturn.hsaCoverageType || 'individual';
      const age = taxReturn.age || 30;
      let hsaLimit = hsaCoverage === 'family' ? this.limits.hsa.family : this.limits.hsa.individual;
      if (age >= 55) hsaLimit += this.limits.hsa.catchUp;

      if (taxReturn.hsaContribution > hsaLimit) {
        errors.push({
          field: 'hsaContribution',
          message: `HSA contribution ($${taxReturn.hsaContribution.toLocaleString()}) exceeds limit ($${hsaLimit.toLocaleString()})`,
          correction: hsaLimit
        });
      }
    }

    // Student loan interest limit
    if (taxReturn.studentLoanInterest > 2500) {
      warnings.push({
        field: 'studentLoanInterest',
        message: 'Student loan interest deduction limited to $2,500',
        correction: 2500
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate tax credits with phase-out calculations
   */
  validateCredits(taxReturn) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    const filingStatus = taxReturn.filingStatus || 'single';
    const agi = taxReturn.agi || 0;

    // Child Tax Credit phase-out
    if (taxReturn.childTaxCredit > 0) {
      const phaseOutStart = this.limits.childTaxCredit.phaseOutStart[filingStatus] ||
                           this.limits.childTaxCredit.phaseOutStart.single;

      if (agi > phaseOutStart) {
        const excessIncome = agi - phaseOutStart;
        const reduction = Math.floor(excessIncome / 1000) * 50;
        const maxCredit = (taxReturn.qualifyingChildren || 0) * this.limits.childTaxCredit.amount;
        const reducedCredit = Math.max(0, maxCredit - reduction);

        if (taxReturn.childTaxCredit > reducedCredit) {
          warnings.push({
            field: 'childTaxCredit',
            message: `Child Tax Credit reduced due to income phase-out. Maximum credit: $${reducedCredit.toLocaleString()}`,
            correction: reducedCredit
          });
        }
      }
    }

    // EITC validation
    if (taxReturn.eitc > 0) {
      const numChildren = taxReturn.qualifyingChildrenEITC || 0;
      const incomeLimit = this.limits.eitc.incomeLimit[filingStatus]?.[Math.min(numChildren, 3)] ||
                         this.limits.eitc.incomeLimit.single[Math.min(numChildren, 3)];
      const maxCredit = this.limits.eitc.maxCredits[Math.min(numChildren, 3)];

      if (agi > incomeLimit) {
        errors.push({
          field: 'eitc',
          message: `Income exceeds EITC limit ($${incomeLimit.toLocaleString()}) for ${numChildren} qualifying children`
        });
      }

      if (taxReturn.eitc > maxCredit) {
        errors.push({
          field: 'eitc',
          message: `EITC exceeds maximum ($${maxCredit.toLocaleString()}) for ${numChildren} qualifying children`,
          correction: maxCredit
        });
      }

      // Investment income limit for EITC
      if ((taxReturn.investmentIncome || 0) > 11600) {
        errors.push({
          field: 'eitc',
          message: 'Investment income exceeds $11,600 limit for EITC eligibility'
        });
      }
    }

    // Education credits validation
    if (taxReturn.educationCredits > 0) {
      // American Opportunity Credit: $2,500 max per student
      // Lifetime Learning Credit: $2,000 max per return
      if (taxReturn.americanOpportunityCredit > 2500) {
        errors.push({
          field: 'americanOpportunityCredit',
          message: 'American Opportunity Credit limited to $2,500 per student',
          correction: 2500
        });
      }

      if (taxReturn.lifetimeLearningCredit > 2000) {
        errors.push({
          field: 'lifetimeLearningCredit',
          message: 'Lifetime Learning Credit limited to $2,000 per return',
          correction: 2000
        });
      }
    }

    // Credits cannot exceed tax liability (for non-refundable credits)
    const nonRefundableCredits = (taxReturn.nonRefundableCredits || 0);
    const taxLiability = taxReturn.taxLiability || 0;

    if (nonRefundableCredits > taxLiability) {
      warnings.push({
        field: 'credits',
        message: 'Non-refundable credits limited to tax liability. Some credits may be lost.'
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate math calculations
   */
  validateMath(taxReturn) {
    const errors = [];
    const tolerance = 1; // Allow $1 rounding difference

    // Total income calculation
    const calculatedTotalIncome = (taxReturn.wages || 0) +
                                  (taxReturn.interestIncome || 0) +
                                  (taxReturn.dividendIncome || 0) +
                                  (taxReturn.capitalGains || 0) +
                                  (taxReturn.businessIncome || 0) +
                                  (taxReturn.otherIncome || 0);

    if (taxReturn.totalIncome && Math.abs(taxReturn.totalIncome - calculatedTotalIncome) > tolerance) {
      errors.push({
        field: 'totalIncome',
        message: `Total income ($${taxReturn.totalIncome}) doesn't match sum of income sources ($${calculatedTotalIncome})`
      });
    }

    // AGI calculation
    const calculatedAGI = (taxReturn.totalIncome || 0) - (taxReturn.adjustments || 0);
    if (taxReturn.agi && Math.abs(taxReturn.agi - calculatedAGI) > tolerance) {
      errors.push({
        field: 'agi',
        message: `AGI ($${taxReturn.agi}) doesn't match (Total Income - Adjustments) ($${calculatedAGI})`
      });
    }

    // Taxable income calculation
    const calculatedTaxableIncome = Math.max(0, (taxReturn.agi || 0) - (taxReturn.deductions || 0));
    if (taxReturn.taxableIncome && Math.abs(taxReturn.taxableIncome - calculatedTaxableIncome) > tolerance) {
      errors.push({
        field: 'taxableIncome',
        message: `Taxable income ($${taxReturn.taxableIncome}) doesn't match (AGI - Deductions) ($${calculatedTaxableIncome})`
      });
    }

    // Refund/owed calculation
    const calculatedRefundOwed = (taxReturn.totalPayments || 0) - (taxReturn.totalTax || 0);
    const reportedNet = (taxReturn.refund || 0) - (taxReturn.amountOwed || 0);

    if (Math.abs(calculatedRefundOwed - reportedNet) > tolerance) {
      errors.push({
        field: 'refundOwed',
        message: 'Refund/amount owed calculation error. Please verify payments and total tax.'
      });
    }

    return { errors };
  }

  /**
   * Validate filing requirement
   */
  validateFilingRequirement(taxReturn) {
    const warnings = [];
    const suggestions = [];
    const filingStatus = taxReturn.filingStatus || 'single';
    const age = taxReturn.age || 30;
    const grossIncome = taxReturn.totalIncome || 0;

    // Get filing threshold
    let threshold;
    const thresholds = this.limits.filingThresholds[filingStatus];

    if (thresholds) {
      if (filingStatus === 'married_filing_jointly') {
        if (age >= 65 && (taxReturn.spouseAge || 30) >= 65) {
          threshold = thresholds.bothOver65;
        } else if (age >= 65 || (taxReturn.spouseAge || 30) >= 65) {
          threshold = thresholds.oneOver65;
        } else {
          threshold = thresholds.bothUnder65;
        }
      } else if (filingStatus === 'married_filing_separately') {
        threshold = thresholds.any;
      } else {
        threshold = age >= 65 ? thresholds.over65 : thresholds.under65;
      }
    }

    // Check if filing is required
    if (threshold && grossIncome < threshold) {
      suggestions.push({
        field: 'filingRequirement',
        message: `Based on your income ($${grossIncome.toLocaleString()}) and filing status, you may not be required to file. Filing threshold: $${threshold.toLocaleString()}.`
      });
    }

    // Self-employment filing requirement ($400 net earnings)
    if ((taxReturn.selfEmploymentIncome || 0) >= 400 && grossIncome < (threshold || 0)) {
      warnings.push({
        field: 'filingRequirement',
        message: 'You must file a return if self-employment net earnings are $400 or more, regardless of other income.'
      });
    }

    return { warnings, suggestions };
  }

  /**
   * Quick validation for specific field
   */
  validateField(fieldName, value, context = {}) {
    const errors = [];

    switch (fieldName) {
      case 'ssn':
        if (!/^\d{9}$/.test((value || '').replace(/\D/g, ''))) {
          errors.push('Invalid SSN format');
        }
        break;

      case 'ein':
        if (value && !/^\d{9}$/.test((value || '').replace(/\D/g, ''))) {
          errors.push('Invalid EIN format');
        }
        break;

      case 'wages':
      case 'income':
        if (value < 0) errors.push('Amount cannot be negative');
        break;

      case 'deduction':
        if (value < 0) errors.push('Deduction cannot be negative');
        break;

      case 'iraContribution':
        const iraLimit = (context.age || 30) >= 50 ? this.limits.ira.over50 : this.limits.ira.under50;
        if (value > iraLimit) errors.push(`Exceeds limit of $${iraLimit.toLocaleString()}`);
        break;

      case 'hsaContribution':
        const hsaLimit = (context.coverage === 'family' ? this.limits.hsa.family : this.limits.hsa.individual) +
                        ((context.age || 30) >= 55 ? this.limits.hsa.catchUp : 0);
        if (value > hsaLimit) errors.push(`Exceeds limit of $${hsaLimit.toLocaleString()}`);
        break;
    }

    return { isValid: errors.length === 0, errors };
  }
}

module.exports = new ValidationService();
