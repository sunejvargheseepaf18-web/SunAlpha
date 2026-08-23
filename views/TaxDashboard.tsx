
import React, { useEffect, useState } from 'react';
import { calculateTaxReport } from '../services/taxEngine';
import { calculatePortfolio } from '../services/portfolioEngine';
import { TaxSummary, PeriodContext } from '../types';
import { getCurrentFY } from '../services/dateUtils';
import { PeriodSelector } from '../components/PeriodSelector';
import { Calculator, FileText, Download, AlertTriangle, TrendingDown, ArrowRight, Shield, BadgePercent, CalendarClock } from 'lucide-react';

export const TaxDashboard = () => {
  const [report, setReport] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodContext>(getCurrentFY());

  // Re-fetch when period changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const pf = await calculatePortfolio();
      const taxData = await calculateTaxReport(pf.positions, currentPeriod);
      setReport(taxData);
      setLoading(false);
    };
    fetchData();
  }, [currentPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Calculator className="mr-2 text-blue-600" size={24} /> 
              Tax Center
           </h2>
           <p className="text-gray-500 mt-1">Real-time tax liability estimation and harvesting.</p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <PeriodSelector onPeriodChange={setCurrentPeriod} />
            <button className="flex items-center space-x-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700">
                <Download size={16} />
                <span>Export</span>
            </button>
        </div>
      </div>

      {/* Loading State Overlay */}
      {loading && (
          <div className="p-8 text-blue-600 animate-pulse text-center">
              Processing Tax Data for {currentPeriod.label}...
          </div>
      )}

      {/* Report Content */}
      {!loading && report && (
        <>
            {/* Period Context Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 flex items-center justify-between text-sm text-blue-800">
                <div className="flex items-center">
                    <CalendarClock size={16} className="mr-2" />
                    <span className="font-semibold mr-2">{report.period.label}:</span> 
                    <span>{new Date(report.period.startDate).toLocaleDateString()} to {new Date(report.period.endDate).toLocaleDateString()}</span>
                </div>
                {report.period.type === 'FY' && <span className="text-xs uppercase bg-white/50 px-2 py-0.5 rounded font-bold">Assessment Year {parseInt(report.period.fyLabel!.split('-')[0]) + 1}-{parseInt(report.period.fyLabel!.split('-')[1]) + 1}</span>}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100">
                <p className="text-xs text-gray-500 font-bold uppercase">Estimated Tax Liability</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">₹{report.estimatedTotalTax.toLocaleString()}</h3>
                <p className="text-xs text-red-500 mt-2 font-medium">For selected period</p>
                </div>
                
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 font-bold uppercase">Realized Gains (Equity)</p>
                <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">STCG (15%)</span>
                        <span className={`font-mono font-bold ${report.realizedSTCG >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ₹{report.realizedSTCG.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">LTCG (10%)</span>
                        <span className={`font-mono font-bold ${report.realizedLTCG >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ₹{report.realizedLTCG.toLocaleString()}
                        </span>
                    </div>
                </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 font-bold uppercase">Business Income (F&O)</p>
                <h3 className={`text-2xl font-bold mt-2 ${report.businessIncome >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                    {report.businessIncome < 0 ? '-' : ''}₹{Math.abs(report.businessIncome).toLocaleString()}
                </h3>
                <p className="text-xs text-gray-400 mt-2">Turnover: ₹{(Math.abs(report.businessIncome) * 12).toLocaleString()}</p>
                </div>

                <div className="bg-blue-50 p-5 rounded-xl shadow-sm border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-blue-700 font-bold uppercase">Tax Saving Potential</p>
                    <BadgePercent size={18} className="text-blue-600"/>
                </div>
                <h3 className="text-2xl font-bold text-blue-700">
                    ₹{report.harvestingOpportunities.reduce((sum, op) => sum + op.potentialTaxSave, 0).toLocaleString()}
                </h3>
                <p className="text-xs text-blue-600 mt-2">via Loss Harvesting</p>
                </div>
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left: Detailed Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Harvesting Widget */}
                    {report.harvestingOpportunities.length > 0 && (
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-emerald-900 flex items-center">
                                    <TrendingDown className="mr-2" size={20} />
                                    Tax Loss Harvesting Opportunities
                                </h3>
                                <p className="text-sm text-emerald-700 mt-1">
                                    Book losses in these holdings to offset your realized gains and reduce tax liability.
                                </p>
                            </div>
                            <Shield size={24} className="text-emerald-300" />
                        </div>
                        
                        <div className="bg-white rounded-lg border border-emerald-100 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-emerald-50 text-emerald-800 font-medium">
                                    <tr>
                                    <th className="px-4 py-2 text-left">Stock</th>
                                    <th className="px-4 py-2 text-right">Unrealized Loss</th>
                                    <th className="px-4 py-2 text-center">Type</th>
                                    <th className="px-4 py-2 text-right">Tax Save</th>
                                    <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {report.harvestingOpportunities.map((op, idx) => (
                                        <tr key={idx}>
                                        <td className="px-4 py-3 font-medium text-gray-900">{op.symbol} <span className="text-gray-400 font-normal">({op.quantity} Qty)</span></td>
                                        <td className="px-4 py-3 text-right text-red-500 font-mono">₹{Math.abs(op.unrealizedLoss).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{op.term}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-emerald-600 font-bold">₹{op.potentialTaxSave.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 flex items-center ml-auto">
                                                Sell <ArrowRight size={12} className="ml-1" />
                                            </button>
                                        </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex items-start text-xs text-emerald-700/70">
                            <AlertTriangle size={12} className="mr-1 mt-0.5" />
                            Disclaimer: Tax harvesting involves selling assets. Ensure this aligns with your investment goals.
                        </div>
                        </div>
                    )}

                    {/* Gain Harvesting: use the tax-free LTCG exemption */}
                    {report.gainHarvestingOpportunities && report.gainHarvestingOpportunities.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                            <h3 className="font-bold text-blue-900">LTCG Exemption Harvesting (₹1.25L / FY)</h3>
                            <p className="text-sm text-blue-700 mt-1 mb-4">
                                Realize long-term gains inside the annual exemption at 0% tax, then rebuy after a day to step up your cost basis.
                            </p>
                            <div className="space-y-2">
                                {report.gainHarvestingOpportunities.map((op, idx) => (
                                    <div key={idx} className="bg-white rounded-lg border border-blue-100 p-3">
                                        <div className="flex justify-between text-sm font-medium text-gray-900">
                                            <span>{op.symbol}</span>
                                            <span className="text-blue-700 font-bold">saves ~₹{op.taxSaved.toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{op.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Taxable Events */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Taxable Transactions ({report.period.label})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            {report.history.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm italic">
                                    No taxable transactions found in this period.
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium">
                                        <tr>
                                        <th className="px-6 py-3">Asset</th>
                                        <th className="px-6 py-3 text-center">Type</th>
                                        <th className="px-6 py-3 text-center">Term</th>
                                        <th className="px-6 py-3 text-right">Sell Date</th>
                                        <th className="px-6 py-3 text-right">Net P&L</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {report.history.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 font-medium text-gray-900">
                                                {tx.symbol}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`text-xs px-2 py-0.5 rounded ${tx.assetClass === 'FNO' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {tx.assetClass}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center text-gray-500 text-xs">
                                                {tx.term}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-500 font-mono">
                                                {tx.sellDate}
                                            </td>
                                            <td className={`px-6 py-3 text-right font-mono font-medium ${tx.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {tx.pnl >= 0 ? '+' : ''}₹{tx.pnl.toLocaleString()}
                                            </td>
                                        </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Rules & Breakdown */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                            <FileText className="mr-2 text-gray-400" size={18} />
                            Carry Forward Losses
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">STCG Loss</span>
                                <span className="font-mono font-bold text-gray-900">₹{report.lossCarryForward.stcg.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">LTCG Loss</span>
                                <span className="font-mono font-bold text-gray-900">₹{report.lossCarryForward.ltcg.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">Business Loss</span>
                                <span className="font-mono font-bold text-gray-900">₹{report.lossCarryForward.business.toLocaleString()}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3">
                            Losses can be carried forward for 8 assessment years if return is filed on time.
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-lg">
                        <h4 className="font-bold mb-4">Tax Rules Applied</h4>
                        <ul className="space-y-3 text-sm text-slate-300">
                            <li className="flex items-start">
                                <span className="bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 flex-shrink-0">1</span>
                                <span><strong>Equity LTCG:</strong> 10% on gains above ₹1 Lakh. (Holding &gt; 12 months)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 flex-shrink-0">2</span>
                                <span><strong>Equity STCG:</strong> 15% flat rate. (Holding &lt; 12 months)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 flex-shrink-0">3</span>
                                <span><strong>F&O / Intraday:</strong> Treated as Business Income, taxed at slab rates.</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-yellow-800 leading-relaxed">
                        <strong>Important Disclaimer:</strong> SunAlpha provides tax analytics for informational purposes only. We are not tax advisors. Please consult a CA before filing your returns.
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};
