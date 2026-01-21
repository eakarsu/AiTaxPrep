/**
 * PDF Service
 * Generates PDF tax forms and reports
 */

class PDFService {
  constructor() {
    this.pageWidth = 612; // Letter size in points
    this.pageHeight = 792;
    this.margin = 50;
  }

  /**
   * Generate Form 1040 PDF data (HTML format for client-side PDF generation)
   */
  generateForm1040HTML(taxReturn) {
    const {
      firstName, lastName, ssn, filingStatus,
      address, city, state, zip,
      wages, interestIncome, dividendIncome, capitalGains,
      totalIncome, adjustments, agi, deductions, taxableIncome,
      totalTax, withholdings, refund, amountOwed, taxYear
    } = taxReturn;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Form 1040 - ${taxYear} U.S. Individual Income Tax Return</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: 'Courier New', monospace; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 14pt; margin: 0; }
    .header h2 { font-size: 11pt; margin: 5px 0; font-weight: normal; }
    .section { margin-bottom: 15px; border: 1px solid #000; padding: 10px; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px; margin: -10px -10px 10px -10px; }
    .line { display: flex; justify-content: space-between; margin: 5px 0; }
    .line-number { width: 30px; font-weight: bold; }
    .line-description { flex: 1; }
    .line-amount { width: 100px; text-align: right; border-bottom: 1px solid #000; }
    .total-line { font-weight: bold; background: #f9f9f9; }
    .signature-box { border-top: 2px solid #000; margin-top: 30px; padding-top: 10px; }
    .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; margin-right: 5px; }
    .checkbox.checked::after { content: '✓'; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 3px; text-align: left; }
    .amount { text-align: right; }
    .form-number { position: absolute; top: 10px; left: 10px; font-size: 12pt; font-weight: bold; }
    .tax-year { position: absolute; top: 10px; right: 10px; font-size: 16pt; font-weight: bold; }
  </style>
</head>
<body>
  <div class="form-number">Form 1040</div>
  <div class="tax-year">${taxYear}</div>

  <div class="header">
    <h1>U.S. Individual Income Tax Return</h1>
    <h2>Department of the Treasury—Internal Revenue Service</h2>
  </div>

  <div class="section">
    <div class="section-title">Filing Status and Personal Information</div>
    <table>
      <tr>
        <td>Filing Status:</td>
        <td><strong>${this.formatFilingStatus(filingStatus)}</strong></td>
      </tr>
      <tr>
        <td>Your first name and middle initial:</td>
        <td><strong>${firstName || ''}</strong></td>
        <td>Last name:</td>
        <td><strong>${lastName || ''}</strong></td>
      </tr>
      <tr>
        <td>Your social security number:</td>
        <td><strong>${this.maskSSN(ssn)}</strong></td>
      </tr>
      <tr>
        <td colspan="4">Home address: <strong>${address || ''}, ${city || ''}, ${state || ''} ${zip || ''}</strong></td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Income</div>
    ${this.generateIncomeLinesHTML({
      wages, interestIncome, dividendIncome, capitalGains, totalIncome
    })}
  </div>

  <div class="section">
    <div class="section-title">Adjusted Gross Income</div>
    <div class="line">
      <span class="line-number">10</span>
      <span class="line-description">Adjustments to income</span>
      <span class="line-amount">$${this.formatNumber(adjustments)}</span>
    </div>
    <div class="line total-line">
      <span class="line-number">11</span>
      <span class="line-description">Adjusted gross income (AGI)</span>
      <span class="line-amount">$${this.formatNumber(agi)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tax and Credits</div>
    <div class="line">
      <span class="line-number">12</span>
      <span class="line-description">Standard deduction or itemized deductions</span>
      <span class="line-amount">$${this.formatNumber(deductions)}</span>
    </div>
    <div class="line total-line">
      <span class="line-number">15</span>
      <span class="line-description">Taxable income</span>
      <span class="line-amount">$${this.formatNumber(taxableIncome)}</span>
    </div>
    <div class="line total-line">
      <span class="line-number">24</span>
      <span class="line-description">Total tax</span>
      <span class="line-amount">$${this.formatNumber(totalTax)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payments</div>
    <div class="line">
      <span class="line-number">25</span>
      <span class="line-description">Federal income tax withheld</span>
      <span class="line-amount">$${this.formatNumber(withholdings)}</span>
    </div>
    <div class="line total-line">
      <span class="line-number">33</span>
      <span class="line-description">Total payments</span>
      <span class="line-amount">$${this.formatNumber(withholdings)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Refund or Amount You Owe</div>
    ${refund > 0 ? `
    <div class="line total-line" style="color: green;">
      <span class="line-number">34</span>
      <span class="line-description">Amount overpaid (REFUND)</span>
      <span class="line-amount">$${this.formatNumber(refund)}</span>
    </div>
    ` : ''}
    ${amountOwed > 0 ? `
    <div class="line total-line" style="color: red;">
      <span class="line-number">37</span>
      <span class="line-description">Amount you owe</span>
      <span class="line-amount">$${this.formatNumber(amountOwed)}</span>
    </div>
    ` : ''}
  </div>

  <div class="signature-box">
    <p><strong>Sign Here</strong> - Under penalties of perjury, I declare that I have examined this return and accompanying schedules and statements, and to the best of my knowledge and belief, they are true, correct, and complete.</p>
    <table>
      <tr>
        <td style="width: 60%;">Your signature: _________________________</td>
        <td>Date: _____________</td>
      </tr>
      <tr>
        <td>Spouse's signature (if joint return): _________________________</td>
        <td>Date: _____________</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 20px; font-size: 8pt; color: #666;">
    <p>Generated by AI Tax Prep Assistant | For informational purposes only</p>
    <p>This is a draft form. Please review carefully before filing.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate income lines HTML
   */
  generateIncomeLinesHTML(income) {
    return `
    <div class="line">
      <span class="line-number">1</span>
      <span class="line-description">Wages, salaries, tips (W-2)</span>
      <span class="line-amount">$${this.formatNumber(income.wages)}</span>
    </div>
    <div class="line">
      <span class="line-number">2b</span>
      <span class="line-description">Taxable interest</span>
      <span class="line-amount">$${this.formatNumber(income.interestIncome)}</span>
    </div>
    <div class="line">
      <span class="line-number">3b</span>
      <span class="line-description">Ordinary dividends</span>
      <span class="line-amount">$${this.formatNumber(income.dividendIncome)}</span>
    </div>
    <div class="line">
      <span class="line-number">7</span>
      <span class="line-description">Capital gain or (loss)</span>
      <span class="line-amount">$${this.formatNumber(income.capitalGains)}</span>
    </div>
    <div class="line total-line">
      <span class="line-number">9</span>
      <span class="line-description">Total income</span>
      <span class="line-amount">$${this.formatNumber(income.totalIncome)}</span>
    </div>`;
  }

  /**
   * Generate Schedule C PDF HTML
   */
  generateScheduleCHTML(scheduleC) {
    const { businessName, businessType, grossReceipts, expenses, netProfit, taxYear } = scheduleC;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Schedule C - Profit or Loss From Business</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: 'Courier New', monospace; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 20px; }
    .section { margin-bottom: 15px; border: 1px solid #000; padding: 10px; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px; margin: -10px -10px 10px -10px; }
    .line { display: flex; justify-content: space-between; margin: 5px 0; }
    .line-amount { width: 100px; text-align: right; }
    .total-line { font-weight: bold; background: #f9f9f9; padding: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SCHEDULE C (Form 1040)</h1>
    <h2>Profit or Loss From Business (Sole Proprietorship)</h2>
    <p>Tax Year ${taxYear}</p>
  </div>

  <div class="section">
    <div class="section-title">Business Information</div>
    <p><strong>Business Name:</strong> ${businessName || 'N/A'}</p>
    <p><strong>Business Type:</strong> ${businessType || 'N/A'}</p>
  </div>

  <div class="section">
    <div class="section-title">Part I - Income</div>
    <div class="line">
      <span>1. Gross receipts or sales</span>
      <span class="line-amount">$${this.formatNumber(grossReceipts)}</span>
    </div>
    <div class="line total-line">
      <span>7. Gross income</span>
      <span class="line-amount">$${this.formatNumber(grossReceipts)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Part II - Expenses</div>
    ${Object.entries(expenses || {}).map(([category, amount]) => `
    <div class="line">
      <span>${category}</span>
      <span class="line-amount">$${this.formatNumber(amount)}</span>
    </div>
    `).join('')}
    <div class="line total-line">
      <span>28. Total expenses</span>
      <span class="line-amount">$${this.formatNumber(Object.values(expenses || {}).reduce((a, b) => a + b, 0))}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Net Profit or Loss</div>
    <div class="line total-line" style="font-size: 12pt; ${netProfit >= 0 ? 'color: green;' : 'color: red;'}">
      <span>31. Net profit (or loss)</span>
      <span class="line-amount">$${this.formatNumber(netProfit)}</span>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate Tax Summary Report PDF HTML
   */
  generateTaxSummaryHTML(taxData) {
    const {
      personalInfo, income, deductions, credits, taxCalculation, taxYear
    } = taxData;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Tax Summary Report - ${taxYear}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: Arial, sans-serif; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { color: #1a365d; margin: 0; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 12pt; font-weight: bold; color: #1a365d; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f7fafc; font-weight: bold; }
    .amount { text-align: right; }
    .total-row { font-weight: bold; background: #edf2f7; }
    .refund { color: #276749; font-weight: bold; }
    .owed { color: #c53030; font-weight: bold; }
    .summary-box { background: #ebf8ff; border: 2px solid #3182ce; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .summary-box h2 { color: #2b6cb0; margin-top: 0; }
    .big-number { font-size: 24pt; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 8pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tax Summary Report</h1>
    <p>Tax Year ${taxYear} | Generated ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="summary-box">
    <h2>Your Tax Result</h2>
    ${taxCalculation.refund > 0 ? `
    <p class="refund">
      <span class="big-number">$${this.formatNumber(taxCalculation.refund)}</span>
      <br>Estimated Refund
    </p>
    ` : `
    <p class="owed">
      <span class="big-number">$${this.formatNumber(taxCalculation.amountOwed)}</span>
      <br>Amount Owed
    </p>
    `}
  </div>

  <div class="section">
    <div class="section-title">Personal Information</div>
    <table>
      <tr><td>Name:</td><td>${personalInfo?.firstName} ${personalInfo?.lastName}</td></tr>
      <tr><td>Filing Status:</td><td>${this.formatFilingStatus(personalInfo?.filingStatus)}</td></tr>
      <tr><td>Dependents:</td><td>${personalInfo?.dependents || 0}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Income Summary</div>
    <table>
      <tr><th>Source</th><th class="amount">Amount</th></tr>
      <tr><td>Wages & Salaries</td><td class="amount">$${this.formatNumber(income?.wages)}</td></tr>
      <tr><td>Interest Income</td><td class="amount">$${this.formatNumber(income?.interest)}</td></tr>
      <tr><td>Dividend Income</td><td class="amount">$${this.formatNumber(income?.dividends)}</td></tr>
      <tr><td>Capital Gains</td><td class="amount">$${this.formatNumber(income?.capitalGains)}</td></tr>
      <tr><td>Business Income</td><td class="amount">$${this.formatNumber(income?.business)}</td></tr>
      <tr><td>Other Income</td><td class="amount">$${this.formatNumber(income?.other)}</td></tr>
      <tr class="total-row"><td>Total Income</td><td class="amount">$${this.formatNumber(income?.total)}</td></tr>
      <tr><td>Adjustments</td><td class="amount">($${this.formatNumber(income?.adjustments)})</td></tr>
      <tr class="total-row"><td>Adjusted Gross Income (AGI)</td><td class="amount">$${this.formatNumber(income?.agi)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Deductions</div>
    <table>
      <tr><th>Type</th><th class="amount">Amount</th></tr>
      <tr><td>Deduction Type Used</td><td>${deductions?.type || 'Standard'}</td></tr>
      <tr class="total-row"><td>Total Deductions</td><td class="amount">$${this.formatNumber(deductions?.total)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Tax Calculation</div>
    <table>
      <tr><td>Taxable Income</td><td class="amount">$${this.formatNumber(taxCalculation?.taxableIncome)}</td></tr>
      <tr><td>Federal Tax</td><td class="amount">$${this.formatNumber(taxCalculation?.federalTax)}</td></tr>
      <tr><td>Self-Employment Tax</td><td class="amount">$${this.formatNumber(taxCalculation?.seTax)}</td></tr>
      <tr><td>Total Tax Credits</td><td class="amount">($${this.formatNumber(credits?.total)})</td></tr>
      <tr class="total-row"><td>Total Tax</td><td class="amount">$${this.formatNumber(taxCalculation?.totalTax)}</td></tr>
      <tr><td>Tax Withheld</td><td class="amount">$${this.formatNumber(taxCalculation?.withheld)}</td></tr>
      <tr><td>Estimated Payments</td><td class="amount">$${this.formatNumber(taxCalculation?.estimatedPayments)}</td></tr>
      ${taxCalculation?.refund > 0 ? `
      <tr class="total-row refund"><td>Refund</td><td class="amount">$${this.formatNumber(taxCalculation.refund)}</td></tr>
      ` : `
      <tr class="total-row owed"><td>Amount Owed</td><td class="amount">$${this.formatNumber(taxCalculation.amountOwed)}</td></tr>
      `}
    </table>
  </div>

  <div class="footer">
    <p><strong>Disclaimer:</strong> This summary is for informational purposes only and does not constitute tax advice. Please consult a qualified tax professional for specific guidance.</p>
    <p>Generated by AI Tax Prep Assistant</p>
  </div>
</body>
</html>`;
  }

  /**
   * Format number for display
   */
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return Math.abs(Number(num)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format filing status for display
   */
  formatFilingStatus(status) {
    const statusMap = {
      'single': 'Single',
      'married_filing_jointly': 'Married Filing Jointly',
      'married_filing_separately': 'Married Filing Separately',
      'head_of_household': 'Head of Household',
      'qualifying_widow': 'Qualifying Surviving Spouse'
    };
    return statusMap[status] || status || 'Not specified';
  }

  /**
   * Mask SSN for display (show only last 4)
   */
  maskSSN(ssn) {
    if (!ssn) return 'XXX-XX-XXXX';
    const clean = ssn.replace(/\D/g, '');
    return `XXX-XX-${clean.slice(-4)}`;
  }

  /**
   * Generate all available forms for a tax year
   */
  generateAllForms(taxReturn) {
    const forms = [];

    // Form 1040
    forms.push({
      formType: '1040',
      formTitle: 'U.S. Individual Income Tax Return',
      html: this.generateForm1040HTML(taxReturn)
    });

    // Schedule C if self-employed
    if (taxReturn.scheduleCIncome || taxReturn.selfEmploymentIncome) {
      forms.push({
        formType: 'Schedule C',
        formTitle: 'Profit or Loss From Business',
        html: this.generateScheduleCHTML({
          businessName: taxReturn.businessName,
          businessType: taxReturn.businessType,
          grossReceipts: taxReturn.businessGrossReceipts || taxReturn.selfEmploymentIncome,
          expenses: taxReturn.businessExpenses || {},
          netProfit: taxReturn.scheduleCIncome || taxReturn.selfEmploymentIncome,
          taxYear: taxReturn.taxYear
        })
      });
    }

    // Tax Summary Report
    forms.push({
      formType: 'Summary',
      formTitle: 'Tax Summary Report',
      html: this.generateTaxSummaryHTML({
        personalInfo: {
          firstName: taxReturn.firstName,
          lastName: taxReturn.lastName,
          filingStatus: taxReturn.filingStatus,
          dependents: taxReturn.dependents
        },
        income: {
          wages: taxReturn.wages,
          interest: taxReturn.interestIncome,
          dividends: taxReturn.dividendIncome,
          capitalGains: taxReturn.capitalGains,
          business: taxReturn.scheduleCIncome,
          other: taxReturn.otherIncome,
          total: taxReturn.totalIncome,
          adjustments: taxReturn.adjustments,
          agi: taxReturn.agi
        },
        deductions: {
          type: taxReturn.deductionType,
          total: taxReturn.deductions
        },
        credits: {
          total: taxReturn.totalCredits
        },
        taxCalculation: {
          taxableIncome: taxReturn.taxableIncome,
          federalTax: taxReturn.federalTax,
          seTax: taxReturn.selfEmploymentTax,
          totalTax: taxReturn.totalTax,
          withheld: taxReturn.withholdings,
          estimatedPayments: taxReturn.estimatedPayments,
          refund: taxReturn.refund,
          amountOwed: taxReturn.amountOwed
        },
        taxYear: taxReturn.taxYear
      })
    });

    return forms;
  }
}

module.exports = new PDFService();
