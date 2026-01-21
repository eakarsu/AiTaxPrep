/**
 * State Return Service
 * Generates state tax returns and calculates state-specific taxes
 */

class StateReturnService {
  constructor() {
    // State-specific form names
    this.stateForms = {
      'AL': { form: 'Form 40', name: 'Alabama Individual Income Tax Return' },
      'AK': { form: 'N/A', name: 'No State Income Tax' },
      'AZ': { form: 'Form 140', name: 'Arizona Resident Personal Income Tax Return' },
      'AR': { form: 'AR1000F', name: 'Arkansas Full Year Resident Individual Income Tax Return' },
      'CA': { form: 'Form 540', name: 'California Resident Income Tax Return' },
      'CO': { form: 'Form 104', name: 'Colorado Individual Income Tax Return' },
      'CT': { form: 'Form CT-1040', name: 'Connecticut Resident Income Tax Return' },
      'DE': { form: 'Form 200-01', name: 'Delaware Resident Individual Income Tax Return' },
      'FL': { form: 'N/A', name: 'No State Income Tax' },
      'GA': { form: 'Form 500', name: 'Georgia Individual Income Tax Return' },
      'HI': { form: 'Form N-11', name: 'Hawaii Individual Income Tax Return - Resident' },
      'ID': { form: 'Form 40', name: 'Idaho Individual Income Tax Return' },
      'IL': { form: 'Form IL-1040', name: 'Illinois Individual Income Tax Return' },
      'IN': { form: 'Form IT-40', name: 'Indiana Full-Year Resident Individual Income Tax Return' },
      'IA': { form: 'Form IA 1040', name: 'Iowa Individual Income Tax Return' },
      'KS': { form: 'Form K-40', name: 'Kansas Individual Income Tax Return' },
      'KY': { form: 'Form 740', name: 'Kentucky Individual Income Tax Return' },
      'LA': { form: 'Form IT-540', name: 'Louisiana Resident Income Tax Return' },
      'ME': { form: 'Form 1040ME', name: 'Maine Individual Income Tax Return' },
      'MD': { form: 'Form 502', name: 'Maryland Resident Income Tax Return' },
      'MA': { form: 'Form 1', name: 'Massachusetts Resident Income Tax Return' },
      'MI': { form: 'Form MI-1040', name: 'Michigan Individual Income Tax Return' },
      'MN': { form: 'Form M1', name: 'Minnesota Individual Income Tax Return' },
      'MS': { form: 'Form 80-105', name: 'Mississippi Resident Individual Income Tax Return' },
      'MO': { form: 'Form MO-1040', name: 'Missouri Individual Income Tax Return' },
      'MT': { form: 'Form 2', name: 'Montana Individual Income Tax Return' },
      'NE': { form: 'Form 1040N', name: 'Nebraska Individual Income Tax Return' },
      'NV': { form: 'N/A', name: 'No State Income Tax' },
      'NH': { form: 'Form DP-10', name: 'New Hampshire Interest and Dividends Tax Return' },
      'NJ': { form: 'Form NJ-1040', name: 'New Jersey Resident Income Tax Return' },
      'NM': { form: 'Form PIT-1', name: 'New Mexico Personal Income Tax Return' },
      'NY': { form: 'Form IT-201', name: 'New York State Resident Income Tax Return' },
      'NC': { form: 'Form D-400', name: 'North Carolina Individual Income Tax Return' },
      'ND': { form: 'Form ND-1', name: 'North Dakota Individual Income Tax Return' },
      'OH': { form: 'Form IT 1040', name: 'Ohio Individual Income Tax Return' },
      'OK': { form: 'Form 511', name: 'Oklahoma Resident Individual Income Tax Return' },
      'OR': { form: 'Form OR-40', name: 'Oregon Individual Income Tax Return' },
      'PA': { form: 'Form PA-40', name: 'Pennsylvania Personal Income Tax Return' },
      'RI': { form: 'Form RI-1040', name: 'Rhode Island Resident Individual Income Tax Return' },
      'SC': { form: 'Form SC1040', name: 'South Carolina Individual Income Tax Return' },
      'SD': { form: 'N/A', name: 'No State Income Tax' },
      'TN': { form: 'N/A', name: 'No State Income Tax (Hall Tax repealed)' },
      'TX': { form: 'N/A', name: 'No State Income Tax' },
      'UT': { form: 'Form TC-40', name: 'Utah Individual Income Tax Return' },
      'VT': { form: 'Form IN-111', name: 'Vermont Income Tax Return' },
      'VA': { form: 'Form 760', name: 'Virginia Resident Individual Income Tax Return' },
      'WA': { form: 'N/A', name: 'No State Income Tax' },
      'WV': { form: 'Form IT-140', name: 'West Virginia Personal Income Tax Return' },
      'WI': { form: 'Form 1', name: 'Wisconsin Income Tax Return' },
      'WY': { form: 'N/A', name: 'No State Income Tax' },
      'DC': { form: 'Form D-40', name: 'District of Columbia Individual Income Tax Return' }
    };

    // States with no income tax
    this.noIncomeTaxStates = ['AK', 'FL', 'NV', 'SD', 'TX', 'WA', 'WY', 'TN', 'NH'];

    // NH only taxes interest/dividends (being phased out)
  }

