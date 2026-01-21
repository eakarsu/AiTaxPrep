/**
 * Amended Return Service
 * Handles Form 1040-X generation and amended return calculations
 */

class AmendedReturnService {
  constructor() {
    this.taxYear = 2024;
    // Amendment deadline is typically 3 years from filing date or 2 years from payment
    this.amendmentDeadlineYears = 3;
  }

  /**
   * Calculate amended return differences
   */
  calculateAmendment(originalReturn, amendedReturn) {
    const changes = [];
    const lineByLine = [];

    // Compare income
    const incomeChange = this.compareSection('Income', {
      'Wages, salaries, tips': { original: originalReturn.wages, amended: amendedReturn.wages },
      'Interest income': { original: originalReturn.interestIncome, amended: amendedReturn.interestIncome },
      'Dividend income': { original: originalReturn.dividendIncome, amended: amendedReturn.dividendIncome },
      'Capital gains': { original: originalReturn.capitalGains, amended: amendedReturn.capitalGains },
      'IRA/Pension income': { original: originalReturn.retirementIncome, amended: amendedReturn.retirementIncome },
      'Social Security': { original: originalReturn.socialSecurity, amended: amendedReturn.socialSecurity },
      'Business income': { original: originalReturn.businessIncome, amended: amendedReturn.businessIncome },
      'Other income': { original: originalReturn.otherIncome, amended: amendedReturn.otherIncome }
    });
    lineByLine.push(...incomeChange.lines);
    if (incomeChange.hasChanges) changes.push({ section: 'Income', ...incomeChange });

    // Total income
    const originalTotalIncome = originalReturn.totalIncome || 0;
    const amendedTotalIncome = amendedReturn.totalIncome || 0;
    lineByLine.push({
      line: 'Total Income',
      originalAmount: originalTotalIncome,
      amendedAmount: amendedTotalIncome,
      change: amendedTotalIncome - originalTotalIncome
    });

    // Compare adjustments
    const adjustmentsChange = this.compareSection('Adjustments', {
      'Educator expenses': { original: originalReturn.educatorExpenses, amended: amendedReturn.educatorExpenses },
      'HSA deduction': { original: originalReturn.hsaDeduction, amended: amendedReturn.hsaDeduction },
      'Self-employment tax deduction': { original: originalReturn.seTaxDeduction, amended: amendedReturn.seTaxDeduction },
      'IRA deduction': { original: originalReturn.iraDeduction, amended: amendedReturn.iraDeduction },
      'Student loan interest': { original: originalReturn.studentLoanInterest, amended: amendedReturn.studentLoanInterest }
    });
    lineByLine.push(...adjustmentsChange.lines);
    if (adjustmentsChange.hasChanges) changes.push({ section: 'Adjustments', ...adjustmentsChange });

    // AGI
    const originalAGI = originalReturn.agi || 0;
    const amendedAGI = amendedReturn.agi || 0;
    lineByLine.push({
      line: 'Adjusted Gross Income',
      originalAmount: originalAGI,
      amendedAmount: amendedAGI,
      change: amendedAGI - originalAGI
    });

    // Compare deductions
    const deductionsChange = this.compareSection('Deductions', {
      'Standard/Itemized deduction': { original: originalReturn.totalDeductions, amended: amendedReturn.totalDeductions },
      'Qualified business income deduction': { original: originalReturn.qbiDeduction, amended: amendedReturn.qbiDeduction }
    });
    lineByLine.push(...deductionsChange.lines);
    if (deductionsChange.hasChanges) changes.push({ section: 'Deductions', ...deductionsChange });

    // Taxable income
    const originalTaxableIncome = originalReturn.taxableIncome || 0;
    const amendedTaxableIncome = amendedReturn.taxableIncome || 0;
    lineByLine.push({
      line: 'Taxable Income',
      originalAmount: originalTaxableIncome,
      amendedAmount: amendedTaxableIncome,
      change: amendedTaxableIncome - originalTaxableIncome
    });

    // Compare tax and credits
    const taxChange = this.compareSection('Tax', {
      'Tax': { original: originalReturn.taxLiability, amended: amendedReturn.taxLiability },
      'Self-employment tax': { original: originalReturn.selfEmploymentTax, amended: amendedReturn.selfEmploymentTax },
      'Alternative minimum tax': { original: originalReturn.amt, amended: amendedReturn.amt },
      'Total tax before credits': { original: originalReturn.totalTaxBeforeCredits, amended: amendedReturn.totalTaxBeforeCredits }
    });
    lineByLine.push(...taxChange.lines);
    if (taxChange.hasChanges) changes.push({ section: 'Tax', ...taxChange });

    // Compare credits
    const creditsChange = this.compareSection('Credits', {
      'Child tax credit': { original: originalReturn.childTaxCredit, amended: amendedReturn.childTaxCredit },
      'Other credits': { original: originalReturn.otherCredits, amended: amendedReturn.otherCredits },
      'Education credits': { original: originalReturn.educationCredit, amended: amendedReturn.educationCredit }
    });
    lineByLine.push(...creditsChange.lines);
    if (creditsChange.hasChanges) changes.push({ section: 'Credits', ...creditsChange });

    // Final amounts
    const originalTotalTax = originalReturn.totalTax || 0;
    const amendedTotalTax = amendedReturn.totalTax || 0;
    const originalPayments = originalReturn.totalPayments || 0;
    const amendedPayments = amendedReturn.totalPayments || 0;

    lineByLine.push({
      line: 'Total Tax',
      originalAmount: originalTotalTax,
      amendedAmount: amendedTotalTax,
      change: amendedTotalTax - originalTotalTax
    });

    lineByLine.push({
      line: 'Total Payments',
      originalAmount: originalPayments,
      amendedAmount: amendedPayments,
      change: amendedPayments - originalPayments
    });

    // Calculate refund/owed changes
    const originalRefund = Math.max(0, originalPayments - originalTotalTax);
    const originalOwed = Math.max(0, originalTotalTax - originalPayments);
    const amendedRefund = Math.max(0, amendedPayments - amendedTotalTax);
    const amendedOwed = Math.max(0, amendedTotalTax - amendedPayments);

    // Net change
    const netChange = (amendedRefund - originalRefund) - (amendedOwed - originalOwed);

    return {
      originalReturn: {
        totalIncome: originalTotalIncome,
        agi: originalAGI,
        taxableIncome: originalTaxableIncome,
        totalTax: originalTotalTax,
        refund: originalRefund,
        owed: originalOwed
      },
      amendedReturn: {
        totalIncome: amendedTotalIncome,
        agi: amendedAGI,
        taxableIncome: amendedTaxableIncome,
        totalTax: amendedTotalTax,
        refund: amendedRefund,
        owed: amendedOwed
      },
      changes,
      lineByLine,
      summary: {
        additionalRefund: netChange > 0 ? netChange : 0,
        additionalTaxOwed: netChange < 0 ? Math.abs(netChange) : 0,
        netChange: Math.round(netChange * 100) / 100
      }
    };
  }

