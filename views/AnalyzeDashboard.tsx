
import React, { useEffect, useState } from 'react';
import { DonutChart, ComparisonLineChart } from '../components/Charts';
import { calculatePortfolio, fetchPortfolioHistory } from '../services/portfolioEngine';
import { getAdvisorReport, findingsToInsights, PortfolioReview } from '../services/portfolioAdvisorService';
import { buildPortfolioAnalytics } from '../services/portfolioAnalytics';
import { optimizePortfolio, OptimizationResult } from '../services/optimizerService';
import { OptimizerPanel } from '../components/OptimizerPanel';
import { buildIncomeReport, IncomeReport } from '../services/incomeService';
import { IncomePanel } from '../components/IncomePanel';
import { ContributionPlanner } from '../components/ContributionPlanner';
import { PerformanceMetrics } from '../domain/analytics/performance.engine';
import { PerformanceStats } from '../components/PerformanceStats';
import { calculateDrift } from '../services/rebalanceEngine';
import { calculateCapitalSnapshot } from '../services/capitalEngine';
import { getBrokerProfile } from '../services/brokerService';
import { runReport, getReports } from '../services/reports/reportService';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, BrainCircuit, LineChart, FileText, Download, Share2, ArrowLeft, Clock, RefreshCcw } from 'lucide-react';
import { Insight, PortfolioHistoryPoint, RebalanceSimulation, AnalysisReport, CapitalSnapshot, RebalanceSuggestion } from '../types';
import { RebalancePanel } from '../components/RebalancePanel';
import { CapitalMonitor } from '../components/CapitalMonitor';