  /**
   * Generate state tax return
   */
  generateStateReturn(stateCode, federalReturn, stateData = {}) {
    const upperState = stateCode.toUpperCase();

    if (this.noIncomeTaxStates.includes(upperState)) {
      return {
        stateCode: upperState,
        hasIncomeTax: false,
        message: `${upperState} does not have a state income tax`,
        stateTax: 0,
        stateRefund: 0,
        stateOwed: 0
      };
    }

    const stateReturn = {
      stateCode: upperState,
      stateName: this.getStateName(upperState),
      formInfo: this.stateForms[upperState],
      hasIncomeTax: true,
      taxYear: federalReturn.taxYear || 2024,
      filingStatus: this.mapFilingStatus(federalReturn.filingStatus, upperState),

      // Income section
      federalAGI: federalReturn.agi || 0,
      stateAdditions: this.calculateStateAdditions(upperState, federalReturn, stateData),
      stateSubtractions: this.calculateStateSubtractions(upperState, federalReturn, stateData),
      stateAGI: 0, // Calculated below

      // Deductions
      stateStandardDeduction: this.getStateStandardDeduction(upperState, federalReturn.filingStatus),
      stateItemizedDeductions: this.calculateStateItemizedDeductions(upperState, federalReturn),

      // Tax calculation
      stateTaxableIncome: 0,
      stateTax: 0,
      stateCredits: 0,
      stateWithheld: stateData.stateWithheld || federalReturn.stateWithheld || 0,

      // Result
      stateRefund: 0,
      stateOwed: 0,

      // Form data
      formData: {}
    };

    // Calculate state AGI
    stateReturn.stateAGI = stateReturn.federalAGI +
                          stateReturn.stateAdditions -
                          stateReturn.stateSubtractions;

    // Determine deduction type
    const useItemized = stateReturn.stateItemizedDeductions > stateReturn.stateStandardDeduction;
    stateReturn.deductionType = useItemized ? 'itemized' : 'standard';
    stateReturn.deductionAmount = useItemized ?
                                  stateReturn.stateItemizedDeductions :
                                  stateReturn.stateStandardDeduction;

    // Calculate taxable income
    stateReturn.stateTaxableIncome = Math.max(0, stateReturn.stateAGI - stateReturn.deductionAmount);

    // Calculate state tax
    stateReturn.stateTax = this.calculateStateTax(upperState, stateReturn.stateTaxableIncome, federalReturn.filingStatus);

    // Apply credits
    stateReturn.stateCredits = this.calculateStateCredits(upperState, federalReturn, stateData);
    stateReturn.stateTaxAfterCredits = Math.max(0, stateReturn.stateTax - stateReturn.stateCredits);

    // Calculate refund or amount owed
    const netStateTax = stateReturn.stateTaxAfterCredits - stateReturn.stateWithheld;
    if (netStateTax < 0) {
      stateReturn.stateRefund = Math.abs(netStateTax);
      stateReturn.stateOwed = 0;
    } else {
      stateReturn.stateRefund = 0;
      stateReturn.stateOwed = netStateTax;
    }

    // Generate form-specific data
    stateReturn.formData = this.generateStateFormData(upperState, stateReturn);

    return stateReturn;
  }

