// State Tax Service - 2024 State Income Tax Rates
// Note: Tax laws change frequently. This is for educational purposes.

const STATE_TAX_DATA = {
  'AL': { name: 'Alabama', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 500, rate: 0.02 },
    { min: 500, max: 3000, rate: 0.04 },
    { min: 3000, max: Infinity, rate: 0.05 }
  ]},
  'AK': { name: 'Alaska', hasIncomeTax: false },
  'AZ': { name: 'Arizona', hasIncomeTax: true, isFlat: true, flatRate: 0.025 },
  'AR': { name: 'Arkansas', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 4300, rate: 0.02 },
    { min: 4300, max: 8500, rate: 0.04 },
    { min: 8500, max: Infinity, rate: 0.044 }
  ]},
  'CA': { name: 'California', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 10099, rate: 0.01 },
    { min: 10099, max: 23942, rate: 0.02 },
    { min: 23942, max: 37788, rate: 0.04 },
    { min: 37788, max: 52455, rate: 0.06 },
    { min: 52455, max: 66295, rate: 0.08 },
    { min: 66295, max: 338639, rate: 0.093 },
    { min: 338639, max: 406364, rate: 0.103 },
    { min: 406364, max: 677275, rate: 0.113 },
    { min: 677275, max: Infinity, rate: 0.123 }
  ]},
  'CO': { name: 'Colorado', hasIncomeTax: true, isFlat: true, flatRate: 0.044 },
  'CT': { name: 'Connecticut', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 10000, rate: 0.03 },
    { min: 10000, max: 50000, rate: 0.05 },
    { min: 50000, max: 100000, rate: 0.055 },
    { min: 100000, max: 200000, rate: 0.06 },
    { min: 200000, max: 250000, rate: 0.065 },
    { min: 250000, max: 500000, rate: 0.069 },
    { min: 500000, max: Infinity, rate: 0.0699 }
  ]},
  'DE': { name: 'Delaware', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 2000, rate: 0 },
    { min: 2000, max: 5000, rate: 0.022 },
    { min: 5000, max: 10000, rate: 0.039 },
    { min: 10000, max: 20000, rate: 0.048 },
    { min: 20000, max: 25000, rate: 0.052 },
    { min: 25000, max: 60000, rate: 0.0555 },
    { min: 60000, max: Infinity, rate: 0.066 }
  ]},
  'FL': { name: 'Florida', hasIncomeTax: false },
  'GA': { name: 'Georgia', hasIncomeTax: true, isFlat: true, flatRate: 0.0549 },
  'HI': { name: 'Hawaii', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 2400, rate: 0.014 },
    { min: 2400, max: 4800, rate: 0.032 },
    { min: 4800, max: 9600, rate: 0.055 },
    { min: 9600, max: 14400, rate: 0.064 },
    { min: 14400, max: 19200, rate: 0.068 },
    { min: 19200, max: 24000, rate: 0.072 },
    { min: 24000, max: 36000, rate: 0.076 },
    { min: 36000, max: 48000, rate: 0.079 },
    { min: 48000, max: 150000, rate: 0.0825 },
    { min: 150000, max: 175000, rate: 0.09 },
    { min: 175000, max: 200000, rate: 0.10 },
    { min: 200000, max: Infinity, rate: 0.11 }
  ]},
  'ID': { name: 'Idaho', hasIncomeTax: true, isFlat: true, flatRate: 0.058 },
  'IL': { name: 'Illinois', hasIncomeTax: true, isFlat: true, flatRate: 0.0495 },
  'IN': { name: 'Indiana', hasIncomeTax: true, isFlat: true, flatRate: 0.0315 },
  'IA': { name: 'Iowa', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 6000, rate: 0.044 },
    { min: 6000, max: 30000, rate: 0.0482 },
    { min: 30000, max: 75000, rate: 0.057 },
    { min: 75000, max: Infinity, rate: 0.06 }
  ]},
  'KS': { name: 'Kansas', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 15000, rate: 0.031 },
    { min: 15000, max: 30000, rate: 0.0525 },
    { min: 30000, max: Infinity, rate: 0.057 }
  ]},
  'KY': { name: 'Kentucky', hasIncomeTax: true, isFlat: true, flatRate: 0.04 },
  'LA': { name: 'Louisiana', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 12500, rate: 0.0185 },
    { min: 12500, max: 50000, rate: 0.035 },
    { min: 50000, max: Infinity, rate: 0.0425 }
  ]},
  'ME': { name: 'Maine', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 24500, rate: 0.058 },
    { min: 24500, max: 58050, rate: 0.0675 },
    { min: 58050, max: Infinity, rate: 0.0715 }
  ]},
  'MD': { name: 'Maryland', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 1000, rate: 0.02 },
    { min: 1000, max: 2000, rate: 0.03 },
    { min: 2000, max: 3000, rate: 0.04 },
    { min: 3000, max: 100000, rate: 0.0475 },
    { min: 100000, max: 125000, rate: 0.05 },
    { min: 125000, max: 150000, rate: 0.0525 },
    { min: 150000, max: 250000, rate: 0.055 },
    { min: 250000, max: Infinity, rate: 0.0575 }
  ]},
  'MA': { name: 'Massachusetts', hasIncomeTax: true, isFlat: true, flatRate: 0.05 },
  'MI': { name: 'Michigan', hasIncomeTax: true, isFlat: true, flatRate: 0.0425 },
  'MN': { name: 'Minnesota', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 30070, rate: 0.0535 },
    { min: 30070, max: 98760, rate: 0.068 },
    { min: 98760, max: 183340, rate: 0.0785 },
    { min: 183340, max: Infinity, rate: 0.0985 }
  ]},
  'MS': { name: 'Mississippi', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 10000, rate: 0.04 },
    { min: 10000, max: Infinity, rate: 0.05 }
  ]},
  'MO': { name: 'Missouri', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 1207, rate: 0 },
    { min: 1207, max: 2414, rate: 0.02 },
    { min: 2414, max: 3621, rate: 0.025 },
    { min: 3621, max: 4828, rate: 0.03 },
    { min: 4828, max: 6035, rate: 0.035 },
    { min: 6035, max: 7242, rate: 0.04 },
    { min: 7242, max: 8449, rate: 0.045 },
    { min: 8449, max: Infinity, rate: 0.048 }
  ]},
  'MT': { name: 'Montana', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 18800, rate: 0.047 },
    { min: 18800, max: Infinity, rate: 0.059 }
  ]},
  'NE': { name: 'Nebraska', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 3700, rate: 0.0246 },
    { min: 3700, max: 22170, rate: 0.0351 },
    { min: 22170, max: 35730, rate: 0.0501 },
    { min: 35730, max: Infinity, rate: 0.0584 }
  ]},
  'NV': { name: 'Nevada', hasIncomeTax: false },
  'NH': { name: 'New Hampshire', hasIncomeTax: true, isFlat: true, flatRate: 0.03, note: 'Interest and dividends only' },
  'NJ': { name: 'New Jersey', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 20000, rate: 0.014 },
    { min: 20000, max: 35000, rate: 0.0175 },
    { min: 35000, max: 40000, rate: 0.035 },
    { min: 40000, max: 75000, rate: 0.05525 },
    { min: 75000, max: 500000, rate: 0.0637 },
    { min: 500000, max: 1000000, rate: 0.0897 },
    { min: 1000000, max: Infinity, rate: 0.1075 }
  ]},
  'NM': { name: 'New Mexico', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 5500, rate: 0.017 },
    { min: 5500, max: 11000, rate: 0.032 },
    { min: 11000, max: 16000, rate: 0.047 },
    { min: 16000, max: 210000, rate: 0.049 },
    { min: 210000, max: Infinity, rate: 0.059 }
  ]},
  'NY': { name: 'New York', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 8500, rate: 0.04 },
    { min: 8500, max: 11700, rate: 0.045 },
    { min: 11700, max: 13900, rate: 0.0525 },
    { min: 13900, max: 80650, rate: 0.0585 },
    { min: 80650, max: 215400, rate: 0.0625 },
    { min: 215400, max: 1077550, rate: 0.0685 },
    { min: 1077550, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 }
  ]},
  'NC': { name: 'North Carolina', hasIncomeTax: true, isFlat: true, flatRate: 0.0475 },
  'ND': { name: 'North Dakota', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 44725, rate: 0.011 },
    { min: 44725, max: 225975, rate: 0.0204 },
    { min: 225975, max: Infinity, rate: 0.025 }
  ]},
  'OH': { name: 'Ohio', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 26050, rate: 0 },
    { min: 26050, max: 100000, rate: 0.02765 },
    { min: 100000, max: Infinity, rate: 0.035 }
  ]},
  'OK': { name: 'Oklahoma', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 1000, rate: 0.0025 },
    { min: 1000, max: 2500, rate: 0.0075 },
    { min: 2500, max: 3750, rate: 0.0175 },
    { min: 3750, max: 4900, rate: 0.0275 },
    { min: 4900, max: 7200, rate: 0.0375 },
    { min: 7200, max: Infinity, rate: 0.0475 }
  ]},
  'OR': { name: 'Oregon', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 4050, rate: 0.0475 },
    { min: 4050, max: 10200, rate: 0.0675 },
    { min: 10200, max: 125000, rate: 0.0875 },
    { min: 125000, max: Infinity, rate: 0.099 }
  ]},
  'PA': { name: 'Pennsylvania', hasIncomeTax: true, isFlat: true, flatRate: 0.0307 },
  'RI': { name: 'Rhode Island', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 73450, rate: 0.0375 },
    { min: 73450, max: 166950, rate: 0.0475 },
    { min: 166950, max: Infinity, rate: 0.0599 }
  ]},
  'SC': { name: 'South Carolina', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 3200, rate: 0 },
    { min: 3200, max: 16040, rate: 0.03 },
    { min: 16040, max: Infinity, rate: 0.0644 }
  ]},
  'SD': { name: 'South Dakota', hasIncomeTax: false },
  'TN': { name: 'Tennessee', hasIncomeTax: false },
  'TX': { name: 'Texas', hasIncomeTax: false },
  'UT': { name: 'Utah', hasIncomeTax: true, isFlat: true, flatRate: 0.0465 },
  'VT': { name: 'Vermont', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 45400, rate: 0.0335 },
    { min: 45400, max: 110050, rate: 0.066 },
    { min: 110050, max: 229550, rate: 0.076 },
    { min: 229550, max: Infinity, rate: 0.0875 }
  ]},
  'VA': { name: 'Virginia', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 3000, rate: 0.02 },
    { min: 3000, max: 5000, rate: 0.03 },
    { min: 5000, max: 17000, rate: 0.05 },
    { min: 17000, max: Infinity, rate: 0.0575 }
  ]},
  'WA': { name: 'Washington', hasIncomeTax: false },
  'WV': { name: 'West Virginia', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 10000, rate: 0.0236 },
    { min: 10000, max: 25000, rate: 0.0315 },
    { min: 25000, max: 40000, rate: 0.0354 },
    { min: 40000, max: 60000, rate: 0.0472 },
    { min: 60000, max: Infinity, rate: 0.0512 }
  ]},
  'WI': { name: 'Wisconsin', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 14320, rate: 0.0354 },
    { min: 14320, max: 28640, rate: 0.0465 },
    { min: 28640, max: 315310, rate: 0.053 },
    { min: 315310, max: Infinity, rate: 0.0765 }
  ]},
  'WY': { name: 'Wyoming', hasIncomeTax: false },
  'DC': { name: 'District of Columbia', hasIncomeTax: true, isFlat: false, brackets: [
    { min: 0, max: 10000, rate: 0.04 },
    { min: 10000, max: 40000, rate: 0.06 },
    { min: 40000, max: 60000, rate: 0.065 },
    { min: 60000, max: 250000, rate: 0.085 },
    { min: 250000, max: 500000, rate: 0.0925 },
    { min: 500000, max: 1000000, rate: 0.0975 },
    { min: 1000000, max: Infinity, rate: 0.1075 }
  ]}
};

