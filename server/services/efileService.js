/**
 * E-File Service
 * Generates IRS MeF (Modernized e-File) XML format for electronic filing
 * Note: Actual IRS e-filing requires authorized e-file provider status
 */

const { v4: uuidv4 } = require('uuid');

class EFileService {
  constructor() {
    this.taxYear = 2024;
    this.softwareId = 'AITAXPREP';
    this.softwareVersion = '1.0.0';
  }

  /**
   * Generate IRS-format XML for Form 1040
   */
  generateForm1040XML(taxReturn) {
    const submissionId = this.generateSubmissionId();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<efile:Return xmlns:efile="http://www.irs.gov/efile" returnVersion="2024v1.0">
  <efile:ReturnHeader>
    <efile:ReturnTs>${new Date().toISOString()}</efile:ReturnTs>
    <efile:TaxYr>${this.taxYear}</efile:TaxYr>
    <efile:TaxPeriodBeginDt>${this.taxYear}-01-01</efile:TaxPeriodBeginDt>
    <efile:TaxPeriodEndDt>${this.taxYear}-12-31</efile:TaxPeriodEndDt>
    <efile:SoftwareId>${this.softwareId}</efile:SoftwareId>
    <efile:SoftwareVersionNum>${this.softwareVersion}</efile:SoftwareVersionNum>
    <efile:OriginatorGrp>
      <efile:EFIN>000000</efile:EFIN>
      <efile:OriginatorTypeCd>OnlineFiler</efile:OriginatorTypeCd>
    </efile:OriginatorGrp>
    <efile:SubmissionId>${submissionId}</efile:SubmissionId>
    <efile:ReturnTypeCd>1040</efile:ReturnTypeCd>
    <efile:Filer>
      <efile:PrimarySSN>${this.maskSSN(taxReturn.ssn)}</efile:PrimarySSN>
      <efile:SpouseSSN>${taxReturn.spouseSSN ? this.maskSSN(taxReturn.spouseSSN) : ''}</efile:SpouseSSN>
      <efile:NameLine1Txt>${taxReturn.firstName} ${taxReturn.lastName}</efile:NameLine1Txt>
      <efile:PrimaryNameControlTxt>${taxReturn.lastName.substring(0, 4).toUpperCase()}</efile:PrimaryNameControlTxt>
      <efile:USAddress>
        <efile:AddressLine1Txt>${taxReturn.address || ''}</efile:AddressLine1Txt>
        <efile:CityNm>${taxReturn.city || ''}</efile:CityNm>
        <efile:StateAbbreviationCd>${taxReturn.state || ''}</efile:StateAbbreviationCd>
        <efile:ZIPCd>${taxReturn.zip || ''}</efile:ZIPCd>
      </efile:USAddress>
    </efile:Filer>
  </efile:ReturnHeader>

  <efile:ReturnData documentCnt="1">
    <efile:IRS1040 documentId="IRS1040-001">
      ${this.generateFilingStatusXML(taxReturn.filingStatus)}
      ${this.generateIncomeXML(taxReturn)}
      ${this.generateAdjustmentsXML(taxReturn)}
      ${this.generateDeductionsXML(taxReturn)}
      ${this.generateTaxAndCreditsXML(taxReturn)}
      ${this.generatePaymentsXML(taxReturn)}
      ${this.generateRefundXML(taxReturn)}
    </efile:IRS1040>

    ${taxReturn.schedules?.map(s => this.generateScheduleXML(s)).join('\n') || ''}
  </efile:ReturnData>
</efile:Return>`;

    return {
      submissionId,
      xml,
      timestamp: new Date().toISOString(),
      formType: '1040',
      status: 'generated'
    };
  }

  /**
   * Generate filing status XML
   */
  generateFilingStatusXML(filingStatus) {
    const statusMap = {
      'single': '<efile:IndividualReturnFilingStatusCd>1</efile:IndividualReturnFilingStatusCd>',
      'married_filing_jointly': '<efile:IndividualReturnFilingStatusCd>2</efile:IndividualReturnFilingStatusCd>',
      'married_filing_separately': '<efile:IndividualReturnFilingStatusCd>3</efile:IndividualReturnFilingStatusCd>',
      'head_of_household': '<efile:IndividualReturnFilingStatusCd>4</efile:IndividualReturnFilingStatusCd>',
      'qualifying_widow': '<efile:IndividualReturnFilingStatusCd>5</efile:IndividualReturnFilingStatusCd>'
    };
    return statusMap[filingStatus] || statusMap.single;
  }

  /**
   * Generate income section XML
   */
  generateIncomeXML(taxReturn) {
    return `
      <efile:WagesSalariesAndTipsAmt>${taxReturn.wages || 0}</efile:WagesSalariesAndTipsAmt>
      <efile:TaxableInterestAmt>${taxReturn.interestIncome || 0}</efile:TaxableInterestAmt>
      <efile:OrdinaryDividendsAmt>${taxReturn.dividendIncome || 0}</efile:OrdinaryDividendsAmt>
      <efile:QualifiedDividendsAmt>${taxReturn.qualifiedDividends || 0}</efile:QualifiedDividendsAmt>
      <efile:CapitalGainLossAmt>${taxReturn.capitalGains || 0}</efile:CapitalGainLossAmt>
      <efile:TaxableIRAAmt>${taxReturn.iraDistributions || 0}</efile:TaxableIRAAmt>
      <efile:TaxablePensionsAmt>${taxReturn.pensionIncome || 0}</efile:TaxablePensionsAmt>
      <efile:TaxableSocSecAmt>${taxReturn.taxableSocialSecurity || 0}</efile:TaxableSocSecAmt>
      <efile:ScheduleCNetProfitLossAmt>${taxReturn.scheduleCIncome || 0}</efile:ScheduleCNetProfitLossAmt>
      <efile:OtherIncomeAmt>${taxReturn.otherIncome || 0}</efile:OtherIncomeAmt>
      <efile:TotalIncomeAmt>${taxReturn.totalIncome || 0}</efile:TotalIncomeAmt>`;
  }

  /**
   * Generate adjustments to income XML
   */
  generateAdjustmentsXML(taxReturn) {
    return `
      <efile:EducatorExpensesAmt>${taxReturn.educatorExpenses || 0}</efile:EducatorExpensesAmt>
      <efile:HSADeductionAmt>${taxReturn.hsaDeduction || 0}</efile:HSADeductionAmt>
      <efile:SelfEmploymentTaxDeductionAmt>${taxReturn.seTaxDeduction || 0}</efile:SelfEmploymentTaxDeductionAmt>
      <efile:SEPSimpleQualifiedPlansAmt>${taxReturn.retirementContribution || 0}</efile:SEPSimpleQualifiedPlansAmt>
      <efile:SelfEmpldHealthInsDedAmt>${taxReturn.seHealthInsurance || 0}</efile:SelfEmpldHealthInsDedAmt>
      <efile:StudentLoanInterestDedAmt>${taxReturn.studentLoanInterest || 0}</efile:StudentLoanInterestDedAmt>
      <efile:IRADeductionAmt>${taxReturn.iraDeduction || 0}</efile:IRADeductionAmt>
      <efile:TotalAdjustmentsAmt>${taxReturn.totalAdjustments || 0}</efile:TotalAdjustmentsAmt>
      <efile:AdjustedGrossIncomeAmt>${taxReturn.agi || 0}</efile:AdjustedGrossIncomeAmt>`;
  }

  /**
   * Generate deductions XML
   */
  generateDeductionsXML(taxReturn) {
    const useItemized = (taxReturn.itemizedDeductions || 0) > (taxReturn.standardDeduction || 0);

    return `
      <efile:ItemizedOrStandardDedInd>${useItemized ? 'Itemized' : 'Standard'}</efile:ItemizedOrStandardDedInd>
      ${useItemized ? `
      <efile:TotalItemizedDeductionsAmt>${taxReturn.itemizedDeductions || 0}</efile:TotalItemizedDeductionsAmt>
      <efile:MedicalAndDentalExpensesAmt>${taxReturn.medicalDeductions || 0}</efile:MedicalAndDentalExpensesAmt>
      <efile:StateAndLocalTaxAmt>${Math.min(taxReturn.saltDeductions || 0, 10000)}</efile:StateAndLocalTaxAmt>
      <efile:RealEstateTaxesAmt>${taxReturn.propertyTax || 0}</efile:RealEstateTaxesAmt>
      <efile:MortgageInterestAmt>${taxReturn.mortgageInterest || 0}</efile:MortgageInterestAmt>
      <efile:CharitableContributionsAmt>${taxReturn.charitableContributions || 0}</efile:CharitableContributionsAmt>
      ` : `
      <efile:StandardDeductionAmt>${taxReturn.standardDeduction || 0}</efile:StandardDeductionAmt>
      `}
      <efile:QualifiedBusinessIncDedAmt>${taxReturn.qbiDeduction || 0}</efile:QualifiedBusinessIncDedAmt>
      <efile:TotalDeductionsAmt>${taxReturn.totalDeductions || 0}</efile:TotalDeductionsAmt>
      <efile:TaxableIncomeAmt>${taxReturn.taxableIncome || 0}</efile:TaxableIncomeAmt>`;
  }

  /**
   * Generate tax and credits XML
   */
  generateTaxAndCreditsXML(taxReturn) {
    return `
      <efile:TaxAmt>${taxReturn.taxLiability || 0}</efile:TaxAmt>
      <efile:AlternativeMinimumTaxAmt>${taxReturn.amt || 0}</efile:AlternativeMinimumTaxAmt>
      <efile:NetInvestmentIncomeTaxAmt>${taxReturn.niit || 0}</efile:NetInvestmentIncomeTaxAmt>
      <efile:SelfEmploymentTaxAmt>${taxReturn.selfEmploymentTax || 0}</efile:SelfEmploymentTaxAmt>
      <efile:TotalTaxBeforeCrAndOthTaxesAmt>${taxReturn.totalTaxBeforeCredits || 0}</efile:TotalTaxBeforeCrAndOthTaxesAmt>
      <efile:ChildTaxCreditAmt>${taxReturn.childTaxCredit || 0}</efile:ChildTaxCreditAmt>
      <efile:OtherDependentCreditAmt>${taxReturn.otherDependentCredit || 0}</efile:OtherDependentCreditAmt>
      <efile:ChildAndDependentCareCreditAmt>${taxReturn.childcareCredit || 0}</efile:ChildAndDependentCareCreditAmt>
      <efile:EducationCreditAmt>${taxReturn.educationCredit || 0}</efile:EducationCreditAmt>
      <efile:RetirementSavingsContCrAmt>${taxReturn.saversCredit || 0}</efile:RetirementSavingsContCrAmt>
      <efile:ResidentialEnergyCreditAmt>${taxReturn.energyCredit || 0}</efile:ResidentialEnergyCreditAmt>
      <efile:EarnedIncomeCreditAmt>${taxReturn.eitc || 0}</efile:EarnedIncomeCreditAmt>
      <efile:RefundableChildTaxCrAmt>${taxReturn.refundableCTC || 0}</efile:RefundableChildTaxCrAmt>
      <efile:TotalCreditsAmt>${taxReturn.totalCredits || 0}</efile:TotalCreditsAmt>
      <efile:TotalTaxAmt>${taxReturn.totalTax || 0}</efile:TotalTaxAmt>`;
  }

  /**
   * Generate payments XML
   */
  generatePaymentsXML(taxReturn) {
    return `
      <efile:WithholdingTaxAmt>${taxReturn.federalWithheld || 0}</efile:WithholdingTaxAmt>
      <efile:EstimatedTaxPaymentsAmt>${taxReturn.estimatedPayments || 0}</efile:EstimatedTaxPaymentsAmt>
      <efile:TotalPaymentsAmt>${taxReturn.totalPayments || 0}</efile:TotalPaymentsAmt>`;
  }

  /**
   * Generate refund/amount owed XML
   */
  generateRefundXML(taxReturn) {
    const refundAmount = Math.max(0, (taxReturn.totalPayments || 0) - (taxReturn.totalTax || 0));
    const amountOwed = Math.max(0, (taxReturn.totalTax || 0) - (taxReturn.totalPayments || 0));

    return `
      <efile:OverpaidAmt>${refundAmount}</efile:OverpaidAmt>
      <efile:RefundAmt>${refundAmount}</efile:RefundAmt>
      <efile:OwedAmt>${amountOwed}</efile:OwedAmt>`;
  }

  /**
   * Generate schedule XML
   */
  generateScheduleXML(schedule) {
    switch (schedule.type) {
      case 'A':
        return this.generateScheduleAXML(schedule);
      case 'C':
        return this.generateScheduleCXML(schedule);
      case 'D':
        return this.generateScheduleDXML(schedule);
      case 'SE':
        return this.generateScheduleSEXML(schedule);
      default:
        return '';
    }
  }

  /**
   * Generate Schedule A (Itemized Deductions) XML
   */
  generateScheduleAXML(schedule) {
    return `
    <efile:IRS1040ScheduleA documentId="ScheduleA-001">
      <efile:MedicalAndDentalExpensesAmt>${schedule.medical || 0}</efile:MedicalAndDentalExpensesAmt>
      <efile:StateAndLocalIncomeTaxAmt>${schedule.stateLocalTax || 0}</efile:StateAndLocalIncomeTaxAmt>
      <efile:RealEstateTaxesAmt>${schedule.realEstateTax || 0}</efile:RealEstateTaxesAmt>
      <efile:TotalTaxesPaidAmt>${Math.min(schedule.totalTaxes || 0, 10000)}</efile:TotalTaxesPaidAmt>
      <efile:MortgageInterestAmt>${schedule.mortgageInterest || 0}</efile:MortgageInterestAmt>
      <efile:PointsNotReportedOnForm1098Amt>${schedule.points || 0}</efile:PointsNotReportedOnForm1098Amt>
      <efile:GiftsToCharityAmt>${schedule.charity || 0}</efile:GiftsToCharityAmt>
      <efile:TotalItemizedDeductionsAmt>${schedule.total || 0}</efile:TotalItemizedDeductionsAmt>
    </efile:IRS1040ScheduleA>`;
  }

  /**
   * Generate Schedule C XML
   */
  generateScheduleCXML(schedule) {
    return `
    <efile:IRS1040ScheduleC documentId="ScheduleC-001">
      <efile:PrincipalBusinessActivityDesc>${schedule.businessType || ''}</efile:PrincipalBusinessActivityDesc>
      <efile:GrossReceiptsOrSalesAmt>${schedule.grossReceipts || 0}</efile:GrossReceiptsOrSalesAmt>
      <efile:ReturnsAndAllowancesAmt>${schedule.returns || 0}</efile:ReturnsAndAllowancesAmt>
      <efile:CostOfGoodsSoldAmt>${schedule.cogs || 0}</efile:CostOfGoodsSoldAmt>
      <efile:GrossProfitAmt>${schedule.grossProfit || 0}</efile:GrossProfitAmt>
      <efile:TotalExpensesAmt>${schedule.totalExpenses || 0}</efile:TotalExpensesAmt>
      <efile:TentativeProfitOrLossAmt>${schedule.netProfit || 0}</efile:TentativeProfitOrLossAmt>
      <efile:BusinessUsePct>${schedule.homeOfficePercent || 0}</efile:BusinessUsePct>
      <efile:NetProfitOrLossAmt>${schedule.netProfit || 0}</efile:NetProfitOrLossAmt>
    </efile:IRS1040ScheduleC>`;
  }

  /**
   * Generate Schedule D (Capital Gains) XML
   */
  generateScheduleDXML(schedule) {
    return `
    <efile:IRS1040ScheduleD documentId="ScheduleD-001">
      <efile:ShortTermCapitalGainOrLossAmt>${schedule.shortTermGains || 0}</efile:ShortTermCapitalGainOrLossAmt>
      <efile:LongTermCapitalGainOrLossAmt>${schedule.longTermGains || 0}</efile:LongTermCapitalGainOrLossAmt>
      <efile:NetCapitalGainOrLossAmt>${schedule.netGainLoss || 0}</efile:NetCapitalGainOrLossAmt>
    </efile:IRS1040ScheduleD>`;
  }

  /**
   * Generate Schedule SE (Self-Employment Tax) XML
   */
  generateScheduleSEXML(schedule) {
    return `
    <efile:IRS1040ScheduleSE documentId="ScheduleSE-001">
      <efile:NetProfitOrLossAmt>${schedule.netEarnings || 0}</efile:NetProfitOrLossAmt>
      <efile:SelfEmploymentTaxAmt>${schedule.seTax || 0}</efile:SelfEmploymentTaxAmt>
      <efile:DeductibleSelfEmploymentTaxAmt>${schedule.seTaxDeduction || 0}</efile:DeductibleSelfEmploymentTaxAmt>
    </efile:IRS1040ScheduleSE>`;
  }

  /**
   * Generate unique submission ID
   */
  generateSubmissionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.softwareId}-${this.taxYear}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Mask SSN for XML (IRS requires last 4 only in most cases for e-file)
   */
  maskSSN(ssn) {
    if (!ssn) return '';
    const clean = ssn.replace(/\D/g, '');
    return `XXX-XX-${clean.slice(-4)}`;
  }

  /**
   * Validate return before e-filing
   */
  validateForEFile(taxReturn) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!taxReturn.firstName || !taxReturn.lastName) {
      errors.push('Taxpayer name is required');
    }
    if (!taxReturn.ssn) {
      errors.push('Social Security Number is required');
    }
    if (!taxReturn.filingStatus) {
      errors.push('Filing status is required');
    }
    if (!taxReturn.address) {
      warnings.push('Mailing address is recommended');
    }

    // Income validation
    if (taxReturn.wages < 0) {
      errors.push('Wages cannot be negative');
    }

    // Math validation
    const calculatedTax = (taxReturn.totalTax || 0);
    const calculatedPayments = (taxReturn.totalPayments || 0);
    const refund = taxReturn.refundAmount || 0;
    const owed = taxReturn.amountOwed || 0;

    if (Math.abs((calculatedPayments - calculatedTax) - (refund - owed)) > 1) {
      errors.push('Refund/owed calculation does not balance');
    }

    // Signature
    if (!taxReturn.signed) {
      warnings.push('Return must be signed before e-filing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canEFile: errors.length === 0
    };
  }

  /**
   * Simulate e-file submission
   * Note: Real e-filing requires IRS authorization
   */
  async simulateEFileSubmission(xmlData, submissionId) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate acceptance (90% success rate for demo)
    const isAccepted = Math.random() > 0.1;

    if (isAccepted) {
      return {
        status: 'accepted',
        submissionId,
        confirmationNumber: `IRS-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        message: 'Return accepted by IRS'
      };
    } else {
      return {
        status: 'rejected',
        submissionId,
        rejectionCode: 'R0000-001',
        rejectionMessage: 'Demo rejection - in production, specific error would be returned',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EFileService();