  /**
   * Calculate state-specific additions to federal AGI
   */
  calculateStateAdditions(stateCode, federalReturn, stateData) {
    let additions = 0;

    // Common additions that most states require
    // Interest from other states' municipal bonds
    additions += stateData.outOfStateMuniBondInterest || 0;

    // State-specific additions
    switch (stateCode) {
      case 'CA':
        // California additions
        additions += stateData.healthSavingsAccountDeduction || 0; // CA doesn't allow HSA deduction
        break;
      case 'NY':
        // New York additions
        additions += stateData.publicEmployeePension || 0;
        break;
      case 'NJ':
        // New Jersey additions
        additions += stateData.healthSavingsAccountDeduction || 0;
        break;
      // Add more states as needed
    }

    return Math.round(additions * 100) / 100;
  }

  /**
   * Calculate state-specific subtractions from federal AGI
   */
  calculateStateSubtractions(stateCode, federalReturn, stateData) {
    let subtractions = 0;

    // Common subtractions
    // In-state municipal bond interest
    subtractions += stateData.inStateMuniBondInterest || 0;

    // State-specific subtractions
    switch (stateCode) {
      case 'CA':
        // California subtractions
        subtractions += Math.min(stateData.socialSecurityBenefits || 0, federalReturn.socialSecurityBenefits || 0);
        break;
      case 'NY':
        // New York - pension exclusion up to $20,000
        subtractions += Math.min(stateData.pensionIncome || 0, 20000);
        break;
      case 'PA':
        // Pennsylvania - retirement income exclusion
        subtractions += stateData.retirementIncome || 0;
        break;
      // Add more states as needed
    }

    return Math.round(subtractions * 100) / 100;
  }

  /**
   * Get state standard deduction
   */
  getStateStandardDeduction(stateCode, filingStatus) {
    // 2024 state standard deductions (simplified)
    const deductions = {
      'CA': { single: 5363, married_filing_jointly: 10726, head_of_household: 10726 },
      'NY': { single: 8000, married_filing_jointly: 16050, head_of_household: 11200 },
      'TX': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // No income tax
      'FL': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // No income tax
      'IL': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Flat tax, no std ded
      'PA': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Flat tax
      'OH': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Uses federal AGI
      'GA': { single: 5400, married_filing_jointly: 7100, head_of_household: 5400 },
      'NC': { single: 12750, married_filing_jointly: 25500, head_of_household: 19125 },
      'NJ': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Uses exemptions instead
      'VA': { single: 8000, married_filing_jointly: 16000, head_of_household: 8000 },
      'WA': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // No income tax
      'MA': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Flat tax
      'AZ': { single: 13850, married_filing_jointly: 27700, head_of_household: 20800 },
      'CO': { single: 0, married_filing_jointly: 0, head_of_household: 0 }, // Uses federal
      // Default for states not listed
      'DEFAULT': { single: 5000, married_filing_jointly: 10000, head_of_household: 7500 }
    };

    const stateDeductions = deductions[stateCode] || deductions['DEFAULT'];
    const status = filingStatus?.toLowerCase().replace(/\s+/g, '_') || 'single';

    return stateDeductions[status] || stateDeductions.single || 0;
  }

