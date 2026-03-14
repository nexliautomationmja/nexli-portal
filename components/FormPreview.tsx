'use client';
import React from 'react';
import { type TaxForm, getFormFields } from '../data/taxForms';

interface FormPreviewProps {
    form: TaxForm;
    data: Record<string, string>;
}

// Helper: render a value or empty underline
const Val: React.FC<{ value?: string; placeholder?: string; className?: string; mono?: boolean }> = ({ value, placeholder, className = '', mono }) => {
    const v = value || '';
    return (
        <span className={`${mono ? 'font-mono' : 'font-semibold'} ${v ? 'text-slate-900' : 'text-slate-400'} ${className}`}>
            {v || placeholder || '\u00A0'}
        </span>
    );
};

// Helper: bordered cell
const Cell: React.FC<{ label?: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
    <div className={`border border-slate-400 ${className}`}>
        {label && <div className="text-[11px] leading-tight text-slate-500 px-2 pt-1">{label}</div>}
        <div className="px-2 pb-1.5 text-sm min-h-[32px] flex items-end">{children}</div>
    </div>
);

// Helper: dotted line row (like IRS numbered lines)
const FormLine: React.FC<{ num: string | number; label: string; value?: string; bold?: boolean; indent?: boolean }> = ({ num, label, value, bold, indent }) => (
    <div className="flex items-baseline gap-2 py-[3px] group">
        <span className={`text-xs font-bold w-6 shrink-0 text-right ${bold ? 'text-slate-900' : 'text-slate-500'}`}>{num}</span>
        <span className={`text-[13px] ${indent ? 'pl-3' : ''} ${bold ? 'font-bold text-slate-900' : 'text-slate-700'} shrink-0`} style={{ width: '55%' }}>{label}</span>
        <span className="flex-1 border-b border-dotted border-slate-300 mx-1 mb-[2px]" />
        <span className={`text-sm font-mono w-24 text-right shrink-0 ${value ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
            {value || '\u00A0'}
        </span>
    </div>
);

// ═══════════════════════════════════════════════════════
// FORM 1040 — U.S. Individual Income Tax Return
// ═══════════════════════════════════════════════════════
const Form1040: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    const filingStatus = d('filing_status');
    return (
        <>
            {/* Header */}
            <div className="flex items-start border-b-[3px] border-slate-900 pb-3 mb-0">
                <div className="w-[22%]">
                    <p className="text-[11px] text-slate-500 leading-snug">Department of the Treasury</p>
                    <p className="text-[11px] text-slate-500 leading-snug">Internal Revenue Service</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">(99)</p>
                </div>
                <div className="flex-1 text-center">
                    <p className="text-xl font-black tracking-tight leading-tight text-slate-900">U.S. Individual Income Tax Return</p>
                    <p className="text-[11px] text-slate-500 mt-1">For the year Jan. 1–Dec. 31, 2025, or other tax year beginning _________, 2025, ending _________, 20__</p>
                </div>
                <div className="w-[18%] text-right">
                    <p className="text-[11px] text-slate-500">OMB No. 1545-0074</p>
                    <div className="inline-block border-2 border-slate-900 px-3 py-1 mt-1">
                        <p className="text-base font-black leading-none text-slate-900">2025</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">IRS Use Only—Do not write<br/>or staple in this space.</p>
                </div>
            </div>

            {/* Form number stripe */}
            <div className="flex items-stretch border-b-2 border-slate-900">
                <div className="bg-slate-900 text-white px-3 py-2 flex items-center">
                    <span className="text-2xl font-black tracking-tighter leading-none">1040</span>
                </div>
                <div className="flex-1 grid grid-cols-2 border-l border-slate-400">
                    <Cell label="Your first name and middle initial" className="border-0 border-r border-b border-slate-400">
                        <Val value={d('first_name')} placeholder="First name" />
                    </Cell>
                    <Cell label="Last name" className="border-0 border-b border-slate-400">
                        <Val value={d('last_name')} placeholder="Last name" />
                    </Cell>
                    <Cell label="Your social security number" className="border-0 border-r border-slate-400">
                        <Val value={d('ssn')} placeholder="XXX-XX-XXXX" mono />
                    </Cell>
                    <Cell label="Spouse's social security number" className="border-0 border-slate-400">
                        <Val placeholder="XXX-XX-XXXX" mono />
                    </Cell>
                </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-[auto_1fr] border-b-2 border-slate-900">
                <div className="bg-slate-900 text-white px-3 flex items-center" />
                <div className="grid grid-cols-3">
                    <Cell label="Home address (number and street). If you have a P.O. box, see instructions." className="col-span-2 border-0 border-r border-b border-slate-400">
                        <Val value={d('address')} placeholder="123 Main St" />
                    </Cell>
                    <Cell label="Apt. no." className="border-0 border-b border-slate-400">
                        <Val placeholder="" />
                    </Cell>
                    <Cell label="City, town, or post office" className="col-span-2 border-0 border-r border-slate-400">
                        <Val value={[d('city'), d('state')].filter(Boolean).join(', ')} placeholder="City, State" />
                    </Cell>
                    <Cell label="ZIP code" className="border-0 border-slate-400">
                        <Val value={d('zip')} placeholder="00000" mono />
                    </Cell>
                </div>
            </div>

            {/* Filing Status */}
            <div className="border-b-2 border-slate-900 py-3 px-3">
                <p className="text-[13px] font-black text-slate-900 mb-2">Filing Status. Check only one box.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {['Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household', 'Qualifying Surviving Spouse'].map(s => (
                        <label key={s} className="flex items-center gap-1.5 text-[13px] text-slate-700">
                            <span className={`w-4 h-4 border-2 ${filingStatus === s ? 'border-slate-900 bg-slate-900' : 'border-slate-400'} rounded-sm flex items-center justify-center`}>
                                {filingStatus === s && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                            </span>
                            {s}
                        </label>
                    ))}
                </div>
            </div>

            {/* Income */}
            <div className="border-b border-slate-400 py-2 relative">
                <div className="absolute left-0 top-0 bottom-0 w-7 bg-slate-100 border-r border-slate-400 flex items-center justify-center">
                    <span className="text-[11px] font-black text-slate-600 tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>INCOME</span>
                </div>
                <div className="pl-9 pr-2 space-y-0">
                    <FormLine num="1a" label="Wages, salaries, tips, etc. Attach Form(s) W-2" value={d('wages')} />
                    <FormLine num="2a" label="Tax-exempt interest" value="" />
                    <FormLine num="2b" label="Taxable interest" value={d('interest')} indent />
                    <FormLine num="3a" label="Qualified dividends" value="" />
                    <FormLine num="3b" label="Ordinary dividends" value={d('dividends')} indent />
                    <FormLine num="4a" label="IRA distributions" value="" />
                    <FormLine num="7" label="Capital gain or (loss). Attach Schedule D" value={d('capital_gains')} />
                    <FormLine num="8" label="Other income from Schedule 1, line 10" value={d('business_income')} />
                    <FormLine num="9" label="Total income. Add lines 1z through 8" value="" bold />
                </div>
            </div>

            {/* Tax & Credits */}
            <div className="border-b border-slate-400 py-2 relative">
                <div className="absolute left-0 top-0 bottom-0 w-7 bg-slate-100 border-r border-slate-400 flex items-center justify-center">
                    <span className="text-[11px] font-black text-slate-600 tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>TAX</span>
                </div>
                <div className="pl-9 pr-2 space-y-0">
                    <FormLine num="12" label="Standard deduction or itemized deductions (from Sch. A)" value="" />
                    <FormLine num="13" label="Qualified business income deduction (Sch. 8995)" value="" />
                    <FormLine num="15" label="Taxable income. Subtract line 14 from line 11" value="" bold />
                    <FormLine num="16" label="Tax (see instructions)" value="" />
                    <FormLine num="24" label="Total tax" value="" bold />
                </div>
            </div>

            {/* Payments */}
            <div className="border-b-2 border-slate-900 py-2 relative">
                <div className="absolute left-0 top-0 bottom-0 w-7 bg-slate-100 border-r border-slate-400 flex items-center justify-center">
                    <span className="text-[11px] font-black text-slate-600 tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>PAY</span>
                </div>
                <div className="pl-9 pr-2 space-y-0">
                    <FormLine num="25a" label="Federal income tax withheld from W-2s and 1099s" value={d('fed_tax_withheld')} />
                    <FormLine num="26" label="Estimated tax payments and amount applied from prior year" value={d('estimated_paid')} />
                    <FormLine num="33" label="Total payments" value="" bold />
                    <FormLine num="34" label="If line 33 is more than line 24, subtract. OVERPAID" value="" bold />
                    <FormLine num="37" label="Amount you owe. Subtract line 33 from line 24" value="" bold />
                </div>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════
// FORM W-2 — Wage and Tax Statement
// ═══════════════════════════════════════════════════════
const FormW2: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-0">
                <div>
                    <p className="text-[11px] text-slate-500">Department of the Treasury — Internal Revenue Service</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-black text-slate-900">Wage and Tax Statement</p>
                </div>
                <div className="text-right">
                    <p className="text-[11px] text-slate-500">OMB No. 1545-0008</p>
                    <span className="text-sm font-black text-slate-900 border-2 border-slate-900 px-2 py-0.5">2025</span>
                </div>
            </div>

            {/* W-2 Grid */}
            <div className="grid grid-cols-2 border-b border-slate-400">
                {/* Left column */}
                <div className="border-r border-slate-400">
                    <Cell label="a Employee's social security number" className="border-t-0 border-l-0 border-r-0">
                        <Val value={d('ee_ssn')} placeholder="XXX-XX-XXXX" mono className="text-base" />
                    </Cell>
                    <Cell label="b Employer identification number (EIN)" className="border-t-0 border-l-0 border-r-0">
                        <Val value={d('emp_ein')} placeholder="XX-XXXXXXX" mono className="text-sm" />
                    </Cell>
                    <Cell label="c Employer's name, address, and ZIP code" className="border-t-0 border-l-0 border-r-0 min-h-[56px]">
                        <div>
                            <Val value={d('emp_name')} placeholder="Employer Name" className="text-sm" /><br/>
                            <Val value={d('emp_address')} placeholder="Address" className="text-[13px]" />
                        </div>
                    </Cell>
                    <Cell label="e Employee's first name and initial     Last name" className="border-t-0 border-l-0 border-r-0">
                        <Val value={d('ee_name')} placeholder="Employee Name" className="text-sm" />
                    </Cell>
                </div>

                {/* Right column — numbered boxes */}
                <div>
                    <div className="grid grid-cols-2">
                        <Cell label="1  Wages, tips, other compensation" className="border-t-0 border-l-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('wages_box1')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                        <Cell label="2  Federal income tax withheld" className="border-t-0 border-l-0 border-r-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('fed_withheld_box2')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                    </div>
                    <div className="grid grid-cols-2">
                        <Cell label="3  Social security wages" className="border-t-0 border-l-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('ss_wages_box3')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                        <Cell label="4  Social security tax withheld" className="border-t-0 border-l-0 border-r-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('ss_tax_box4')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                    </div>
                    <div className="grid grid-cols-2">
                        <Cell label="5  Medicare wages and tips" className="border-t-0 border-l-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('medicare_wages_box5')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                        <Cell label="6  Medicare tax withheld" className="border-t-0 border-l-0 border-r-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val value={d('medicare_tax_box6')} placeholder="0.00" mono className="text-sm" />
                        </Cell>
                    </div>
                    <div className="grid grid-cols-2">
                        <Cell label="7  Social security tips" className="border-t-0 border-l-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val placeholder="0.00" mono className="text-sm" />
                        </Cell>
                        <Cell label="8  Allocated tips" className="border-t-0 border-l-0 border-r-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val placeholder="0.00" mono className="text-sm" />
                        </Cell>
                    </div>
                    <div className="grid grid-cols-2">
                        <Cell label="9  (blank)" className="border-t-0 border-l-0">
                            <Val placeholder="" />
                        </Cell>
                        <Cell label="10  Dependent care benefits" className="border-t-0 border-l-0 border-r-0">
                            <span className="text-xs text-slate-400 mr-0.5">$</span>
                            <Val placeholder="0.00" mono className="text-sm" />
                        </Cell>
                    </div>
                </div>
            </div>

            {/* Bottom boxes */}
            <div className="grid grid-cols-4">
                <Cell label="12a  See instructions for box 12" className="border-t-0 border-l-0">
                    <Val placeholder="" />
                </Cell>
                <Cell label="12b" className="border-t-0 border-l-0">
                    <Val placeholder="" />
                </Cell>
                <Cell label="13  Statutory / Retirement / Third-party sick pay" className="border-t-0 border-l-0 col-span-2 border-r-0">
                    <div className="flex gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1"><span className="w-4 h-4 border border-slate-400 inline-block rounded-sm" /> Statutory</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-4 border border-slate-400 inline-block rounded-sm" /> Retirement</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-4 border border-slate-400 inline-block rounded-sm" /> Third-party</span>
                    </div>
                </Cell>
            </div>

            {/* Form identifier */}
            <div className="mt-2 flex items-center justify-between">
                <p className="text-sm font-black text-slate-900">Form W-2</p>
                <p className="text-xs text-slate-400">Copy B — To Be Filed With Employee&apos;s FEDERAL Tax Return</p>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════
// FORM W-9 — Request for TIN and Certification
// ═══════════════════════════════════════════════════════
const FormW9: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    const taxClass = d('tax_class');
    return (
        <>
            {/* Header */}
            <div className="flex items-start border-b-[3px] border-slate-900 pb-3">
                <div className="w-[20%] border-r-2 border-slate-900 pr-2 mr-3 self-stretch flex flex-col justify-center">
                    <p className="text-3xl font-black leading-none text-slate-900">W-9</p>
                    <p className="text-[10px] text-slate-500 leading-snug mt-1">(Rev. March 2024)<br/>Department of the Treasury<br/>Internal Revenue Service</p>
                </div>
                <div className="flex-1 text-center">
                    <p className="text-lg font-black leading-tight text-slate-900">Request for Taxpayer<br/>Identification Number and Certification</p>
                    <p className="text-[11px] text-slate-500 mt-1">▶ Go to www.irs.gov/FormW9 for instructions and the latest information.</p>
                </div>
                <div className="w-[18%] text-right border-l-2 border-slate-900 pl-2 ml-3 self-stretch flex flex-col justify-center">
                    <p className="text-[11px] text-slate-500 leading-snug">Give Form to the<br/>requester. Do not<br/>send to the IRS.</p>
                </div>
            </div>

            {/* Line 1: Name */}
            <Cell label="1  Name (as shown on your income tax return). Name is required on this line; do not leave blank." className="border-l-0 border-r-0 border-t-0">
                <Val value={[d('first_name'), d('last_name')].filter(Boolean).join(' ')} placeholder="Full legal name" className="text-base" />
            </Cell>

            {/* Line 2: Business name */}
            <Cell label="2  Business name/disregarded entity name, if different from above" className="border-l-0 border-r-0 border-t-0">
                <Val placeholder="" className="text-base" />
            </Cell>

            {/* Line 3: Tax classification */}
            <div className="border-b border-slate-400 px-3 py-2">
                <p className="text-[11px] text-slate-500 mb-1.5">3  Check appropriate box for federal tax classification of the person whose name is entered on line 1.</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                        { val: 'Individual/Sole Proprietor', short: 'Individual/sole proprietor or single-member LLC' },
                        { val: 'C Corporation', short: 'C Corporation' },
                        { val: 'S Corporation', short: 'S Corporation' },
                        { val: 'Partnership', short: 'Partnership' },
                        { val: 'Trust/Estate', short: 'Trust/estate' },
                    ].map(c => (
                        <label key={c.val} className="flex items-center gap-1.5 text-xs text-slate-700">
                            <span className={`w-4 h-4 border-2 ${taxClass === c.val ? 'border-slate-900 bg-slate-900' : 'border-slate-400'} rounded-sm flex items-center justify-center`}>
                                {taxClass === c.val && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                            </span>
                            {c.short}
                        </label>
                    ))}
                    <label className="flex items-center gap-1.5 text-xs text-slate-700">
                        <span className={`w-4 h-4 border-2 ${taxClass?.startsWith('LLC') ? 'border-slate-900 bg-slate-900' : 'border-slate-400'} rounded-sm flex items-center justify-center`}>
                            {taxClass?.startsWith('LLC') && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                        </span>
                        LLC ▶ enter tax classification: ____
                    </label>
                </div>
            </div>

            {/* Line 4: Exemptions */}
            <div className="grid grid-cols-2 border-b border-slate-400">
                <Cell label="4  Exemptions (codes apply only to certain entities, not individuals)" className="border-t-0 border-l-0">
                    <Val value={d('exempt_payee')} placeholder="" />
                </Cell>
                <Cell label="Exemption from FATCA reporting code (if any)" className="border-t-0 border-l-0 border-r-0">
                    <Val value={d('fatca_code')} placeholder="" />
                </Cell>
            </div>

            {/* Line 5-6: Address */}
            <Cell label="5  Address (number, street, and apt. or suite no.)" className="border-l-0 border-r-0 border-t-0">
                <Val value={d('address')} placeholder="123 Main St" />
            </Cell>
            <Cell label="6  City, state, and ZIP code" className="border-l-0 border-r-0 border-t-0">
                <Val value={[d('city'), d('state'), d('zip')].filter(Boolean).join(', ')} placeholder="City, State ZIP" />
            </Cell>

            {/* Part I: TIN */}
            <div className="border-b border-slate-400 py-3 px-3 bg-slate-50">
                <p className="text-[13px] font-black text-slate-900 mb-2">Part I &nbsp;&nbsp; Taxpayer Identification Number (TIN)</p>
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-[11px] text-slate-600 mb-1">Social security number</p>
                        <div className="flex gap-[2px]">
                            {(d('tin') || d('ssn') || '         ').padEnd(9).split('').map((ch, i) => (
                                <React.Fragment key={i}>
                                    <span className="w-6 h-7 border border-slate-400 bg-white text-sm font-mono font-bold text-center flex items-center justify-center">
                                        {ch.trim() || '\u00A0'}
                                    </span>
                                    {(i === 2 || i === 4) && <span className="text-sm font-bold text-slate-400 mx-[2px]">–</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <p className="text-[13px] text-slate-500 font-bold">or</p>
                    <div>
                        <p className="text-[11px] text-slate-600 mb-1">Employer identification number</p>
                        <div className="flex gap-[2px]">
                            {('         ').split('').map((_, i) => (
                                <React.Fragment key={i}>
                                    <span className="w-6 h-7 border border-slate-400 bg-white text-sm font-mono text-center flex items-center justify-center">{'\u00A0'}</span>
                                    {i === 1 && <span className="text-sm font-bold text-slate-400 mx-[2px]">–</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Part II: Certification */}
            <div className="py-3 px-3 bg-slate-50">
                <p className="text-[13px] font-black text-slate-900 mb-1">Part II &nbsp;&nbsp; Certification</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">Under penalties of perjury, I certify that: (1) The number shown on this form is my correct taxpayer identification number, (2) I am not subject to backup withholding, (3) I am a U.S. citizen or other U.S. person, and (4) The FATCA code(s) entered on this form indicating that I am exempt from FATCA reporting is correct.</p>
                <div className="grid grid-cols-[1fr_120px] gap-4 mt-4 pt-3 border-t border-slate-400">
                    <div>
                        <div className="border-b-2 border-slate-900 h-8" />
                        <p className="text-[11px] text-slate-500 mt-1">Signature of U.S. person ▶</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-8" />
                        <p className="text-[11px] text-slate-500 mt-1">Date ▶</p>
                    </div>
                </div>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════
// FORM 2848 — Power of Attorney
// ═══════════════════════════════════════════════════════
const Form2848: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    return (
        <>
            {/* Header */}
            <div className="flex items-start border-b-[3px] border-slate-900 pb-3">
                <div className="w-[20%] border-r-2 border-slate-900 pr-2 mr-3 self-stretch flex flex-col justify-center">
                    <p className="text-2xl font-black leading-none text-slate-900">2848</p>
                    <p className="text-[10px] text-slate-500 leading-snug mt-1">(Rev. January 2021)<br/>Department of the Treasury<br/>Internal Revenue Service</p>
                </div>
                <div className="flex-1 text-center">
                    <p className="text-lg font-black leading-tight text-slate-900">Power of Attorney<br/>and Declaration of Representative</p>
                    <p className="text-[11px] text-slate-500 mt-1">▶ Go to www.irs.gov/Form2848 for instructions and the latest information.</p>
                </div>
                <div className="w-[18%] text-right border-l-2 border-slate-900 pl-2 ml-3 self-stretch flex flex-col justify-center">
                    <p className="text-[11px] text-slate-500 leading-snug">OMB No. 1545-0150</p>
                    <p className="text-[10px] text-slate-400 leading-snug mt-1">For IRS Use Only<br/>Received by:<br/>Function: ____<br/>Date: ____</p>
                </div>
            </div>

            {/* Part I: Power of Attorney */}
            <div className="bg-slate-100 border-b border-slate-400 px-3 py-1.5">
                <p className="text-[13px] font-black text-slate-900">Part I &nbsp;&nbsp; Power of Attorney</p>
            </div>

            {/* Line 1: Taxpayer info */}
            <div className="border-b border-slate-400 px-3 py-3">
                <p className="text-xs font-bold text-slate-700 mb-2">1 &nbsp; Taxpayer information. Taxpayer must sign and date this form on page 2, line 7.</p>
                <div className="grid grid-cols-[1fr_180px] gap-2">
                    <Cell label="Taxpayer name(s) and address">
                        <div>
                            <Val value={[d('first_name'), d('last_name')].filter(Boolean).join(' ')} placeholder="Taxpayer Name" className="text-sm" /><br/>
                            <Val value={d('address')} placeholder="Address" className="text-[13px]" /><br/>
                            <Val value={[d('city'), d('state'), d('zip')].filter(Boolean).join(', ')} placeholder="City, State ZIP" className="text-[13px]" />
                        </div>
                    </Cell>
                    <div className="space-y-2">
                        <Cell label="Taxpayer identification number(s)">
                            <Val value={d('ssn')} placeholder="XXX-XX-XXXX" mono className="text-sm" />
                        </Cell>
                        <Cell label="Daytime telephone number">
                            <Val placeholder="(555) 000-0000" />
                        </Cell>
                        <Cell label="Plan number (if applicable)">
                            <Val placeholder="" />
                        </Cell>
                    </div>
                </div>
            </div>

            {/* Line 2: Representative */}
            <div className="border-b border-slate-400 px-3 py-3">
                <p className="text-xs font-bold text-slate-700 mb-2">2 &nbsp; Representative(s) must sign and date this form on page 2, Part II.</p>
                <div className="grid grid-cols-[1fr_160px] gap-2">
                    <Cell label="Name and address">
                        <div>
                            <Val value={d('rep_name')} placeholder="Representative Name" className="text-sm" /><br/>
                            <Val value={d('rep_address')} placeholder="Address" className="text-[13px]" />
                        </div>
                    </Cell>
                    <div className="space-y-2">
                        <Cell label="CAF No.">
                            <Val value={d('rep_ptin')} placeholder="" mono />
                        </Cell>
                        <Cell label="PTIN">
                            <Val value={d('rep_ptin')} placeholder="" mono />
                        </Cell>
                        <Cell label="Telephone No.">
                            <Val value={d('rep_phone')} placeholder="" />
                        </Cell>
                    </div>
                </div>
            </div>

            {/* Line 3: Tax matters */}
            <div className="border-b border-slate-400 px-3 py-3">
                <p className="text-xs font-bold text-slate-700 mb-2">3 &nbsp; Tax matters</p>
                <div className="grid grid-cols-3 gap-2">
                    <Cell label="Type of Tax (Income, Employment, Excise, etc.)">
                        <Val value={d('tax_matters')} placeholder="Income" />
                    </Cell>
                    <Cell label="Tax Form Number (1040, 941, 720, etc.)">
                        <Val value={d('tax_matters')?.includes('1040') ? '1040' : d('tax_matters')?.includes('941') ? '941' : ''} placeholder="1040" />
                    </Cell>
                    <Cell label="Year(s) or Period(s)">
                        <Val value={d('years')} placeholder="2022, 2023, 2024" />
                    </Cell>
                </div>
            </div>

            {/* Line 5: Acts authorized */}
            <div className="border-b-2 border-slate-900 px-3 py-3">
                <p className="text-xs font-bold text-slate-700 mb-2">5 &nbsp; Specific acts authorized (check applicable boxes).</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {['Access my IRS records via Intermediate Service Provider', 'Authorize disclosure to third parties', 'Substitute or add representative(s)', 'Sign a return', 'Other acts authorized:'].map((act, i) => (
                        <label key={act} className="flex items-center gap-1.5 text-xs text-slate-700">
                            <span className={`w-4 h-4 border-2 ${i === 0 || i === 3 ? 'border-slate-900 bg-slate-900' : 'border-slate-400'} rounded-sm flex items-center justify-center`}>
                                {(i === 0 || i === 3) && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                            </span>
                            {act}
                        </label>
                    ))}
                </div>
            </div>

            {/* Signature area */}
            <div className="px-3 py-3">
                <p className="text-xs font-bold text-slate-700 mb-2">7 &nbsp; Signature of taxpayer(s).</p>
                <div className="grid grid-cols-[1fr_120px] gap-4">
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Signature ▶</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Date ▶</p>
                    </div>
                </div>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════
// FORM 9465 — Installment Agreement Request
// ═══════════════════════════════════════════════════════
const Form9465: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    return (
        <>
            {/* Header */}
            <div className="flex items-start border-b-[3px] border-slate-900 pb-3">
                <div className="w-[20%] border-r-2 border-slate-900 pr-2 mr-3 self-stretch flex flex-col justify-center">
                    <p className="text-2xl font-black leading-none text-slate-900">9465</p>
                    <p className="text-[10px] text-slate-500 leading-snug mt-1">(Rev. December 2024)<br/>Department of the Treasury<br/>Internal Revenue Service</p>
                </div>
                <div className="flex-1 text-center">
                    <p className="text-lg font-black leading-tight text-slate-900">Installment Agreement Request</p>
                    <p className="text-[11px] text-slate-500 mt-1">▶ Do not file this form if you are currently making payments on an installment agreement.</p>
                    <p className="text-[11px] text-slate-500">▶ Go to www.irs.gov/Form9465 for instructions and the latest information.</p>
                </div>
                <div className="w-[18%] text-right border-l-2 border-slate-900 pl-2 ml-3 self-stretch flex flex-col justify-center">
                    <p className="text-[11px] text-slate-500">OMB No. 1545-0074</p>
                </div>
            </div>

            {/* Taxpayer info */}
            <div className="grid grid-cols-[1fr_180px] border-b-2 border-slate-900">
                <Cell label="Your first name and middle initial" className="border-l-0 border-t-0">
                    <Val value={d('first_name')} placeholder="First Name" className="text-base" />
                </Cell>
                <Cell label="Your social security number" className="border-r-0 border-t-0">
                    <Val value={d('ssn')} placeholder="XXX-XX-XXXX" mono className="text-base" />
                </Cell>
            </div>
            <div className="grid grid-cols-[1fr_180px] border-b-2 border-slate-900">
                <Cell label="Last name" className="border-l-0 border-t-0">
                    <Val value={d('last_name')} placeholder="Last Name" className="text-base" />
                </Cell>
                <Cell label="Spouse's social security number" className="border-r-0 border-t-0">
                    <Val placeholder="XXX-XX-XXXX" mono className="text-base" />
                </Cell>
            </div>
            <Cell label="Home address (number and street)" className="border-l-0 border-r-0 border-t-0">
                <Val value={d('address')} placeholder="123 Main St" />
            </Cell>
            <Cell label="City, town or post office, state, and ZIP code" className="border-l-0 border-r-0 border-t-0 border-b-2 border-b-slate-900">
                <Val value={[d('city'), d('state'), d('zip')].filter(Boolean).join(', ')} placeholder="City, State ZIP" />
            </Cell>

            {/* Numbered lines */}
            <div className="px-3 py-2 space-y-0 border-b border-slate-400">
                <FormLine num="7" label="Tax periods for which this request is made" value={d('tax_periods')} />
                <FormLine num="8" label="Amount owed as shown on tax return(s)" value={d('total_balance') ? `$${d('total_balance')}` : ''} bold />
                <FormLine num="9a" label="Enter the amount of any payment you are making with your tax return(s)" value="" />
                <FormLine num="9b" label="Enter the amount of any payment you are making with this Form 9465" value="" />
                <FormLine num="10" label="Enter your proposed monthly payment amount" value={d('offer_amount') ? `$${d('offer_amount')}` : ''} bold />
                <FormLine num="11a" label="Enter the date you want to make your payment each month" value="" />
                <FormLine num="11b" label="Enter the date you want to make your first payment" value="" />
            </div>

            {/* Bank info */}
            <div className="px-3 py-3 border-b-2 border-slate-900">
                <p className="text-xs font-bold text-slate-700 mb-2">If you want to make your payments by direct debit from your bank account, complete lines 13a and 13b.</p>
                <div className="grid grid-cols-2 gap-2">
                    <Cell label="13a  Routing number">
                        <Val placeholder="" mono />
                    </Cell>
                    <Cell label="13b  Account number">
                        <Val placeholder="" mono />
                    </Cell>
                </div>
            </div>

            {/* Signature */}
            <div className="px-3 py-3">
                <div className="grid grid-cols-[1fr_120px] gap-4">
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Your signature ▶</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Date ▶</p>
                    </div>
                </div>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════
// FORM 1099-NEC / 1099 Series — Generic Box Layout
// ═══════════════════════════════════════════════════════
const Form1099: React.FC<FormPreviewProps> = ({ form, data }) => {
    const d = (key: string) => data[key] || '';
    const formNum = form.number.replace('1099-', '');
    return (
        <>
            {/* Top stripe */}
            <div className="flex items-center justify-between bg-red-700 text-white px-4 py-1.5 rounded-t-sm">
                <p className="text-xs font-bold tracking-wider">VOID</p>
                <p className="text-xs">CORRECTED (if checked) <span className="border-2 border-white w-4 h-4 inline-block rounded-sm align-middle ml-1" /></p>
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-[1fr_160px]">
                {/* Left: Payer/Recipient */}
                <div className="border-r border-slate-400">
                    <Cell label="PAYER'S name, street address, city or town, state or province, country, ZIP" className="border-l-0 border-t-0 min-h-[60px]">
                        <div>
                            <Val value={d('payer_name')} placeholder="Payer Name" className="text-sm" /><br/>
                            <Val value={d('payer_address')} placeholder="Payer Address" className="text-[13px]" />
                        </div>
                    </Cell>
                    <div className="grid grid-cols-2">
                        <Cell label="PAYER'S TIN" className="border-l-0 border-t-0">
                            <Val value={d('payer_tin')} placeholder="XX-XXXXXXX" mono />
                        </Cell>
                        <Cell label="RECIPIENT'S TIN" className="border-t-0">
                            <Val value={d('recipient_tin')} placeholder="XXX-XX-XXXX" mono />
                        </Cell>
                    </div>
                    <Cell label="RECIPIENT'S name" className="border-l-0 border-t-0">
                        <Val value={d('recipient_name')} placeholder="Recipient Name" className="text-base" />
                    </Cell>
                    <Cell label="Street address (including apt. no.)" className="border-l-0 border-t-0">
                        <Val value={d('recipient_address')} placeholder="Address" />
                    </Cell>
                    <Cell label="City or town, state or province, country, and ZIP" className="border-l-0 border-t-0 border-b-0">
                        <Val placeholder="City, State ZIP" />
                    </Cell>
                </div>

                {/* Right: Amount boxes */}
                <div>
                    <div className="bg-red-700 text-white px-2 py-1.5 text-center border-b border-slate-400">
                        <p className="text-sm font-black">1099-{formNum}</p>
                    </div>
                    <Cell label={`1  ${formNum === 'NEC' ? 'Nonemployee compensation' : formNum === 'INT' ? 'Interest income' : formNum === 'DIV' ? 'Total ordinary dividends' : formNum === 'MISC' ? 'Rents' : 'Amount'}`} className="border-r-0 border-t-0">
                        <span className="text-xs text-slate-400 mr-0.5">$</span>
                        <Val value={d('amount')} placeholder="0.00" mono className="text-base" />
                    </Cell>
                    <Cell label="2  Federal income tax withheld" className="border-r-0 border-t-0">
                        <span className="text-xs text-slate-400 mr-0.5">$</span>
                        <Val value={d('fed_withheld')} placeholder="0.00" mono className="text-base" />
                    </Cell>
                    <Cell label={`3  ${formNum === 'INT' ? 'Interest on U.S. Savings Bonds' : formNum === 'DIV' ? 'Qualified dividends' : 'Other income'}`} className="border-r-0 border-t-0">
                        <span className="text-xs text-slate-400 mr-0.5">$</span>
                        <Val placeholder="0.00" mono className="text-base" />
                    </Cell>
                    <Cell label="4  State tax withheld" className="border-r-0 border-t-0">
                        <span className="text-xs text-slate-400 mr-0.5">$</span>
                        <Val placeholder="0.00" mono className="text-base" />
                    </Cell>
                    <Cell label="5  State/Payer's state no." className="border-r-0 border-t-0 border-b-0">
                        <Val placeholder="" />
                    </Cell>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-400 px-3 py-1.5 flex items-center justify-between">
                <p className="text-sm font-black text-slate-900">Form 1099-{formNum}</p>
                <p className="text-xs text-slate-500">Copy B — For Recipient</p>
                <p className="text-xs text-slate-500">www.irs.gov/Form1099{formNum}</p>
            </div>
        </>
    );
};


// ═══════════════════════════════════════════════════════
// GENERIC FORM — clean official layout for all others
// ═══════════════════════════════════════════════════════
const GenericForm: React.FC<FormPreviewProps> = ({ form, data }) => {
    const fields = getFormFields(form);
    const sections = [...new Set(fields.map(f => f.section))];
    const isState = !!form.state;

    return (
        <>
            {/* Header */}
            <div className="flex items-start border-b-[3px] border-slate-900 pb-3">
                <div className="w-[20%] border-r-2 border-slate-900 pr-2 mr-3 self-stretch flex flex-col justify-center">
                    <p className="text-xl font-black leading-tight text-slate-900">{form.number.length > 10 ? form.number.substring(0, 10) : form.number}</p>
                    <p className="text-[10px] text-slate-500 leading-snug mt-1">{isState ? `${form.state}\nDepartment of Revenue` : '(Rev. 2025)\nDepartment of the Treasury\nInternal Revenue Service'}</p>
                </div>
                <div className="flex-1 text-center">
                    <p className="text-base font-black leading-tight text-slate-900">{form.name}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{form.description}</p>
                    {isState && <p className="text-[11px] text-slate-500">▶ See instructions for this form</p>}
                </div>
                <div className="w-[16%] text-right border-l-2 border-slate-900 pl-2 ml-3 self-stretch flex flex-col justify-center">
                    {!isState && <p className="text-[11px] text-slate-500 leading-snug">OMB No.<br/>1545-0074</p>}
                    <div className="inline-block border-2 border-slate-900 px-2 py-0.5 mt-1 ml-auto">
                        <p className="text-sm font-black leading-none text-slate-900">2025</p>
                    </div>
                </div>
            </div>

            {/* Form body */}
            <div className="space-y-0">
                {sections.map((section, si) => (
                    <div key={section}>
                        {/* Section header */}
                        <div className="bg-slate-100 border-b border-slate-400 px-3 py-1.5 flex items-center gap-2">
                            <span className="text-xs font-black text-slate-500">Part {['I', 'II', 'III', 'IV', 'V'][si] || si + 1}</span>
                            <span className="text-[13px] font-black text-slate-800">{section}</span>
                        </div>

                        {/* Fields */}
                        <div className="border-b border-slate-400">
                            {fields.filter(f => f.section === section).map((field, fi) => {
                                const value = data[field.id] || '';
                                if (field.type === 'select') {
                                    return (
                                        <div key={field.id} className="flex items-baseline gap-2 px-3 py-1 border-b border-slate-200 last:border-b-0">
                                            <span className="text-xs font-bold text-slate-500 w-6 shrink-0 text-right">{si * 10 + fi + 1}</span>
                                            <span className="text-[13px] text-slate-700 shrink-0" style={{ width: '45%' }}>{field.label}</span>
                                            <span className="flex-1 text-sm font-semibold text-slate-900 border-b border-slate-400 pb-[2px]">
                                                {value || <span className="text-slate-400">{field.placeholder || '\u00A0'}</span>}
                                            </span>
                                        </div>
                                    );
                                }
                                const isAmount = field.type === 'number';
                                return (
                                    <div key={field.id} className="flex items-baseline gap-2 px-3 py-1 border-b border-slate-200 last:border-b-0">
                                        <span className="text-xs font-bold text-slate-500 w-6 shrink-0 text-right">{si * 10 + fi + 1}</span>
                                        <span className="text-[13px] text-slate-700 shrink-0" style={{ width: '45%' }}>{field.label}</span>
                                        <span className="flex-1 border-b border-dotted border-slate-300 mx-1 mb-[2px]" />
                                        <span className={`text-sm shrink-0 text-right ${isAmount ? 'font-mono w-24' : 'w-28'} ${value ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                                            {isAmount && value ? `$${value}` : value || field.placeholder || '\u00A0'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Signature */}
            <div className="border-t-2 border-slate-900 px-3 pt-4 mt-0">
                <p className="text-xs font-black text-slate-700 mb-2">Sign Here</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">Under penalties of perjury, I declare that I have examined this form and accompanying schedules and statements, and to the best of my knowledge and belief, they are true, correct, and complete.</p>
                <div className="grid grid-cols-[1fr_1fr_100px] gap-4">
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Your signature</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Spouse&apos;s signature (if joint return)</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Date</p>
                    </div>
                </div>
                <div className="grid grid-cols-[1fr_140px_100px] gap-4 mt-4 pt-3 border-t border-slate-400">
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Paid preparer&apos;s signature</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">Firm&apos;s name ▶</p>
                    </div>
                    <div>
                        <div className="border-b-2 border-slate-900 h-10" />
                        <p className="text-[11px] text-slate-500 mt-1">PTIN</p>
                    </div>
                </div>
            </div>
        </>
    );
};


// ═══════════════════════════════════════════════════════
// MAIN EXPORT — routes to the right template
// ═══════════════════════════════════════════════════════
const FormPreview: React.FC<FormPreviewProps> = (props) => {
    const { form } = props;
    const num = form.number;

    // Pick template
    let FormTemplate: React.FC<FormPreviewProps>;
    if (num === '1040' || num === '1040-SR' || num === '1040-NR') {
        FormTemplate = Form1040;
    } else if (num.startsWith('W-2') && !num.includes('G')) {
        FormTemplate = FormW2;
    } else if (num === 'W-9') {
        FormTemplate = FormW9;
    } else if (num === '2848') {
        FormTemplate = Form2848;
    } else if (num === '9465') {
        FormTemplate = Form9465;
    } else if (num.startsWith('1099')) {
        FormTemplate = Form1099;
    } else {
        FormTemplate = GenericForm;
    }

    return (
        <div className="bg-white text-slate-900 shadow-2xl rounded-lg overflow-hidden border border-slate-300" style={{ fontFamily: "'Courier New', 'Liberation Mono', monospace" }}>
            {/* Paper with realistic padding */}
            <div className="p-6 sm:p-8 relative">
                {/* Subtle paper texture */}
                <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'4\' height=\'4\' viewBox=\'0 0 4 4\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 3h1v1H1V3zm2-2h1v1H3V1z\' fill=\'%23000\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }} />
                <FormTemplate {...props} />
                {/* Form footer */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-xs text-slate-400">Form {form.number} (Rev. 01-2025)</p>
                    <p className="text-xs text-slate-400">Cat. No. {Math.floor(Math.random() * 90000 + 10000)}X</p>
                    <p className="text-xs text-slate-400">{form.state ? `${form.state} DOR` : 'www.irs.gov'}</p>
                </div>
            </div>
        </div>
    );
};

export default FormPreview;