  /**
   * Compare two values and track the change
   */
  compareSection(sectionName, fields) {
    const lines = [];
    let totalOriginal = 0;
    let totalAmended = 0;
    let hasChanges = false;

    for (const [fieldName, values] of Object.entries(fields)) {
      const original = values.original || 0;
      const amended = values.amended || 0;
      const change = amended - original;

      if (Math.abs(change) > 0.01) {
        hasChanges = true;
      }

      lines.push({
        line: fieldName,
        originalAmount: Math.round(original * 100) / 100,
        amendedAmount: Math.round(amended * 100) / 100,
        change: Math.round(change * 100) / 100
      });

      totalOriginal += original;
      totalAmended += amended;
    }

    return {
      hasChanges,
      lines,
      totalOriginal: Math.round(totalOriginal * 100) / 100,
      totalAmended: Math.round(totalAmended * 100) / 100,
      totalChange: Math.round((totalAmended - totalOriginal) * 100) / 100
    };
  }

  /**
   * Generate Form 1040-X data
   */
  generateForm1040X(originalReturn, amendedReturn, explanation) {
    const amendment = this.calculateAmendment(originalReturn, amendedReturn);

    return {
      formNumber: '1040-X',
      formTitle: 'Amended U.S. Individual Income Tax Return',
      taxYear: originalReturn.taxYear || this.taxYear,

      // Part I - Exemptions and Dependents (if changed)
      partI: {
        exemptionsOriginal: originalReturn.exemptions || 0,
        exemptionsAmended: amendedReturn.exemptions || 0,
        dependentsChanged: originalReturn.dependents !== amendedReturn.dependents
      },

      // Part II - Presidential Election Campaign Fund (rarely changes)
      partII: {
        checkBoxOriginal: originalReturn.presidentialFund || false,
        checkBoxAmended: amendedReturn.presidentialFund || false
      },

      // Part III - Income, Deductions, Tax
      partIII: {
        // Column A (Original), B (Net Change), C (Correct Amount)
        lines: amendment.lineByLine.map(line => ({
          description: line.line,
          columnA: line.originalAmount,
          columnB: line.change,
          columnC: line.amendedAmount
        }))
      },

      // Explanation of changes
      explanation: explanation || this.generateExplanation(amendment.changes),

      // Summary
      summary: amendment.summary,

      // Signature required
      signatureRequired: true,
      signed: false,

      // Filing information
      filingInfo: {
        canEFile: false, // 1040-X must be mailed for most cases
        mailingAddress: this.getMailingAddress(originalReturn.state),
        processingTime: '16+ weeks',
        trackingUrl: 'https://www.irs.gov/filing/wheres-my-amended-return'
      }
    };
  }