  /**
   * Calculate state itemized deductions
   */
  calculateStateItemizedDeductions(stateCode, federalReturn) {
    // Most states start with federal itemized deductions with adjustments
    let stateItemized = federalReturn.itemizedDeductions || 0;

    // State-specific adjustments
    switch (stateCode) {
      case 'CA':
        // California limits mortgage interest and doesn't allow state tax deduction
        stateItemized -= federalReturn.stateLocalTaxDeduction || 0;
        break;
      case 'NY':
        // New York doesn't allow state/local tax deduction
        stateItemized -= federalReturn.stateLocalTaxDeduction || 0;
        break;
      case 'NJ':
        // New Jersey has its own itemized deduction rules
        stateItemized = (federalReturn.medicalDeductions || 0) +
                       (federalReturn.mortgageInterest || 0) +
                       (federalReturn.charitableContributions || 0);
        break;
      // Most states follow federal
    }

    return Math.round(Math.max(0, stateItemized) * 100) / 100;
  }

  /**
   * Calculate state tax using state brackets
   */
  calculateStateTax(stateCode, taxableIncome, filingStatus) {
    // Import from existing stateTaxService or use simplified brackets
    const stateBrackets = this.getStateBrackets(stateCode, filingStatus);

    if (!stateBrackets || stateBrackets.length === 0) {
      return 0;
    }

    let tax = 0;
    let remainingIncome = taxableIncome;

    for (let i = 0; i < stateBrackets.length; i++) {
      const bracket = stateBrackets[i];
      const bracketMin = bracket.min || 0;
      const bracketMax = bracket.max || Infinity;
      const rate = bracket.rate;

      if (remainingIncome <= 0) break;

      const bracketWidth = bracketMax - bracketMin;
      const taxableInBracket = Math.min(remainingIncome, bracketWidth);

      tax += taxableInBracket * rate;
      remainingIncome -= taxableInBracket;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Get state tax brackets
   */
  getStateBrackets(stateCode, filingStatus) {
    // 2024 state tax brackets (simplified for common states)
    const brackets = {
      'CA': [
        { min: 0, max: 10412, rate: 0.01 },
        { min: 10412, max: 24684, rate: 0.02 },
        { min: 24684, max: 38959, rate: 0.04 },
        { min: 38959, max: 54081, rate: 0.06 },
        { min: 54081, max: 68350, rate: 0.08 },
        { min: 68350, max: 349137, rate: 0.093 },
        { min: 349137, max: 418961, rate: 0.103 },
        { min: 418961, max: 698271, rate: 0.113 },
        { min: 698271, max: Infinity, rate: 0.123 }
      ],
      'NY': [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8500, max: 11700, rate: 0.045 },
        { min: 11700, max: 13900, rate: 0.0525 },
        { min: 13900, max: 80650, rate: 0.0585 },
        { min: 80650, max: 215400, rate: 0.0625 },
        { min: 215400, max: 1077550, rate: 0.0685 },
        { min: 1077550, max: 5000000, rate: 0.0965 },
        { min: 5000000, max: 25000000, rate: 0.103 },
        { min: 25000000, max: Infinity, rate: 0.109 }
      ],
      'IL': [{ min: 0, max: Infinity, rate: 0.0495 }], // Flat tax
      'PA': [{ min: 0, max: Infinity, rate: 0.0307 }], // Flat tax
      'MA': [{ min: 0, max: Infinity, rate: 0.05 }], // Flat tax
      'NC': [{ min: 0, max: Infinity, rate: 0.0525 }], // Flat tax
      'GA': [
        { min: 0, max: 750, rate: 0.01 },
        { min: 750, max: 2250, rate: 0.02 },
        { min: 2250, max: 3750, rate: 0.03 },
        { min: 3750, max: 5250, rate: 0.04 },
        { min: 5250, max: 7000, rate: 0.05 },
        { min: 7000, max: Infinity, rate: 0.055 }
      ],
      'VA': [
        { min: 0, max: 3000, rate: 0.02 },
        { min: 3000, max: 5000, rate: 0.03 },
        { min: 5000, max: 17000, rate: 0.05 },
        { min: 17000, max: Infinity, rate: 0.0575 }
      ],
      'NJ': [
        { min: 0, max: 20000, rate: 0.014 },
        { min: 20000, max: 35000, rate: 0.0175 },
        { min: 35000, max: 40000, rate: 0.035 },
        { min: 40000, max: 75000, rate: 0.05525 },
        { min: 75000, max: 500000, rate: 0.0637 },
        { min: 500000, max: 1000000, rate: 0.0897 },
        { min: 1000000, max: Infinity, rate: 0.1075 }
      ]
    };

    return brackets[stateCode] || [{ min: 0, max: Infinity, rate: 0.05 }]; // Default 5%
  }

  /**
   * Calculate state-specific credits
   */
  calculateStateCredits(stateCode, federalReturn, stateData) {
    let credits = 0;

    // Common state credits
    // Child tax credit (some states have their own)
    // Earned income credit (some states have their own)

    switch (stateCode) {
      case 'CA':
        // California Earned Income Tax Credit
        if (federalReturn.earnedIncome && federalReturn.earnedIncome < 30950) {
          credits += Math.min(federalReturn.eitc * 0.85, 3529);
        }
        break;
      case 'NY':
        // New York State Earned Income Credit (30% of federal)
        credits += (federalReturn.eitc || 0) * 0.30;
        // NY Child Credit
        credits += (stateData.qualifyingChildren || 0) * 330;
        break;
      case 'NJ':
        // NJ Earned Income Credit
        credits += (federalReturn.eitc || 0) * 0.40;
        break;
      // Add more states
    }

    return Math.round(credits * 100) / 100;
  }

  /**
   * Map federal filing status to state-specific status
   */
  mapFilingStatus(federalStatus, stateCode) {
    // Most states use same filing statuses
    // Some states have different rules
    return federalStatus;
  }

  /**
   * Get state name from code
   */
  getStateName(stateCode) {
    const stateNames = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
      'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
      'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
      'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
      'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
      'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
      'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
      'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
      'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
      'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
      'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
    };
    return stateNames[stateCode] || stateCode;
  }

