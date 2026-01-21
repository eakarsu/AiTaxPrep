/**
 * Depreciation Service
 * Handles MACRS depreciation, Section 179, and bonus depreciation calculations
 */

class DepreciationService {
  constructor() {
    // MACRS recovery periods by asset class
    this.recoveryPeriods = {
      '3-year': ['tractor_units', 'race_horses', 'qualified_rent_to_own'],
      '5-year': ['automobiles', 'computers', 'office_equipment', 'research_equipment', 'appliances', 'carpets', 'furniture_rental'],
      '7-year': ['office_furniture', 'agricultural_machinery', 'railroad_track', 'motorsports_facilities'],
      '10-year': ['vessels', 'barges', 'tugs', 'fruit_trees', 'single_purpose_agricultural'],
      '15-year': ['land_improvements', 'retail_improvements', 'restaurant_property', 'gas_stations'],
      '20-year': ['farm_buildings', 'municipal_sewers'],
      '27.5-year': ['residential_rental'],
      '39-year': ['nonresidential_real_property']
    };

    // MACRS Half-Year Convention Tables (200% Declining Balance)
    this.macrsRates = {
      3: [0.3333, 0.4445, 0.1481, 0.0741],
      5: [0.2000, 0.3200, 0.1920, 0.1152, 0.1152, 0.0576],
      7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
      10: [0.1000, 0.1800, 0.1440, 0.1152, 0.0922, 0.0737, 0.0655, 0.0655, 0.0656, 0.0655, 0.0328],
      15: [0.0500, 0.0950, 0.0855, 0.0770, 0.0693, 0.0623, 0.0590, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0295],
      20: [0.0375, 0.0722, 0.0668, 0.0618, 0.0571, 0.0528, 0.0489, 0.0452, 0.0447, 0.0447, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0446, 0.0223]
    };

    // Straight-line rates for real property
    this.straightLineRates = {
      27.5: 0.03636, // Residential rental (1/27.5)
      39: 0.02564    // Nonresidential real property (1/39)
    };

    // 2024 Section 179 limits
    this.section179 = {
      maxDeduction: 1220000,
      phaseOutThreshold: 3050000,
      vehicleLimit: 28900,
      suvLimit: 30500
    };

    // 2024 Bonus depreciation rate
    this.bonusDepreciationRate = 0.60; // 60% for 2024
  }

  /**
   * Calculate depreciation for an asset
   */
  calculateDepreciation(asset) {
    const {
      costBasis,
      salvageValue = 0,
      datePlacedInService,
      assetType,
      recoveryPeriod,
      method = 'MACRS',
      section179Elected = false,
      section179Amount = 0,
      bonusDepreciationElected = false,
      yearInService = 1,
      isVehicle = false,
      businessUsePercent = 100
    } = asset;

    // Adjust basis for business use percentage
    const adjustedBasis = costBasis * (businessUsePercent / 100);
    let depreciableBasis = adjustedBasis;
    let totalFirstYearDeduction = 0;

    // Section 179 deduction
    let section179Deduction = 0;
    if (section179Elected && section179Amount > 0) {
      section179Deduction = Math.min(section179Amount, this.section179.maxDeduction);
      if (isVehicle) {
        section179Deduction = Math.min(section179Deduction, this.section179.vehicleLimit);
      }
      depreciableBasis -= section179Deduction;
      totalFirstYearDeduction += section179Deduction;
    }

    // Bonus depreciation
    let bonusDepreciation = 0;
    if (bonusDepreciationElected && depreciableBasis > 0) {
      bonusDepreciation = depreciableBasis * this.bonusDepreciationRate;
      depreciableBasis -= bonusDepreciation;
      totalFirstYearDeduction += bonusDepreciation;
    }

    // Regular depreciation
    let regularDepreciation = 0;
    if (depreciableBasis > 0) {
      if (method === 'MACRS') {
        regularDepreciation = this.calculateMACRS(depreciableBasis, recoveryPeriod, yearInService);
      } else if (method === 'straight-line') {
        regularDepreciation = this.calculateStraightLine(depreciableBasis, salvageValue, recoveryPeriod, yearInService);
      } else if (method === 'units-of-production') {
        regularDepreciation = this.calculateUnitsOfProduction(
          depreciableBasis,
          salvageValue,
          asset.totalUnits,
          asset.unitsThisYear
        );
      }
    }

    const currentYearDepreciation = yearInService === 1
      ? totalFirstYearDeduction + regularDepreciation
      : regularDepreciation;

    return {
      costBasis,
      businessUsePercent,
      adjustedBasis: Math.round(adjustedBasis * 100) / 100,
      section179Deduction: Math.round(section179Deduction * 100) / 100,
      bonusDepreciation: Math.round(bonusDepreciation * 100) / 100,
      regularDepreciation: Math.round(regularDepreciation * 100) / 100,
      currentYearDepreciation: Math.round(currentYearDepreciation * 100) / 100,
      method,
      recoveryPeriod,
      yearInService,
      schedule: this.generateDepreciationSchedule(asset)
    };
  }

  /**
   * Calculate MACRS depreciation
   */
  calculateMACRS(basis, recoveryPeriod, yearInService) {
    const rates = this.macrsRates[recoveryPeriod];
    if (!rates || yearInService > rates.length) {
      return 0;
    }
    return basis * rates[yearInService - 1];
  }

  /**
   * Calculate straight-line depreciation
   */
  calculateStraightLine(basis, salvageValue, usefulLife, yearInService) {
    const depreciableAmount = basis - salvageValue;
    const annualDepreciation = depreciableAmount / usefulLife;

    // Half-year convention for first and last year
    if (yearInService === 1 || yearInService === usefulLife) {
      return annualDepreciation / 2;
    }
    return annualDepreciation;
  }