  /**
   * Generate explanation of changes
   */
  generateExplanation(changes) {
    if (!changes || changes.length === 0) {
      return 'Correcting previously filed return.';
    }

    const explanations = changes.map(change => {
      const items = change.lines
        .filter(l => Math.abs(l.change) > 0)
        .map(l => `${l.line}: changed from $${l.originalAmount.toLocaleString()} to $${l.amendedAmount.toLocaleString()}`)
        .join('; ');

      return `${change.section}: ${items}`;
    });

    return explanations.join('\n\n');
  }

  /**
   * Get IRS mailing address for amended returns
   */
  getMailingAddress(state) {
    // Simplified - actual address depends on state and whether payment is included
    const addresses = {
      default: {
        withPayment: 'Internal Revenue Service\nP.O. Box 802501\nCincinnati, OH 45280-2501',
        withoutPayment: 'Department of the Treasury\nInternal Revenue Service\nAustin, TX 73301-0215'
      }
    };

    return addresses.default;
  }

  /**
   * Validate amendment eligibility
   */
  validateAmendmentEligibility(originalReturn) {
    const issues = [];
    const warnings = [];

    // Check deadline
    const originalFilingDate = new Date(originalReturn.filedDate || originalReturn.createdAt);
    const deadlineDate = new Date(originalFilingDate);
    deadlineDate.setFullYear(deadlineDate.getFullYear() + this.amendmentDeadlineYears);

    if (new Date() > deadlineDate) {
      issues.push(`Amendment deadline has passed. Original return filed ${originalFilingDate.toLocaleDateString()}, deadline was ${deadlineDate.toLocaleDateString()}`);
    }

    // Check if return was filed
    if (originalReturn.status !== 'filed' && originalReturn.status !== 'accepted') {
      issues.push('Cannot amend a return that has not been filed');
    }

    // Check for pending audit
    if (originalReturn.auditStatus === 'under_audit') {
      warnings.push('Your return is under audit. Consult with IRS before filing amendment.');
    }

    // Check for prior amendments
    if (originalReturn.amendmentCount >= 3) {
      warnings.push('Multiple amendments may trigger additional IRS scrutiny');
    }

    return {
      canAmend: issues.length === 0,
      issues,
      warnings,
      deadline: deadlineDate.toLocaleDateString()
    };
  }

  /**
   * Common reasons for filing amendments
   */
  getCommonAmendmentReasons() {
    return [
      { code: 'INCOME_OMITTED', description: 'Income not reported on original return' },
      { code: 'INCOME_OVERSTATED', description: 'Income was overstated on original return' },
      { code: 'DEDUCTION_MISSED', description: 'Deduction not claimed on original return' },
      { code: 'CREDIT_MISSED', description: 'Tax credit not claimed on original return' },
      { code: 'FILING_STATUS', description: 'Incorrect filing status on original return' },
      { code: 'DEPENDENT_ERROR', description: 'Dependent information incorrect' },
      { code: 'MATH_ERROR', description: 'Calculation error on original return' },
      { code: 'FORM_MISSING', description: 'Required form or schedule not included' },
      { code: 'IRS_NOTICE', description: 'Responding to IRS notice' },
      { code: 'OTHER', description: 'Other correction' }
    ];
  }

  /**
   * Calculate interest on additional tax owed
   */
  calculateInterestAndPenalties(additionalTaxOwed, originalDueDate) {
    if (additionalTaxOwed <= 0) {
      return { interest: 0, penalty: 0, total: 0 };
    }

    const dueDate = new Date(originalDueDate);
    const today = new Date();
    const daysLate = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));

    // IRS interest rate (approximately 7% annually, compounded daily)
    const annualRate = 0.07;
    const dailyRate = annualRate / 365;
    const interest = additionalTaxOwed * (Math.pow(1 + dailyRate, daysLate) - 1);

    // Failure to pay penalty (0.5% per month, max 25%)
    const monthsLate = Math.floor(daysLate / 30);
    const penaltyRate = Math.min(monthsLate * 0.005, 0.25);
    const penalty = additionalTaxOwed * penaltyRate;

    return {
      interest: Math.round(interest * 100) / 100,
      penalty: Math.round(penalty * 100) / 100,
      total: Math.round((additionalTaxOwed + interest + penalty) * 100) / 100,
      daysLate,
      note: daysLate > 0 ? 'Interest and penalties apply to late payments' : 'No late payment charges'
    };
  }
}

module.exports = new AmendedReturnService();