  /**
   * Generate state-specific form data
   */
  generateStateFormData(stateCode, stateReturn) {
    const formInfo = this.stateForms[stateCode];

    return {
      formNumber: formInfo?.form || 'State Form',
      formTitle: formInfo?.name || 'State Income Tax Return',
      stateCode,
      stateName: stateReturn.stateName,
      taxYear: stateReturn.taxYear,
      sections: {
        income: {
          federalAGI: stateReturn.federalAGI,
          additions: stateReturn.stateAdditions,
          subtractions: stateReturn.stateSubtractions,
          stateAGI: stateReturn.stateAGI
        },
        deductions: {
          type: stateReturn.deductionType,
          amount: stateReturn.deductionAmount
        },
        tax: {
          taxableIncome: stateReturn.stateTaxableIncome,
          stateTax: stateReturn.stateTax,
          credits: stateReturn.stateCredits,
          taxAfterCredits: stateReturn.stateTaxAfterCredits
        },
        payments: {
          withheld: stateReturn.stateWithheld
        },
        result: {
          refund: stateReturn.stateRefund,
          owed: stateReturn.stateOwed
        }
      }
    };
  }

  /**
   * Get list of states requiring return based on income
   */
  getRequiredStateReturns(incomeByState) {
    const requiredStates = [];

    for (const [state, income] of Object.entries(incomeByState)) {
      if (this.noIncomeTaxStates.includes(state)) continue;

      // Most states require filing if income exceeds filing threshold
      const threshold = this.getStateFilingThreshold(state);
      if (income >= threshold) {
        requiredStates.push({
          state,
          income,
          formInfo: this.stateForms[state]
        });
      }
    }

    return requiredStates;
  }

  /**
   * Get state filing threshold
   */
  getStateFilingThreshold(stateCode) {
    // Simplified thresholds - actual varies by age, filing status, etc.
    const thresholds = {
      'CA': 20913,
      'NY': 4000,
      'IL': 2625,
      'PA': 33,
      'NJ': 10000,
      'DEFAULT': 5000
    };

    return thresholds[stateCode] || thresholds['DEFAULT'];
  }
}

module.exports = new StateReturnService();
