/**
 * Tax Planning Service
 * Provides "what-if" scenarios and tax optimization recommendations
 */

class TaxPlanningService {
  constructor() {
    // 2024 contribution limits
    this.limits = {
      traditional401k: 23000,
      traditional401kCatchUp: 7500, // Age 50+
      traditionalIRA: 7000,
      iraRetirementCatchUp: 1000, // Age 50+
      hsa: { individual: 4150, family: 8300 },
      hsaCatchUp: 1000, // Age 55+
      charitableDeductionLimit: 0.60, // 60% of AGI for cash
      saltCap: 10000
    };

    // 2024 tax brackets for single filers
    this.brackets = {
      single: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
      ],
      married_filing_jointly: [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: Infinity, rate: 0.37 }
      ]
    };
  }

  /**
   * Create a what-if scenario
   */
  createScenario(baseData, modifications, scenarioName = 'Custom Scenario') {
    // Calculate base tax
    const baseTax = this.calculateTax(baseData);

    // Apply modifications
    const modifiedData = { ...baseData, ...modifications };
    const modifiedTax = this.calculateTax(modifiedData);

    // Calculate savings
    const taxSavings = baseTax.totalTax - modifiedTax.totalTax;

    return {
      scenarioName,
      baseTax,
      modifiedTax,
      taxSavings: Math.round(taxSavings * 100) / 100,
      effectiveTaxRateChange: Math.round((baseTax.effectiveRate - modifiedTax.effectiveRate) * 10000) / 100,
      modifications,
      recommendation: this.generateRecommendation(taxSavings, modifications)
    };
  }

  /**
   * Simplified tax calculation for scenarios
   */
  calculateTax(data) {
    const {
      grossIncome = 0,
      adjustments = 0,
      deductions = 0,
      credits = 0,
      filingStatus = 'single'
    } = data;

    const agi = grossIncome - adjustments;
    const taxableIncome = Math.max(0, agi - deductions);
    const brackets = this.brackets[filingStatus] || this.brackets.single;

    let tax = 0;
    let remaining = taxableIncome;

    for (const bracket of brackets) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
    }

    const totalTax = Math.max(0, tax - credits);
    const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0;

    return {
      grossIncome: Math.round(grossIncome * 100) / 100,
      agi: Math.round(agi * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      taxBeforeCredits: Math.round(tax * 100) / 100,
      credits: Math.round(credits * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 10000) / 100
    };
  }

  /**
   * Generate retirement contribution scenarios
   */
  analyzeRetirementContributions(currentData) {
    const scenarios = [];
    const { age = 30, filingStatus = 'single' } = currentData;

    // Scenario 1: Max out 401(k)
    const max401k = age >= 50
      ? this.limits.traditional401k + this.limits.traditional401kCatchUp
      : this.limits.traditional401k;
    const current401k = currentData.retirement401k || 0;

    if (current401k < max401k) {
      const additional401k = max401k - current401k;
      scenarios.push(this.createScenario(
        currentData,
        { adjustments: (currentData.adjustments || 0) + additional401k },
        `Max 401(k) contribution (+$${additional401k.toLocaleString()})`
      ));
    }

    // Scenario 2: Add IRA contribution
    const maxIRA = age >= 50
      ? this.limits.traditionalIRA + this.limits.iraRetirementCatchUp
      : this.limits.traditionalIRA;
    const currentIRA = currentData.iraContribution || 0;

    if (currentIRA < maxIRA) {
      const additionalIRA = maxIRA - currentIRA;
      scenarios.push(this.createScenario(
        currentData,
        { adjustments: (currentData.adjustments || 0) + additionalIRA },
        `Max Traditional IRA (+$${additionalIRA.toLocaleString()})`
      ));
    }

    // Scenario 3: Both max
    if (current401k < max401k || currentIRA < maxIRA) {
      const totalAdditional = (max401k - current401k) + (maxIRA - currentIRA);
      scenarios.push(this.createScenario(
        currentData,
        { adjustments: (currentData.adjustments || 0) + totalAdditional },
        `Max all retirement contributions (+$${totalAdditional.toLocaleString()})`
      ));
    }

    return {
      currentContributions: {
        '401k': current401k,
        ira: currentIRA,
        total: current401k + currentIRA
      },
      maximumContributions: {
        '401k': max401k,
        ira: maxIRA,
        total: max401k + maxIRA
      },
      scenarios
    };
  }

  /**
   * Analyze HSA contribution scenarios
   */
  analyzeHSAContributions(currentData) {
    const { age = 30, hsaCoverage = 'individual' } = currentData;

    const maxHSA = hsaCoverage === 'family'
      ? this.limits.hsa.family
      : this.limits.hsa.individual;
    const adjustedMax = age >= 55 ? maxHSA + this.limits.hsaCatchUp : maxHSA;

    const currentHSA = currentData.hsaContribution || 0;
    const additionalHSA = Math.max(0, adjustedMax - currentHSA);

    if (additionalHSA === 0) {
      return {
        currentHSA,
        maxHSA: adjustedMax,
        scenario: null,
        message: 'HSA contributions already maximized'
      };
    }

    return {
      currentHSA,
      maxHSA: adjustedMax,
      additionalPossible: additionalHSA,
      scenario: this.createScenario(
        currentData,
        { adjustments: (currentData.adjustments || 0) + additionalHSA },
        `Max HSA contribution (+$${additionalHSA.toLocaleString()})`
      ),
      tripleTaxBenefit: 'HSA contributions are tax-deductible, grow tax-free, and withdrawals for medical expenses are tax-free'
    };
  }

  /**
   * Analyze charitable giving scenarios
   */
  analyzeCharitableGiving(currentData) {
    const scenarios = [];
    const { grossIncome = 0, currentCharitable = 0, deductions = 0 } = currentData;

    // Calculate max deductible (60% of AGI for cash)
    const agi = grossIncome - (currentData.adjustments || 0);
    const maxCharitable = agi * this.limits.charitableDeductionLimit;

    // Bunching strategy - give 2 years worth in one year
    const averageAnnualGiving = currentCharitable || 5000;
    const bunchedAmount = averageAnnualGiving * 2;

    if (bunchedAmount <= maxCharitable) {
      scenarios.push(this.createScenario(
        currentData,
        { deductions: deductions + averageAnnualGiving },
        `Charitable bunching strategy (+$${averageAnnualGiving.toLocaleString()} this year)`
      ));
    }

    // Donor-advised fund scenario
    scenarios.push({
      scenarioName: 'Donor-Advised Fund (DAF)',
      description: 'Contribute appreciated securities to DAF, get immediate deduction, grant to charities over time',
      benefits: [
        'Immediate tax deduction for full fair market value',
        'Avoid capital gains tax on appreciated assets',
        'Flexibility to grant to charities over multiple years'
      ],
      bestFor: 'Taxpayers with appreciated securities and charitable intent'
    });

    // Qualified Charitable Distribution (QCD) for those 70.5+
    if ((currentData.age || 0) >= 70.5) {
      scenarios.push({
        scenarioName: 'Qualified Charitable Distribution (QCD)',
        description: 'Donate up to $100,000 directly from IRA to charity',
        benefits: [
          'Satisfies Required Minimum Distribution (RMD)',
          'Excluded from taxable income',
          'Reduces AGI (helps with Medicare premiums, Social Security taxation)'
        ],
        maxAmount: 100000
      });
    }

    return {
      currentCharitable,
      maxDeductible: Math.round(maxCharitable * 100) / 100,
      scenarios
    };
  }

  /**
   * Analyze income timing strategies
   */
  analyzeIncomeTiming(currentData, projectedNextYear) {
    const scenarios = [];
    const currentBracket = this.findTaxBracket(currentData);
    const projectedBracket = this.findTaxBracket(projectedNextYear);

    // Defer income if next year bracket is lower
    if (projectedBracket.rate < currentBracket.rate) {
      scenarios.push({
        scenarioName: 'Defer Income to Next Year',
        description: 'Your projected tax bracket is lower next year',
        currentBracket: `${currentBracket.rate * 100}%`,
        projectedBracket: `${projectedBracket.rate * 100}%`,
        strategies: [
          'Defer bonus payments if possible',
          'Delay invoicing self-employment income',
          'Wait to exercise stock options',
          'Delay asset sales until next year'
        ],
        potentialSavingsRate: `${((currentBracket.rate - projectedBracket.rate) * 100).toFixed(1)}%`
      });
    }

    // Accelerate income if current year bracket is lower
    if (currentBracket.rate < projectedBracket.rate) {
      scenarios.push({
        scenarioName: 'Accelerate Income This Year',
        description: 'Your tax bracket is expected to increase next year',
        currentBracket: `${currentBracket.rate * 100}%`,
        projectedBracket: `${projectedBracket.rate * 100}%`,
        strategies: [
          'Request bonus payment this year',
          'Invoice and collect self-employment income before year-end',
          'Exercise stock options this year',
          'Recognize capital gains this year'
        ],
        potentialSavingsRate: `${((projectedBracket.rate - currentBracket.rate) * 100).toFixed(1)}%`
      });
    }

    // Roth conversion analysis
    const roomInBracket = currentBracket.max - (currentData.taxableIncome || currentData.grossIncome);
    if (roomInBracket > 0) {
      scenarios.push({
        scenarioName: 'Roth Conversion Opportunity',
        description: 'Convert Traditional IRA to Roth while staying in current bracket',
        roomInBracket: Math.round(roomInBracket),
        currentBracket: `${currentBracket.rate * 100}%`,
        taxCost: Math.round(roomInBracket * currentBracket.rate),
        benefits: [
          'Tax-free growth and withdrawals in retirement',
          'No Required Minimum Distributions',
          'Tax diversification in retirement'
        ]
      });
    }

    return { scenarios };
  }

  /**
   * Find current tax bracket
   */
  findTaxBracket(data) {
    const { filingStatus = 'single' } = data;
    const taxableIncome = data.taxableIncome || (data.grossIncome - (data.adjustments || 0) - (data.deductions || 0));
    const brackets = this.brackets[filingStatus] || this.brackets.single;

    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
        return bracket;
      }
    }

    return brackets[brackets.length - 1];
  }

  /**
   * Generate comprehensive tax planning report
   */
  generatePlanningReport(currentData, projectedNextYear = null) {
    const report = {
      generatedAt: new Date().toISOString(),
      currentYear: new Date().getFullYear(),
      currentSituation: this.calculateTax(currentData),
      opportunities: []
    };

    // Retirement analysis
    const retirementAnalysis = this.analyzeRetirementContributions(currentData);
    if (retirementAnalysis.scenarios.length > 0) {
      report.opportunities.push({
        category: 'Retirement Contributions',
        analysis: retirementAnalysis,
        priority: 'high'
      });
    }

    // HSA analysis
    if (currentData.hasHDHP) {
      const hsaAnalysis = this.analyzeHSAContributions(currentData);
      if (hsaAnalysis.scenario) {
        report.opportunities.push({
          category: 'Health Savings Account',
          analysis: hsaAnalysis,
          priority: 'high'
        });
      }
    }

    // Charitable giving
    const charitableAnalysis = this.analyzeCharitableGiving(currentData);
    if (charitableAnalysis.scenarios.length > 0) {
      report.opportunities.push({
        category: 'Charitable Giving',
        analysis: charitableAnalysis,
        priority: 'medium'
      });
    }

    // Income timing
    if (projectedNextYear) {
      const timingAnalysis = this.analyzeIncomeTiming(currentData, projectedNextYear);
      if (timingAnalysis.scenarios.length > 0) {
        report.opportunities.push({
          category: 'Income Timing',
          analysis: timingAnalysis,
          priority: 'medium'
        });
      }
    }

    // Calculate total potential savings
    report.totalPotentialSavings = report.opportunities
      .filter(o => o.analysis.scenarios)
      .flatMap(o => o.analysis.scenarios)
      .filter(s => s.taxSavings)
      .reduce((sum, s) => sum + (s.taxSavings || 0), 0);

    return report;
  }

  /**
   * Generate recommendation text
   */
  generateRecommendation(taxSavings, modifications) {
    if (taxSavings <= 0) {
      return 'This change would not reduce your tax liability.';
    }

    if (taxSavings < 500) {
      return 'This change provides modest tax savings. Consider if it aligns with your financial goals.';
    }

    if (taxSavings < 2000) {
      return 'This change provides meaningful tax savings. Recommended if funds are available.';
    }

    return 'This change provides significant tax savings. Strongly recommended for implementation.';
  }
}

module.exports = new TaxPlanningService();
