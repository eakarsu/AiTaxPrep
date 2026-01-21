const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    this.visionModel = process.env.OPENROUTER_VISION_MODEL || 'openai/gpt-4o-mini';
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5001',
      'X-Title': 'AI Tax Prep Assistant'
    };
  }

  async chat(messages, options = {}) {
    try {
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: options.model || this.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000,
          route: 'fallback'
        },
        {
          headers: this.getHeaders()
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('AI Service Error:', error.response?.data || error.message);
      throw new Error('AI service unavailable');
    }
  }

  async analyzeImage(base64Image, prompt, mimeType = 'image/jpeg') {
    try {
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: this.visionModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ],
          max_tokens: 4000,
          route: 'fallback'
        },
        {
          headers: this.getHeaders()
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('AI Vision Error:', error.response?.data || error.message);
      throw new Error('AI vision service unavailable');
    }
  }

  // Tax-specific AI methods
  async getTaxAdvice(userContext) {
    const systemPrompt = `You are an expert tax advisor. Respond ONLY with valid JSON (no markdown, no backticks). Limit to 5 advice items max. Keep descriptions under 200 characters.

JSON format:
{"advice":[{"type":"retirement|deduction|credit|investment|health","title":"string","description":"string","potentialSavings":number,"priority":"high|medium|low","actionItems":["action1","action2"]}],"summary":"string","totalPotentialSavings":number}`;

    const userPrompt = `Tax situation:
- Filing: ${userContext.filingStatus}
- Income: $${userContext.grossIncome?.toLocaleString() || 0}
- Year: ${userContext.taxYear}
- Dependents: ${userContext.dependents?.length || 0}

Provide 5 tax optimization tips as JSON only.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: 2000 });

    try {
      // Clean response - remove markdown formatting if present
      let cleanResponse = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Extract JSON from response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure advice is an array
        if (!Array.isArray(parsed.advice)) {
          parsed.advice = [];
        }
        return parsed;
      }
      return { advice: [], summary: response, totalPotentialSavings: 0 };
    } catch (e) {
      console.error('Failed to parse AI advice response:', e.message);
      return { advice: [], summary: 'AI generated advice but parsing failed. Please try again.', totalPotentialSavings: 0 };
    }
  }

  async chatAboutTaxes(messages, userContext) {
    const systemPrompt = `You are a friendly and knowledgeable AI tax assistant for a tax preparation application. Help users understand tax concepts, answer questions about their tax situation, and provide guidance on tax filing.

User's Context:
- Filing Status: ${userContext.filingStatus || 'Unknown'}
- Gross Income: $${userContext.grossIncome?.toLocaleString() || 'Unknown'}
- Tax Year: ${userContext.taxYear || new Date().getFullYear()}
- Dependents: ${userContext.dependents || 0}

Guidelines:
1. Be helpful, accurate, and concise
2. Explain tax concepts in simple terms
3. When unsure, recommend consulting a tax professional
4. Never provide advice that could be considered illegal tax evasion
5. Focus on legal tax optimization and proper filing
6. Reference specific IRS forms and schedules when relevant`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    return await this.chat(formattedMessages, { temperature: 0.7 });
  }

  async extractDocumentData(base64Image, documentType, mimeType = 'image/jpeg') {
    const prompts = {
      'W-2': `Analyze this W-2 tax form image and extract all relevant information. Return a JSON object with:
{
  "employerName": "string",
  "employerEIN": "string",
  "employerAddress": "string",
  "employeeName": "string",
  "employeeSSN": "last 4 digits only",
  "employeeAddress": "string",
  "wages": number (Box 1),
  "federalTaxWithheld": number (Box 2),
  "socialSecurityWages": number (Box 3),
  "socialSecurityTax": number (Box 4),
  "medicareWages": number (Box 5),
  "medicareTax": number (Box 6),
  "stateTaxWithheld": number (Box 17),
  "stateWages": number (Box 16),
  "state": "string (Box 15)",
  "confidence": "high/medium/low"
}
Only include fields you can clearly read. Use 0 for amounts you cannot determine.`,

      '1099-NEC': `Analyze this 1099-NEC tax form image and extract all relevant information. Return a JSON object with:
{
  "payerName": "string",
  "payerTIN": "string",
  "payerAddress": "string",
  "recipientName": "string",
  "recipientTIN": "last 4 digits only",
  "nonemployeeCompensation": number (Box 1),
  "federalTaxWithheld": number (Box 4),
  "stateTaxWithheld": number (Box 5),
  "state": "string (Box 6)",
  "confidence": "high/medium/low"
}
Only include fields you can clearly read. Use 0 for amounts you cannot determine.`,

      '1099-INT': `Analyze this 1099-INT tax form image and extract all relevant information. Return a JSON object with:
{
  "payerName": "string",
  "payerTIN": "string",
  "recipientName": "string",
  "interestIncome": number (Box 1),
  "earlyWithdrawalPenalty": number (Box 2),
  "usSavingsBondInterest": number (Box 3),
  "federalTaxWithheld": number (Box 4),
  "taxExemptInterest": number (Box 8),
  "confidence": "high/medium/low"
}
Only include fields you can clearly read. Use 0 for amounts you cannot determine.`,

      '1099-DIV': `Analyze this 1099-DIV tax form image and extract all relevant information. Return a JSON object with:
{
  "payerName": "string",
  "recipientName": "string",
  "ordinaryDividends": number (Box 1a),
  "qualifiedDividends": number (Box 1b),
  "totalCapitalGains": number (Box 2a),
  "federalTaxWithheld": number (Box 4),
  "foreignTaxPaid": number (Box 7),
  "confidence": "high/medium/low"
}
Only include fields you can clearly read. Use 0 for amounts you cannot determine.`,

      'Receipt': `Analyze this receipt image and extract expense information. Return a JSON object with:
{
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "total": number,
  "items": [{"description": "string", "amount": number}],
  "category": "best guess category (meals/office supplies/travel/medical/etc)",
  "taxDeductible": boolean,
  "confidence": "high/medium/low"
}`,

      'default': `Analyze this tax document image and extract all relevant financial information. Return a JSON object with all identifiable fields including amounts, dates, names, and any tax-relevant data. Include a "documentType" field with your best guess of the document type and a "confidence" field.`
    };

    const prompt = prompts[documentType] || prompts['default'];
    const response = await this.analyzeImage(base64Image, prompt, mimeType);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { error: 'Could not parse document', rawResponse: response };
    } catch (e) {
      return { error: 'Could not parse document', rawResponse: response };
    }
  }

  async findMissedDeductions(userContext) {
    const systemPrompt = `You are a tax deduction expert. Analyze the user's expenses and situation to identify potentially missed tax deductions. Be thorough and creative in finding legitimate deductions.

Return a JSON response:
{
  "missedDeductions": [
    {
      "category": "string",
      "description": "string",
      "estimatedAmount": number,
      "requirements": "what's needed to claim this",
      "irsReference": "relevant form or publication"
    }
  ],
  "totalPotentialSavings": number,
  "recommendations": ["string"]
}`;

    const userPrompt = `Analyze this taxpayer's situation for missed deductions:

Filing Status: ${userContext.filingStatus}
Gross Income: $${userContext.grossIncome?.toLocaleString()}
Occupation: ${userContext.occupation || 'Not specified'}

Current Expenses:
${userContext.expenses?.map(e => `- ${e.category}: ${e.description} - $${e.amount}`).join('\n') || 'None tracked'}

Current Deductions Claimed:
${userContext.deductions?.map(d => `- ${d.category}: $${d.amount}`).join('\n') || 'None'}

Life Situation:
- Homeowner: ${userContext.isHomeowner ? 'Yes' : 'No'}
- Has Children: ${userContext.dependents > 0 ? 'Yes' : 'No'}
- Self-Employed: ${userContext.isSelfEmployed ? 'Yes' : 'No'}
- Works from Home: ${userContext.worksFromHome ? 'Yes' : 'No'}
- Has Student Loans: ${userContext.hasStudentLoans ? 'Yes' : 'No'}
- Made Charitable Donations: ${userContext.madeCharitableDonations ? 'Yes' : 'No'}
- Has Medical Expenses: ${userContext.hasMedicalExpenses ? 'Yes' : 'No'}
- Paid for Education: ${userContext.paidForEducation ? 'Yes' : 'No'}

Find commonly overlooked deductions this person might be eligible for.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.5 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { missedDeductions: [], totalPotentialSavings: 0, recommendations: [response] };
    } catch (e) {
      return { missedDeductions: [], totalPotentialSavings: 0, recommendations: [response] };
    }
  }

  async analyzeAuditRisk(userContext) {
    const systemPrompt = `You are a tax audit risk analyst. Analyze the taxpayer's return for potential audit triggers and provide a risk assessment. Be realistic and base your analysis on known IRS audit patterns.

Return a JSON response:
{
  "overallRisk": "low/medium/high",
  "riskScore": number (1-100),
  "riskFactors": [
    {
      "factor": "string",
      "description": "string",
      "severity": "low/medium/high",
      "mitigation": "how to reduce this risk"
    }
  ],
  "positiveFactors": ["factors that reduce audit risk"],
  "recommendations": ["string"]
}`;

    const userPrompt = `Analyze audit risk for this tax return:

Filing Status: ${userContext.filingStatus}
Gross Income: $${userContext.grossIncome?.toLocaleString()}
Adjusted Gross Income: $${userContext.agi?.toLocaleString()}

Income Sources:
${userContext.incomeSources?.map(i => `- ${i.type}: $${i.amount?.toLocaleString()}`).join('\n') || 'Not detailed'}

Deductions:
- Standard Deduction: $${userContext.standardDeduction?.toLocaleString() || 0}
- Itemized Deductions: $${userContext.itemizedDeductions?.toLocaleString() || 0}
- Deduction Type Used: ${userContext.deductionType || 'standard'}

Key Deduction Categories:
${userContext.deductionBreakdown?.map(d => `- ${d.category}: $${d.amount?.toLocaleString()}`).join('\n') || 'Not detailed'}

Credits Claimed: $${userContext.totalCredits?.toLocaleString() || 0}
Self-Employment Income: $${userContext.selfEmploymentIncome?.toLocaleString() || 0}
Cash Business Income: ${userContext.hasCashBusiness ? 'Yes' : 'No'}
Home Office Deduction: ${userContext.homeOfficeDeduction ? 'Yes' : 'No'}
Charitable Donations: $${userContext.charitableDonations?.toLocaleString() || 0}

Assess the audit risk based on IRS patterns and statistics.`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { overallRisk: 'unknown', riskScore: 50, riskFactors: [], recommendations: [response] };
    } catch (e) {
      return { overallRisk: 'unknown', riskScore: 50, riskFactors: [], recommendations: [response] };
    }
  }

  async generateInterviewQuestion(context) {
    const answers = context.answers || {};

    // Comprehensive tax interview questions
    const sectionQuestions = {
      personal_info: [
        { question: "What is your legal first name?", type: "text", hint: "As it appears on your Social Security card", field: "first_name" },
        { question: "What is your legal last name?", type: "text", hint: "As it appears on your Social Security card", field: "last_name" },
        { question: "What is your Social Security Number?", type: "text", hint: "Format: XXX-XX-XXXX (kept secure)", field: "ssn" },
        { question: "What is your date of birth?", type: "text", hint: "Format: MM/DD/YYYY", field: "date_of_birth" },
        { question: "What is your filing status for this tax year?", type: "select", options: ["Single", "Married Filing Jointly", "Married Filing Separately", "Head of Household", "Qualifying Widow(er)"], hint: "Your filing status affects your tax brackets and standard deduction", field: "filing_status" },
        { question: "What is your current mailing address?", type: "text", hint: "Street address, City, State, ZIP", field: "mailing_address" },
        { question: "Did you live at this address for the entire year?", type: "boolean", hint: "Important for state tax purposes", field: "same_address_all_year" },
        { question: "What is your occupation/profession?", type: "text", hint: "Your primary job title", field: "occupation" },
        { question: "Are you a U.S. citizen?", type: "boolean", hint: "Affects certain tax credits and filing requirements", field: "is_us_citizen" },
        { question: "Are you legally blind?", type: "boolean", hint: "This may qualify you for additional standard deduction", field: "is_blind" },
        { question: "Can someone else claim you as a dependent?", type: "boolean", hint: "This affects your standard deduction", field: "can_be_claimed" },
        { question: "Are you married?", type: "boolean", hint: "If yes, we'll ask about your spouse", field: "is_married" },
        { question: "What is your spouse's first name?", type: "text", hint: "As it appears on their Social Security card", field: "spouse_first_name", showIf: { field: "is_married", value: "yes" } },
        { question: "What is your spouse's last name?", type: "text", hint: "As it appears on their Social Security card", field: "spouse_last_name", showIf: { field: "is_married", value: "yes" } },
        { question: "What is your spouse's Social Security Number?", type: "text", hint: "Format: XXX-XX-XXXX", field: "spouse_ssn", showIf: { field: "is_married", value: "yes" } },
        { question: "What is your spouse's date of birth?", type: "text", hint: "Format: MM/DD/YYYY", field: "spouse_dob", showIf: { field: "is_married", value: "yes" } },
        { question: "What is your spouse's occupation?", type: "text", hint: "Their primary job title", field: "spouse_occupation", showIf: { field: "is_married", value: "yes" } }
      ],
      income: [
        // W-2 Employment Income
        { question: "Did you receive any wages or salary (W-2 income)?", type: "boolean", hint: "Include all jobs you worked this year", field: "has_w2_income" },
        { question: "What was your total W-2 wages for the year?", type: "currency", hint: "Box 1 of your W-2 form(s) - add all W-2s together", field: "w2_wages_amount", showIf: { field: "has_w2_income", value: "yes" } },
        { question: "How much federal tax was withheld from your W-2?", type: "currency", hint: "Box 2 of your W-2 form(s)", field: "w2_federal_withheld", showIf: { field: "has_w2_income", value: "yes" } },
        { question: "How much state tax was withheld from your W-2?", type: "currency", hint: "Box 17 of your W-2 form(s)", field: "w2_state_withheld", showIf: { field: "has_w2_income", value: "yes" } },
        // Self-Employment
        { question: "Did you receive any self-employment or freelance income?", type: "boolean", hint: "Include 1099-NEC, 1099-MISC, or cash payments", field: "has_self_employment" },
        { question: "What was your total self-employment income?", type: "currency", hint: "Total gross receipts before expenses", field: "self_employment_income", showIf: { field: "has_self_employment", value: "yes" } },
        { question: "What were your total business expenses?", type: "currency", hint: "Supplies, equipment, travel, home office, etc.", field: "self_employment_expenses", showIf: { field: "has_self_employment", value: "yes" } },
        { question: "Did you use part of your home for business?", type: "boolean", hint: "Home office deduction may apply", field: "has_home_office", showIf: { field: "has_self_employment", value: "yes" } },
        { question: "What is the square footage of your home office?", type: "number", hint: "Dedicated space used regularly for business", field: "home_office_sqft", showIf: { field: "has_home_office", value: "yes" } },
        // Investment Income
        { question: "Did you receive any interest income?", type: "boolean", hint: "From bank accounts, CDs, bonds (1099-INT)", field: "has_interest_income" },
        { question: "What was your total interest income?", type: "currency", hint: "From all 1099-INT forms", field: "interest_income", showIf: { field: "has_interest_income", value: "yes" } },
        { question: "Did you receive any dividend income?", type: "boolean", hint: "From stocks, mutual funds (1099-DIV)", field: "has_dividend_income" },
        { question: "What was your total ordinary dividend income?", type: "currency", hint: "Box 1a of 1099-DIV forms", field: "dividend_income", showIf: { field: "has_dividend_income", value: "yes" } },
        { question: "What was your total qualified dividend income?", type: "currency", hint: "Box 1b of 1099-DIV forms (taxed at lower rate)", field: "qualified_dividend_income", showIf: { field: "has_dividend_income", value: "yes" } },
        // Capital Gains
        { question: "Did you sell any stocks, bonds, mutual funds, or cryptocurrency?", type: "boolean", hint: "Any sale of investment assets", field: "has_capital_gains" },
        { question: "What was your total short-term capital gain or loss?", type: "currency", hint: "Assets held less than 1 year (negative if loss)", field: "short_term_capital_gains", showIf: { field: "has_capital_gains", value: "yes" } },
        { question: "What was your total long-term capital gain or loss?", type: "currency", hint: "Assets held more than 1 year (negative if loss)", field: "long_term_capital_gains", showIf: { field: "has_capital_gains", value: "yes" } },
        // Real Estate
        { question: "Did you sell any real estate (home, land, rental property)?", type: "boolean", hint: "Sale of real property", field: "has_real_estate_sale" },
        { question: "What was your gain or loss from real estate sales?", type: "currency", hint: "Sale price minus purchase price and improvements", field: "real_estate_gain", showIf: { field: "has_real_estate_sale", value: "yes" } },
        { question: "Did you receive rental income from property you own?", type: "boolean", hint: "Income from renting out property", field: "has_rental_income" },
        { question: "What was your total rental income?", type: "currency", hint: "Gross rents received", field: "rental_income", showIf: { field: "has_rental_income", value: "yes" } },
        { question: "What were your total rental expenses?", type: "currency", hint: "Mortgage interest, repairs, insurance, depreciation, etc.", field: "rental_expenses", showIf: { field: "has_rental_income", value: "yes" } },
        // Retirement Income
        { question: "Did you receive any Social Security benefits?", type: "boolean", hint: "Form SSA-1099", field: "has_social_security" },
        { question: "What was your total Social Security benefits received?", type: "currency", hint: "Box 5 of Form SSA-1099", field: "social_security_amount", showIf: { field: "has_social_security", value: "yes" } },
        { question: "Did you receive any pension or IRA distributions?", type: "boolean", hint: "From 401(k), IRA, pension plans (1099-R)", field: "has_retirement_distribution" },
        { question: "What was your total retirement distribution?", type: "currency", hint: "Box 1 of 1099-R forms", field: "retirement_distribution", showIf: { field: "has_retirement_distribution", value: "yes" } },
        { question: "How much of the distribution was taxable?", type: "currency", hint: "Box 2a of 1099-R (may be same as Box 1)", field: "taxable_retirement_distribution", showIf: { field: "has_retirement_distribution", value: "yes" } },
        // Other Income
        { question: "Did you receive unemployment compensation?", type: "boolean", hint: "Form 1099-G", field: "has_unemployment" },
        { question: "What was your total unemployment compensation?", type: "currency", hint: "Box 1 of Form 1099-G", field: "unemployment_amount", showIf: { field: "has_unemployment", value: "yes" } },
        { question: "Did you receive alimony payments?", type: "boolean", hint: "Only taxable if divorce was before 2019", field: "has_alimony_received" },
        { question: "What was the total alimony received?", type: "currency", hint: "Total received during the year", field: "alimony_received", showIf: { field: "has_alimony_received", value: "yes" } },
        { question: "Did you have gambling winnings?", type: "boolean", hint: "From casinos, lottery, raffles (W-2G)", field: "has_gambling_winnings" },
        { question: "What were your total gambling winnings?", type: "currency", hint: "Total from all W-2G forms", field: "gambling_winnings", showIf: { field: "has_gambling_winnings", value: "yes" } },
        { question: "What were your total gambling losses?", type: "currency", hint: "Can only deduct up to winnings amount", field: "gambling_losses", showIf: { field: "has_gambling_winnings", value: "yes" } },
        { question: "Did you receive any other taxable income?", type: "boolean", hint: "Jury duty, prizes, awards, hobby income, etc.", field: "has_other_income" },
        { question: "What was your total other income?", type: "currency", hint: "All other taxable income not listed above", field: "other_income_amount", showIf: { field: "has_other_income", value: "yes" } },
        { question: "Please describe the other income:", type: "text", hint: "Brief description of the income source", field: "other_income_description", showIf: { field: "has_other_income", value: "yes" } }
      ],
      deductions: [
        // Mortgage & Home
        { question: "Did you pay mortgage interest on your primary home?", type: "boolean", hint: "Form 1098 from your lender", field: "has_mortgage_interest" },
        { question: "How much mortgage interest did you pay?", type: "currency", hint: "Box 1 of Form 1098", field: "mortgage_interest_amount", showIf: { field: "has_mortgage_interest", value: "yes" } },
        { question: "Did you pay points on a home purchase or refinance?", type: "boolean", hint: "Points paid to obtain your mortgage", field: "has_mortgage_points" },
        { question: "How much did you pay in points?", type: "currency", hint: "Box 6 of Form 1098", field: "mortgage_points_amount", showIf: { field: "has_mortgage_points", value: "yes" } },
        // Property Taxes
        { question: "Did you pay property taxes on real estate?", type: "boolean", hint: "Real estate taxes on your home or other property", field: "has_property_tax" },
        { question: "How much did you pay in property taxes?", type: "currency", hint: "Your annual property tax bill(s)", field: "property_tax_amount", showIf: { field: "has_property_tax", value: "yes" } },
        // State & Local Taxes
        { question: "Did you pay state and local income taxes?", type: "boolean", hint: "Withheld from pay or paid directly to state", field: "has_state_income_tax" },
        { question: "How much state/local income tax did you pay?", type: "currency", hint: "Total state and local income taxes", field: "state_income_tax_amount", showIf: { field: "has_state_income_tax", value: "yes" } },
        { question: "Did you pay sales tax on major purchases?", type: "boolean", hint: "Can deduct sales tax OR income tax, not both", field: "has_sales_tax" },
        { question: "How much sales tax did you pay?", type: "currency", hint: "Total sales tax on major purchases", field: "sales_tax_amount", showIf: { field: "has_sales_tax", value: "yes" } },
        // Charitable Donations
        { question: "Did you make cash donations to charity?", type: "boolean", hint: "Cash, check, or credit card donations", field: "has_cash_charity" },
        { question: "How much did you donate in cash?", type: "currency", hint: "Total cash donations to qualified charities", field: "cash_charity_amount", showIf: { field: "has_cash_charity", value: "yes" } },
        { question: "Did you donate goods (clothing, furniture, etc.)?", type: "boolean", hint: "Non-cash donations to charity", field: "has_noncash_charity" },
        { question: "What was the fair market value of donated goods?", type: "currency", hint: "Value of items at time of donation", field: "noncash_charity_amount", showIf: { field: "has_noncash_charity", value: "yes" } },
        { question: "Did you drive for charitable purposes?", type: "boolean", hint: "Volunteer driving for charity (14 cents/mile)", field: "has_charity_miles" },
        { question: "How many miles did you drive for charity?", type: "number", hint: "Total miles driven for charitable purposes", field: "charity_miles", showIf: { field: "has_charity_miles", value: "yes" } },
        // Medical Expenses
        { question: "Did you have significant medical expenses?", type: "boolean", hint: "Only deductible if exceeding 7.5% of AGI", field: "has_medical" },
        { question: "What were your total medical expenses?", type: "currency", hint: "Doctor visits, prescriptions, insurance premiums, etc.", field: "medical_expenses_amount", showIf: { field: "has_medical", value: "yes" } },
        { question: "Did you pay health insurance premiums (not through employer)?", type: "boolean", hint: "Individual/marketplace health insurance", field: "has_health_insurance_premiums" },
        { question: "How much did you pay for health insurance premiums?", type: "currency", hint: "Total premiums paid (may be included in medical expenses)", field: "health_insurance_premium_amount", showIf: { field: "has_health_insurance_premiums", value: "yes" } },
        // Education
        { question: "Did you pay student loan interest?", type: "boolean", hint: "Form 1098-E (up to $2,500 deductible)", field: "has_student_loan_interest" },
        { question: "How much student loan interest did you pay?", type: "currency", hint: "Box 1 of Form 1098-E", field: "student_loan_interest_amount", showIf: { field: "has_student_loan_interest", value: "yes" } },
        { question: "Are you a teacher who paid for classroom supplies?", type: "boolean", hint: "Educator expense deduction (up to $300)", field: "is_educator" },
        { question: "How much did you spend on classroom supplies?", type: "currency", hint: "Out-of-pocket classroom expenses", field: "educator_expenses", showIf: { field: "is_educator", value: "yes" } },
        // Retirement Contributions
        { question: "Did you contribute to a Traditional IRA?", type: "boolean", hint: "May be deductible depending on income", field: "has_traditional_ira" },
        { question: "How much did you contribute to Traditional IRA?", type: "currency", hint: "2024 limit: $7,000 ($8,000 if 50+)", field: "traditional_ira_amount", showIf: { field: "has_traditional_ira", value: "yes" } },
        // HSA
        { question: "Did you contribute to a Health Savings Account (HSA)?", type: "boolean", hint: "Must have high-deductible health plan", field: "has_hsa" },
        { question: "How much did you contribute to your HSA?", type: "currency", hint: "2024 limit: $4,150 individual, $8,300 family", field: "hsa_contribution", showIf: { field: "has_hsa", value: "yes" } },
        // Self-Employment
        { question: "Did you pay self-employment health insurance premiums?", type: "boolean", hint: "If self-employed, premiums may be deductible", field: "has_se_health_insurance", showIf: { field: "has_self_employment", value: "yes" } },
        { question: "How much did you pay for self-employed health insurance?", type: "currency", hint: "Total premiums for you, spouse, dependents", field: "se_health_insurance_amount", showIf: { field: "has_se_health_insurance", value: "yes" } },
        // Alimony Paid
        { question: "Did you pay alimony to a former spouse?", type: "boolean", hint: "Only deductible if divorce was before 2019", field: "has_alimony_paid" },
        { question: "How much alimony did you pay?", type: "currency", hint: "Total alimony paid during the year", field: "alimony_paid", showIf: { field: "has_alimony_paid", value: "yes" } }
      ],
      credits: [
        // Child Tax Credit
        { question: "Do you have qualifying children under age 17?", type: "boolean", hint: "Child Tax Credit - $2,000 per qualifying child", field: "has_child_tax_credit" },
        { question: "How many children under 17 qualify?", type: "number", hint: "Must live with you and be your dependent", field: "num_children_under_17", showIf: { field: "has_child_tax_credit", value: "yes" } },
        // Child and Dependent Care
        { question: "Did you pay for childcare so you could work?", type: "boolean", hint: "Daycare, babysitter, after-school care, day camp", field: "has_childcare" },
        { question: "How much did you pay for childcare?", type: "currency", hint: "Total childcare expenses", field: "childcare_amount", showIf: { field: "has_childcare", value: "yes" } },
        { question: "What is the care provider's name?", type: "text", hint: "Name of daycare or individual", field: "childcare_provider_name", showIf: { field: "has_childcare", value: "yes" } },
        { question: "What is the care provider's Tax ID or SSN?", type: "text", hint: "Required for the credit", field: "childcare_provider_tin", showIf: { field: "has_childcare", value: "yes" } },
        // Education Credits
        { question: "Did you or a dependent pay for college or trade school?", type: "boolean", hint: "Form 1098-T from the school", field: "has_education_credit" },
        { question: "How much did you pay for tuition and fees?", type: "currency", hint: "From Form 1098-T", field: "education_expenses", showIf: { field: "has_education_credit", value: "yes" } },
        { question: "Is this the student's first 4 years of higher education?", type: "boolean", hint: "Determines which credit applies", field: "is_first_four_years", showIf: { field: "has_education_credit", value: "yes" } },
        { question: "Is the student enrolled at least half-time?", type: "boolean", hint: "Required for American Opportunity Credit", field: "is_half_time_student", showIf: { field: "has_education_credit", value: "yes" } },
        // Earned Income Credit
        { question: "Did you have earned income (wages or self-employment)?", type: "boolean", hint: "Earned Income Credit for low-moderate income", field: "check_eic" },
        { question: "Do you want us to check if you qualify for Earned Income Credit?", type: "boolean", hint: "Based on income and family size", field: "calculate_eic", showIf: { field: "check_eic", value: "yes" } },
        // Energy Credits
        { question: "Did you install solar panels on your home?", type: "boolean", hint: "Residential Clean Energy Credit (30%)", field: "has_solar" },
        { question: "What was the cost of your solar installation?", type: "currency", hint: "Total cost including installation", field: "solar_cost", showIf: { field: "has_solar", value: "yes" } },
        { question: "Did you make other energy improvements (windows, insulation, etc.)?", type: "boolean", hint: "Energy Efficient Home Improvement Credit", field: "has_energy_improvements" },
        { question: "How much did you spend on energy improvements?", type: "currency", hint: "Windows, doors, insulation, heat pumps, etc.", field: "energy_improvement_cost", showIf: { field: "has_energy_improvements", value: "yes" } },
        // Electric Vehicle
        { question: "Did you purchase a new electric vehicle?", type: "boolean", hint: "Clean Vehicle Credit (up to $7,500)", field: "has_ev_credit" },
        { question: "What is the VIN of the electric vehicle?", type: "text", hint: "Vehicle Identification Number", field: "ev_vin", showIf: { field: "has_ev_credit", value: "yes" } },
        { question: "What was the purchase price of the EV?", type: "currency", hint: "Must be under $55,000 (cars) or $80,000 (SUVs/trucks)", field: "ev_purchase_price", showIf: { field: "has_ev_credit", value: "yes" } },
        // Foreign Tax Credit
        { question: "Did you pay foreign taxes on foreign income?", type: "boolean", hint: "Taxes paid to foreign countries", field: "has_foreign_tax" },
        { question: "How much foreign tax did you pay?", type: "currency", hint: "Total foreign taxes paid", field: "foreign_tax_paid", showIf: { field: "has_foreign_tax", value: "yes" } },
        // Retirement Savers Credit
        { question: "Did you contribute to a retirement account (401k, IRA, etc.)?", type: "boolean", hint: "Saver's Credit for low-moderate income", field: "has_retirement_contribution" },
        { question: "How much did you contribute to retirement accounts?", type: "currency", hint: "Total contributions to all retirement accounts", field: "retirement_contribution_amount", showIf: { field: "has_retirement_contribution", value: "yes" } },
        // Premium Tax Credit
        { question: "Did you buy health insurance through the Marketplace (ACA)?", type: "boolean", hint: "Healthcare.gov or state exchange", field: "has_marketplace_insurance" },
        { question: "Did you receive advance Premium Tax Credit payments?", type: "boolean", hint: "Subsidies paid directly to insurer", field: "has_advance_ptc", showIf: { field: "has_marketplace_insurance", value: "yes" } }
      ],
      dependents: [
        { question: "How many dependents do you have in total?", type: "number", hint: "Children, relatives, or others you support", field: "total_dependents" },
        { question: "How many children do you have under age 17?", type: "number", hint: "For Child Tax Credit ($2,000 each)", field: "num_children_under_17", showIf: { field: "total_dependents", value: (v) => parseInt(v) > 0 } },
        { question: "How many children do you have age 17-18?", type: "number", hint: "For Other Dependent Credit ($500 each)", field: "num_children_17_18" },
        { question: "How many children do you have age 19-23 who are full-time students?", type: "number", hint: "May qualify as dependents", field: "num_college_students" },
        { question: "Do you have any other dependents (elderly parents, disabled relatives)?", type: "boolean", hint: "Other Dependent Credit may apply", field: "has_other_dependents" },
        { question: "How many other dependents do you have?", type: "number", hint: "Number of other qualifying dependents", field: "num_other_dependents", showIf: { field: "has_other_dependents", value: "yes" } },
        { question: "Do any of your dependents have a disability?", type: "boolean", hint: "Additional credits may be available", field: "has_disabled_dependent" },
        { question: "Did you pay more than half the cost of keeping up a home for a dependent?", type: "boolean", hint: "Important for Head of Household status", field: "paid_half_home_cost" }
      ],
      review: [
        { question: "Would you like to review your entries before finalizing?", type: "boolean", hint: "We'll show you a summary of all your information", field: "ready_to_review" }
      ]
    };

    const section = context.section || 'personal_info';
    const questions = sectionQuestions[section] || sectionQuestions.personal_info;
    const answeredFields = Object.keys(answers);

    // Find the first unanswered question, respecting showIf conditions
    for (const q of questions) {
      // Skip if already answered
      if (answeredFields.includes(q.field)) continue;

      // Check if this question has a showIf condition
      if (q.showIf) {
        const conditionField = q.showIf.field;
        const conditionValue = q.showIf.value;
        // Only show if the condition is met
        if (answers[conditionField] !== conditionValue) continue;
      }

      return q;
    }

    // If all questions answered, return completion message
    return {
      question: `You've completed all questions in the ${section.replace(/_/g, ' ')} section. Click "Complete Section" to continue.`,
      type: "info",
      hint: "Move to the next section when ready",
      field: "section_complete"
    };
  }
}

module.exports = new AIService();