class StateTaxService {
  getAllStates() {
    return Object.entries(STATE_TAX_DATA).map(([code, data]) => ({
      code,
      name: data.name,
      hasIncomeTax: data.hasIncomeTax
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  getStateInfo(stateCode) {
    const data = STATE_TAX_DATA[stateCode?.toUpperCase()];
    if (!data) return null;

    return {
      code: stateCode.toUpperCase(),
      name: data.name,
      hasIncomeTax: data.hasIncomeTax,
      isFlat: data.isFlat || false,
      flatRate: data.flatRate || null,
      brackets: data.brackets || null,
      note: data.note || null
    };
  }

  calculateStateTax(stateCode, taxableIncome, filingStatus = 'single') {
    const state = STATE_TAX_DATA[stateCode?.toUpperCase()];

    if (!state || !state.hasIncomeTax) {
      return {
        stateCode: stateCode?.toUpperCase(),
        stateName: state?.name || 'Unknown',
        hasIncomeTax: false,
        taxLiability: 0,
        effectiveRate: 0,
        message: state ? `${state.name} has no state income tax` : 'State not found'
      };
    }

    let taxLiability = 0;

    if (state.isFlat) {
      taxLiability = taxableIncome * state.flatRate;
    } else if (state.brackets) {
      let remainingIncome = taxableIncome;

      for (const bracket of state.brackets) {
        if (remainingIncome <= 0) break;

        const taxableAtBracket = Math.min(
          remainingIncome,
          (bracket.max === Infinity ? remainingIncome : bracket.max) - bracket.min
        );

        if (taxableAtBracket > 0) {
          taxLiability += taxableAtBracket * bracket.rate;
          remainingIncome -= taxableAtBracket;
        }
      }
    }

    taxLiability = Math.round(taxLiability * 100) / 100;
    const effectiveRate = taxableIncome > 0 ? (taxLiability / taxableIncome) * 100 : 0;

    return {
      stateCode: stateCode.toUpperCase(),
      stateName: state.name,
      hasIncomeTax: true,
      isFlat: state.isFlat || false,
      taxableIncome,
      taxLiability,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      brackets: state.isFlat ? null : state.brackets,
      flatRate: state.flatRate || null
    };
  }

  getNoIncomeTaxStates() {
    return Object.entries(STATE_TAX_DATA)
      .filter(([_, data]) => !data.hasIncomeTax)
      .map(([code, data]) => ({ code, name: data.name }));
  }

  compareStateTaxes(taxableIncome, states = null) {
    const statesToCompare = states || Object.keys(STATE_TAX_DATA);

    return statesToCompare.map(code => {
      const result = this.calculateStateTax(code, taxableIncome);
      return {
        stateCode: result.stateCode,
        stateName: result.stateName,
        taxLiability: result.taxLiability,
        effectiveRate: result.effectiveRate,
        hasIncomeTax: result.hasIncomeTax
      };
    }).sort((a, b) => a.taxLiability - b.taxLiability);
  }
}

module.exports = new StateTaxService();
