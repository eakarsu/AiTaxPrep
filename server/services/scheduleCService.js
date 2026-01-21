/**
 * Schedule C (Profit or Loss from Business) Service
 * Handles self-employment business income calculations
 */

class ScheduleCService {
  constructor() {
    // Standard expense categories for Schedule C
    this.expenseCategories = {
      advertising: { line: 8, description: 'Advertising' },
      car_truck: { line: 9, description: 'Car and truck expenses' },
      commissions: { line: 10, description: 'Commissions and fees' },
      contract_labor: { line: 11, description: 'Contract labor' },
      depletion: { line: 12, description: 'Depletion' },
      depreciation: { line: 13, description: 'Depreciation and section 179' },
      employee_benefits: { line: 14, description: 'Employee benefit programs' },
      insurance: { line: 15, description: 'Insurance (other than health)' },
      interest_mortgage: { line: '16a', description: 'Interest - Mortgage' },
      interest_other: { line: '16b', description: 'Interest - Other' },
      legal_professional: { line: 17, description: 'Legal and professional services' },
      office_expense: { line: 18, description: 'Office expense' },
      pension_profit_sharing: { line: 19, description: 'Pension and profit-sharing plans' },
      rent_vehicles: { line: '20a', description: 'Rent - Vehicles, machinery, equipment' },
      rent_other: { line: '20b', description: 'Rent - Other business property' },
      repairs: { line: 21, description: 'Repairs and maintenance' },
      supplies: { line: 22, description: 'Supplies' },
      taxes_licenses: { line: 23, description: 'Taxes and licenses' },
      travel: { line: '24a', description: 'Travel' },
      meals: { line: '24b', description: 'Deductible meals (50%)' },
      utilities: { line: 25, description: 'Utilities' },
      wages: { line: 26, description: 'Wages' },
      other: { line: '27a', description: 'Other expenses' }
    };

    // 2024 Self-employment tax rate
    this.selfEmploymentTaxRate = 0.153; // 15.3%
    this.selfEmploymentNetRate = 0.9235; // 92.35% of net earnings subject to SE tax
    this.selfEmploymentDeductionRate = 0.5; // 50% deductible

    // Standard mileage rate for 2024
    this.standardMileageRate = 0.67; // 67 cents per mile
  }

  /**
   * Calculate Schedule C
   */
  calculateScheduleC(businessData) {
    const {
      grossReceipts = 0,
      returnsAllowances = 0,
      costOfGoodsSold = 0,
      otherIncome = 0,
      expenses = []
    } = businessData;

    // Part I: Income
    const grossIncome = grossReceipts - returnsAllowances;
    const grossProfit = grossIncome - costOfGoodsSold;
    const totalIncome = grossProfit + otherIncome;

    // Part II: Expenses
    const expensesByCategory = this.categorizeExpenses(expenses);
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.amount, 0);

    // Calculate net profit or loss
    const tentativeProfit = totalIncome - totalExpenses;

    // Home office deduction (simplified method: $5 per sq ft, max 300 sq ft)
    const homeOfficeDeduction = businessData.homeOfficeSquareFeet
      ? Math.min(businessData.homeOfficeSquareFeet * 5, 1500)
      : 0;

    const netProfitLoss = tentativeProfit - homeOfficeDeduction;

    // Self-employment tax calculation
    const seTaxCalculation = this.calculateSelfEmploymentTax(netProfitLoss);