// Reusable Report Viewer Component (same as before)
const ReportViewer: React.FC<{ report: AnalysisReport; onBack: () => void }> = ({ report, onBack }) => (
    <div className="animate-fade-in-up">
        <button onClick={onBack} className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div>
                    <div className="flex items-center space-x-2 mb-2">
                         <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">{report.type.replace('_', ' ')}</span>
                         <span className="text-xs text-gray-400 flex items-center"><Clock size={12} className="mr-1"/> {new Date(report.generatedAt).toLocaleString()}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
                    <p className="text-gray-500 mt-1">{report.summary}</p>
                </div>
                <div className="flex space-x-2">
                    <button className="flex items-center px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">
                        <Share2 size={16} className="mr-2"/> Share
                    </button>
                    <button className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm">
                        <Download size={16} className="mr-2"/> Export PDF
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-100 divide-x divide-gray-100">
                {report.metrics.map((m, i) => (
                    <div key={i} className="p-5 text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">{m.label}</p>
                        <p className={`text-xl font-bold ${m.status === 'POSITIVE' ? 'text-emerald-600' : m.status === 'NEGATIVE' ? 'text-red-600' : 'text-gray-800'}`}>
                            {m.value}
                        </p>
                        {m.delta && (
                            <p className="text-xs font-medium text-gray-400 mt-1">
                                {m.delta} vs last run
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Detailed Sections */}
            <div className="p-6 space-y-8">
                {report.sections.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">{section.title}</h3>
                        <p className="text-gray-600 leading-relaxed bg-blue-50/50 p-4 rounded-lg border border-blue-50">
                            {section.content}
                        </p>
                        
                        {/* Dynamic Items Renderer (Simplistic) */}
                        {section.items && section.items.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {section.items.map((item: any, i) => (
                                    <div key={i} className="bg-white border border-gray-200 p-3 rounded-lg text-sm shadow-sm">
                                        <div className="font-bold text-gray-700">{item.symbol || item.id}</div>
                                        <div className="text-gray-500 text-xs">{item.description || item.reason}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

interface AnalyzeDashboardProps {
    initialRebalanceIntent?: RebalanceSuggestion | null;
}

export const AnalyzeDashboard: React.FC<AnalyzeDashboardProps> = ({ initialRebalanceIntent }) => {
  const [viewMode, setViewMode] = useState<'LIVE' | 'REPORTS' | 'REBALANCE'>('LIVE');
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  
  // Live Data
  const [portfolio, setPortfolio] = useState<any>(null);
  const [capitalSnapshot, setCapitalSnapshot] = useState<CapitalSnapshot | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [review, setReview] = useState<PortfolioReview | null>(null);
  const [advisorNote, setAdvisorNote] = useState<string | null>(null);
  const [rebalanceSim, setRebalanceSim] = useState<RebalanceSimulation | null>(null);

  useEffect(() => {
    const init = async () => {
      const [p, h, savedReports, broker] = await Promise.all([
        calculatePortfolio(),
        fetchPortfolioHistory(6),
        getReports('PORTFOLIO_HEALTH'),
        getBrokerProfile()
      ]);
      setPortfolio(p);
      setHistory(h);
      // Real advisor review over the live holdings snapshot; the AI note
      // arrives with it (null offline — the findings stand alone).
      getAdvisorReport(p.positions).then(report => {
        setReview(report.review);
        setInsights(findingsToInsights(report.review));
        setAdvisorNote(report.narrative);
      });

      // Real analytics from live feed history (QuantStats-style). Replaces
      // the simulated chart and adds risk metrics when the feeds answer.
      buildPortfolioAnalytics(p.positions).then(analytics => {
          if (analytics) {
              setHistory(analytics.history);
              setPerfMetrics(analytics.metrics);
          }
      });

      // Data-driven allocation proposals (min-vol / max-Sharpe / risk parity)
      optimizePortfolio(p.positions).then(setOptimization);

      // Dividend income from real payout events (best-effort)
      buildIncomeReport(p.positions).then(setIncome);
      setReports(savedReports);
      
      const sim = calculateDrift(p.positions, 'AGGRESSIVE'); 
      setRebalanceSim(sim);

      if (p.positions.length > 0) {
        const cap = await calculateCapitalSnapshot(p.positions, broker);
        setCapitalSnapshot(cap);
      }

      // If we have an incoming intent from Explore, switch to Rebalance mode
      if (initialRebalanceIntent) {
          setViewMode('REBALANCE');
      }
    };
    init();
  }, [initialRebalanceIntent]); // Re-run if intent changes

  const handleRunNewReport = async () => {
      const rpt = await runReport('PORTFOLIO_HEALTH');
      setReports([rpt, ...reports]);
      setViewMode('REPORTS');
      setSelectedReport(rpt);
  };

  if (selectedReport) {
      return <ReportViewer report={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  if (!portfolio) return <div className="p-8 text-blue-600 animate-pulse">Analyzing portfolio...</div>;

  const allocationData = [
    { name: 'Equity', value: 65 },
    { name: 'Debt', value: 25 },
    { name: 'Gold', value: 5 },
    { name: 'Cash', value: 5 },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      
      {/* View Toggle Header */}
      <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('LIVE')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'LIVE' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  Live Analytics
              </button>
              <button 
                onClick={() => setViewMode('REPORTS')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'REPORTS' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  Report Library
              </button>
              <button 
                onClick={() => setViewMode('REBALANCE')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center ${viewMode === 'REBALANCE' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  {initialRebalanceIntent && <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />}
                  Simulator
              </button>
          </div>
          
          <button 
             onClick={handleRunNewReport}
             className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-200"
          >
              <FileText size={16} className="mr-2" />
              Generate Full Report
          </button>
      </div>

      {/* Reports Library View */}
      {viewMode === 'REPORTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.length === 0 && (
                  <div className="col-span-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                      <FileText size={48} className="mx-auto text-gray-300 mb-3"/>
                      <p className="text-gray-400 font-medium">No reports generated yet.</p>
                      <button onClick={handleRunNewReport} className="text-blue-600 font-bold hover:underline mt-2">Generate Now</button>
                  </div>
              )}
              {reports.map(rpt => (
                  <div key={rpt.id} onClick={() => setSelectedReport(rpt)} className="bg-white p-5 rounded-xl border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                          <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                              <FileText size={20} />
                          </div>
                          <span className="text-xs text-gray-400">{new Date(rpt.generatedAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-gray-800 mb-2">{rpt.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2">{rpt.summary}</p>
                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                          View Details <ArrowLeft size={12} className="ml-1 rotate-180" />
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* REBALANCE SIMULATOR MODE */}
      {viewMode === 'REBALANCE' && rebalanceSim && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {initialRebalanceIntent && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start">
                      <RefreshCcw className="text-blue-600 mt-1 mr-3" size={20} />
                      <div>
                          <h4 className="font-bold text-blue-900">Explore Mode Suggestion Active</h4>
                          <p className="text-sm text-blue-700 mt-1">
                              You are reviewing a tactical rebalance initiated from Explore: 
                              <strong> {initialRebalanceIntent.reason}</strong>
                          </p>
                      </div>
                  </div>
              )}
              <RebalancePanel simulation={rebalanceSim} />
          </div>
      )}

      {/* Live Dashboard View */}
      {viewMode === 'LIVE' && (
        <>
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Net Worth</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{(portfolio.totalValue + 1500000).toLocaleString()}</h3>
                <p className="text-xs text-blue-600 mt-2 font-medium">+12% vs last year</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Portfolio XIRR</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">18.4%</h3>
                <p className="text-xs text-gray-400 mt-2">Beating NIFTY 50 (14.2%)</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Realized P&L (FY)</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">₹45,230</h3>
                <p className="text-xs text-gray-400 mt-2">Tax Liability: ~₹4,500</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100">
                <p className="text-xs text-gray-500 font-semibold uppercase">Health Score</p>
                <div className="flex items-center mt-1">
                    <h3 className="text-2xl font-bold text-blue-600">85</h3>
                    <span className="text-gray-400 text-lg font-light">/100</span>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center"><CheckCircle size={12} className="mr-1"/> Good Diversification</p>
                </div>
            </div>

            {/* Capital Monitor & Rebalance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {capitalSnapshot && <CapitalMonitor snapshot={capitalSnapshot} />}
                {/* Minified Rebalance Panel Preview */}
                <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-5 flex flex-col justify-center items-center text-center">
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                        <RefreshCcw className="text-indigo-600" size={24} />
                    </div>
                    <h4 className="font-bold text-gray-800">Portfolio Drift: {rebalanceSim?.status}</h4>
                    <p className="text-sm text-gray-500 mb-4 max-w-xs">
                        Your allocation has drifted from the target. Review rebalancing options to reduce risk.
                    </p>
                    <button 
                        onClick={() => setViewMode('REBALANCE')}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors"
                    >
                        Review Simulator
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <LineChart size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Performance vs Benchmark</h3>
                            <p className="text-xs text-gray-500">Trailing 6 Months</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Alpha Generated</p>
                        <p className="font-bold text-emerald-600 text-lg">+4.2%</p>
                    </div>
                </div>
                <ComparisonLineChart data={history} height={300} />

                {perfMetrics && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <PerformanceStats metrics={perfMetrics} benchmarkName="NIFTY 50" />
                    </div>
                )}
                </div>

                {optimization && <OptimizerPanel result={optimization} />}

                {portfolio.positions.length > 0 && (
                    <ContributionPlanner positions={portfolio.positions} />
                )}

                {income && <IncomePanel report={income} />}

                {/* AI Insights Panel */}
                <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-2xl shadow-sm border border-blue-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <BrainCircuit className="text-blue-600" size={20} />
                        <h3 className="font-bold text-gray-800">Portfolio Advisor</h3>
                    </div>
                    {review && (
                        <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold font-mono ${review.healthScore >= 75 ? 'text-emerald-600' : review.healthScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                {review.healthScore}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                                review.grade === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : review.grade === 'NEEDS_ATTENTION' ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                                {review.grade.replace('_', ' ')}
                            </span>
                        </div>
                    )}
                </div>

                {advisorNote && (
                    <div className="mb-4 p-3 bg-white rounded-xl border border-blue-100 text-xs text-gray-600 leading-relaxed italic">
                        “{advisorNote}”
                    </div>
                )}

                {review && insights.length === 0 && (
                    <div className="mb-4 p-4 bg-white rounded-xl border border-emerald-100 text-sm text-emerald-700 flex items-center">
                        <CheckCircle size={16} className="mr-2 flex-shrink-0" />
                        No issues found — every advisor check passes on the current holdings.
                    </div>
                )}

                <div className="space-y-4">
                    {insights.map((insight) => (
                    <div key={insight.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                        {insight.impact === 'HIGH' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"/>}
                        {insight.impact === 'MEDIUM' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"/>}
                        {insight.impact === 'LOW' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"/>}
                        
                        <h4 className="font-bold text-gray-800 text-sm flex items-center">
                        {insight.type === 'RISK' && <AlertTriangle size={14} className="mr-1 text-red-500"/>}
                        {insight.type === 'OPPORTUNITY' && <TrendingUp size={14} className="mr-1 text-emerald-500"/>}
                        {insight.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                        {insight.description}
                        </p>
                    </div>
                    ))}
                </div>
                <button className="w-full mt-4 py-2 text-center text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors">
                    View Full Report
                </button>
                </div>
            </div>

            {/* Asset Allocation & Holdings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Asset Allocation Chart (Donut) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800">Asset Allocation</h3>
                </div>
                <div className="relative">
                    <DonutChart data={allocationData} height={250} />
                    {/* Center Text Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                        <div className="text-center">
                            <p className="text-xs text-gray-400">Equity</p>
                            <p className="text-xl font-bold text-gray-800">65%</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 leading-tight">
                        Your portfolio leans <span className="font-bold text-gray-700">Aggressive</span>. 
                        Consider rebalancing if your risk appetite is lower.
                    </p>
                </div>
                </div>

                {/* Holdings Table (Data Dense) */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Holdings Deep Dive</h3>
                    <button className="text-blue-600 text-sm font-medium">Download CSV</button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Instrument</th>
                            <th className="px-6 py-4 text-right">Avg Price</th>
                            <th className="px-6 py-4 text-right">CMP</th>
                            <th className="px-6 py-4 text-right">Weight</th>
                            <th className="px-6 py-4 text-right">XIRR</th>
                            <th className="px-6 py-4 text-right">P&L</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {portfolio.positions.map((pos: any) => (
                            <tr key={pos.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">
                                {pos.name}
                                <span className="block text-xs text-gray-400 font-normal">{pos.symbol}</span>
                            </td>
                            <td className="px-6 py-4 text-right">₹{pos.avgPrice.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">₹{pos.currentPrice.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">12.4%</td>
                            <td className="px-6 py-4 text-right text-emerald-600">22.1%</td>
                            <td className={`px-6 py-4 text-right font-medium ${pos.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toLocaleString()}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};