  /**
   * Calculate units of production depreciation
   */
  calculateUnitsOfProduction(basis, salvageValue, totalUnits, unitsThisYear) {
    if (totalUnits === 0) return 0;
    const depreciableAmount = basis - salvageValue;
    const depreciationPerUnit = depreciableAmount / totalUnits;
    return depreciationPerUnit * unitsThisYear;
  }

  /**
   * Generate complete depreciation schedule
   */
  generateDepreciationSchedule(asset) {
    const schedule = [];
    const { costBasis, recoveryPeriod, method, section179Amount = 0, bonusDepreciationElected = false } = asset;

    let depreciableBasis = costBasis - section179Amount;
    if (bonusDepreciationElected) {
      depreciableBasis -= depreciableBasis * this.bonusDepreciationRate;
    }

    let accumulatedDepreciation = section179Amount + (bonusDepreciationElected ? costBasis * this.bonusDepreciationRate : 0);
    const rates = this.macrsRates[recoveryPeriod] || [];

    for (let year = 1; year <= rates.length; year++) {
      const depreciation = depreciableBasis * rates[year - 1];
      accumulatedDepreciation += depreciation;
      const bookValue = costBasis - accumulatedDepreciation;

      schedule.push({
        year,
        beginningBookValue: Math.round((costBasis - accumulatedDepreciation + depreciation) * 100) / 100,
        depreciation: Math.round(depreciation * 100) / 100,
        accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
        endingBookValue: Math.round(bookValue * 100) / 100
      });
    }

    // Add first year special deductions
    if (section179Amount > 0 || bonusDepreciationElected) {
      schedule[0].section179 = section179Amount;
      schedule[0].bonusDepreciation = bonusDepreciationElected ? Math.round(costBasis * this.bonusDepreciationRate * 100) / 100 : 0;
      schedule[0].totalFirstYear = Math.round((
        section179Amount +
        (bonusDepreciationElected ? costBasis * this.bonusDepreciationRate : 0) +
        schedule[0].depreciation
      ) * 100) / 100;
    }

    return schedule;
  }

  /**
   * Get recommended recovery period for asset type
   */
  getRecoveryPeriod(assetType) {
    for (const [period, types] of Object.entries(this.recoveryPeriods)) {
      if (types.includes(assetType.toLowerCase())) {
        return parseInt(period);
      }
    }
    return 7; // Default to 7-year property
  }

  /**
   * Calculate mid-quarter convention requirement
   */
  checkMidQuarterConvention(assets) {
    // If more than 40% of depreciable basis placed in service in Q4, must use mid-quarter
    const totalBasis = assets.reduce((sum, a) => sum + a.costBasis, 0);
    const q4Basis = assets
      .filter(a => {
        const month = new Date(a.datePlacedInService).getMonth();
        return month >= 9; // October, November, December
      })
      .reduce((sum, a) => sum + a.costBasis, 0);

    const q4Percentage = totalBasis > 0 ? q4Basis / totalBasis : 0;
    return {
      requiresMidQuarter: q4Percentage > 0.4,
      q4Percentage: Math.round(q4Percentage * 100),
      note: q4Percentage > 0.4
        ? 'More than 40% of assets placed in service in Q4. Mid-quarter convention required.'
        : 'Half-year convention applies.'
    };
  }

  /**
   * Calculate total depreciation for all assets
   */
  calculateTotalDepreciation(assets, taxYear) {
    let totalDepreciation = 0;
    let totalSection179 = 0;
    let totalBonus = 0;
    const details = [];

    for (const asset of assets) {
      const result = this.calculateDepreciation({
        ...asset,
        yearInService: this.calculateYearInService(asset.datePlacedInService, taxYear)
      });

      totalDepreciation += result.currentYearDepreciation;
      totalSection179 += result.section179Deduction;
      totalBonus += result.bonusDepreciation;

      details.push({
        assetName: asset.assetName,
        ...result
      });
    }

    return {
      totalDepreciation: Math.round(totalDepreciation * 100) / 100,
      totalSection179: Math.round(totalSection179 * 100) / 100,
      totalBonus: Math.round(totalBonus * 100) / 100,
      assetCount: assets.length,
      details
    };
  }

  /**
   * Calculate year in service for an asset
   */
  calculateYearInService(datePlacedInService, taxYear) {
    const placedYear = new Date(datePlacedInService).getFullYear();
    return taxYear - placedYear + 1;
  }

  /**
   * Validate Section 179 election
   */
  validateSection179(assets, businessIncome) {
    const totalSection179 = assets.reduce((sum, a) => sum + (a.section179Amount || 0), 0);
    const totalCost = assets.reduce((sum, a) => sum + a.costBasis, 0);

    const issues = [];

    // Check maximum deduction limit
    if (totalSection179 > this.section179.maxDeduction) {
      issues.push(`Section 179 exceeds maximum of $${this.section179.maxDeduction.toLocaleString()}`);
    }

    // Check phase-out threshold
    if (totalCost > this.section179.phaseOutThreshold) {
      const reduction = totalCost - this.section179.phaseOutThreshold;
      issues.push(`Section 179 reduced by $${reduction.toLocaleString()} due to investment exceeding threshold`);
    }

    // Check business income limitation
    if (totalSection179 > businessIncome) {
      issues.push(`Section 179 limited to business income of $${businessIncome.toLocaleString()}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      allowedSection179: Math.min(
        totalSection179,
        this.section179.maxDeduction,
        businessIncome
      )
    };
  }
}

module.exports = new DepreciationService();