    return {
      partI: {
        grossReceipts,
        returnsAllowances,
        grossIncome: Math.round(grossIncome * 100) / 100,
        costOfGoodsSold,
        grossProfit: Math.round(grossProfit * 100) / 100,
        otherIncome,
        totalIncome: Math.round(totalIncome * 100) / 100
      },
      partII: {
        expensesByCategory,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        homeOfficeDeduction
      },
      netProfitLoss: Math.round(netProfitLoss * 100) / 100,
      isProfit: netProfitLoss > 0,
      selfEmploymentTax: seTaxCalculation,
      form: this.generateFormData(businessData, {
        grossIncome,
        grossProfit,
        totalIncome,
        totalExpenses,
        netProfitLoss
      })
    };
  }

  /**
   * Categorize expenses by Schedule C line items
   */
  categorizeExpenses(expenses) {
    const categorized = {};

    // Initialize all categories
    Object.keys(this.expenseCategories).forEach(cat => {
      categorized[cat] = {
        ...this.expenseCategories[cat],
        amount: 0,
        items: []
      };
    });

    // Sort expenses into categories
    expenses.forEach(expense => {
      const category = expense.category?.toLowerCase().replace(/\s+/g, '_') || 'other';
      if (categorized[category]) {
        categorized[category].amount += expense.amount || 0;
        categorized[category].items.push(expense);
      } else {
        categorized.other.amount += expense.amount || 0;
        categorized.other.items.push(expense);
      }
    });

    // Apply 50% limitation on meals
    if (categorized.meals.amount > 0) {
      categorized.meals.amount = categorized.meals.amount * 0.5;
      categorized.meals.note = '50% limitation applied';
    }

    return categorized;
  }

  /**
   * Calculate self-employment tax
   */
  calculateSelfEmploymentTax(netProfitLoss) {
    if (netProfitLoss <= 0) {
      return {
        netEarnings: 0,
        selfEmploymentTax: 0,
        deductiblePortion: 0,
        socialSecurityTax: 0,
        medicareTax: 0
      };
    }

    // Net earnings from self-employment (92.35% of net profit)
    const netEarnings = netProfitLoss * this.selfEmploymentNetRate;

    // Social Security wage base for 2024
    const socialSecurityWageBase = 168600;

    // Social Security tax (12.4% up to wage base)
    const socialSecurityEarnings = Math.min(netEarnings, socialSecurityWageBase);
    const socialSecurityTax = socialSecurityEarnings * 0.124;

    // Medicare tax (2.9% on all earnings)
    const medicareTax = netEarnings * 0.029;

    // Additional Medicare tax for high earners (0.9% over $200k single, $250k married)
    const additionalMedicareTax = netEarnings > 200000 ? (netEarnings - 200000) * 0.009 : 0;

    const totalSETax = socialSecurityTax + medicareTax + additionalMedicareTax;

    // Deductible portion (50% of SE tax)
    const deductiblePortion = totalSETax * this.selfEmploymentDeductionRate;

    return {
      netEarnings: Math.round(netEarnings * 100) / 100,
      selfEmploymentTax: Math.round(totalSETax * 100) / 100,
      deductiblePortion: Math.round(deductiblePortion * 100) / 100,
      socialSecurityTax: Math.round(socialSecurityTax * 100) / 100,
      medicareTax: Math.round(medicareTax * 100) / 100,
      additionalMedicareTax: Math.round(additionalMedicareTax * 100) / 100
    };
  }

  /**
   * Calculate vehicle expenses
   */
  calculateVehicleExpenses(vehicleData) {
    const { method, businessMiles = 0, totalMiles = 0, actualExpenses = 0 } = vehicleData;

    if (method === 'standard') {
      const deduction = businessMiles * this.standardMileageRate;
      return {
        method: 'Standard Mileage',
        businessMiles,
        rate: this.standardMileageRate,
        deduction: Math.round(deduction * 100) / 100,
        note: `${businessMiles} miles × $${this.standardMileageRate}/mile`
      };
    } else {
      // Actual expense method
      const businessPercentage = totalMiles > 0 ? businessMiles / totalMiles : 0;
      const deduction = actualExpenses * businessPercentage;
      return {
        method: 'Actual Expense',
        totalExpenses: actualExpenses,
        businessPercentage: Math.round(businessPercentage * 100),
        deduction: Math.round(deduction * 100) / 100,
        note: `${Math.round(businessPercentage * 100)}% business use`
      };
    }
  }

  /**
   * Calculate Cost of Goods Sold (for inventory-based businesses)
   */
  calculateCOGS(inventoryData) {
    const {
      beginningInventory = 0,
      purchases = 0,
      laborCosts = 0,
      materials = 0,
      otherCosts = 0,
      endingInventory = 0
    } = inventoryData;

    const goodsAvailable = beginningInventory + purchases + laborCosts + materials + otherCosts;
    const cogs = goodsAvailable - endingInventory;

    return {
      beginningInventory,
      purchases,
      laborCosts,
      materials,
      otherCosts,
      goodsAvailable: Math.round(goodsAvailable * 100) / 100,
      endingInventory,
      costOfGoodsSold: Math.round(cogs * 100) / 100
    };
  }

  /**
   * Generate form data structure
   */
  generateFormData(businessData, calculations) {
    return {
      formNumber: 'Schedule C',
      formTitle: 'Profit or Loss From Business',
      partA: {
        businessName: businessData.businessName || '',
        businessAddress: businessData.businessAddress || '',
        ein: businessData.ein || '',
        accountingMethod: businessData.accountingMethod || 'Cash',
        businessCode: businessData.businessCode || ''
      },
      partI: calculations,
      partII: this.categorizeExpenses(businessData.expenses || []),
      signature: {
        required: true,
        signed: false
      }
    };
  }

  /**
   * Validate Schedule C data
   */
  validate(businessData) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!businessData.businessName) {
      warnings.push('Business name is recommended');
    }

    // Validate income
    if (businessData.grossReceipts < 0) {
      errors.push('Gross receipts cannot be negative');
    }

    // Check for unusually high expense ratios
    if (businessData.grossReceipts > 0) {
      const totalExpenses = (businessData.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const expenseRatio = totalExpenses / businessData.grossReceipts;

      if (expenseRatio > 0.9) {
        warnings.push('Expense ratio is very high (>90%), this may trigger IRS review');
      }
    }

    // Validate home office
    if (businessData.homeOfficeSquareFeet > 300) {
      warnings.push('Home office exceeds 300 sq ft limit for simplified method');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

module.exports = new ScheduleCService();
