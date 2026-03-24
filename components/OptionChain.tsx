import React from 'react';
import { OptionChainRow, OptionContract } from '../types';
import { MousePointer2, TrendingUp, TrendingDown, Crosshair } from 'lucide-react';

interface OptionChainProps {
  data: OptionChainRow[];
  spotPrice: number;
  symbol: string;
  onSelectContract: (contract: OptionContract, symbol: string) => void;
}

export const OptionChain: React.FC<OptionChainProps> = ({ data, spotPrice, symbol, onSelectContract }) => {
  const handleRowClick = (contract: OptionContract) => {
    // Generate a synthetic symbol for the option
    // Format: SYMBOL YYMMDD STRIKE TYPE (Approximate for demo)
    const optSymbol = `${symbol} ${contract.strike} ${contract.type}`;
    onSelectContract(contract, optSymbol);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Bar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-800 text-sm flex items-center">
                    <Crosshair size={16} className="mr-1.5 text-blue-600" />
                    Option Chain
                </h3>
                <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">Exp: 25 MAY</span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 flex items-center shadow-sm">
                Spot: {spotPrice.toFixed(2)}
            </span>
        </div>
        
        {/* Table Header - Sticky */}
        <div className="flex-1 overflow-auto relative scrollbar-hide">
            <table className="w-full text-xs text-center border-collapse">
                <thead className="bg-white text-gray-500 font-semibold sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="p-2 border-b-2 border-emerald-500/20 bg-emerald-50/30 text-emerald-800 uppercase tracking-wider" colSpan={3}>CALLS (CE)</th>
                        <th className="p-2 bg-gray-100 border-b border-gray-200 text-gray-700">STRIKE</th>
                        <th className="p-2 border-b-2 border-red-500/20 bg-red-50/30 text-red-800 uppercase tracking-wider" colSpan={3}>PUTS (PE)</th>
                    </tr>
                    <tr className="border-b border-gray-200 text-[10px] uppercase tracking-tight bg-gray-50">
                        <th className="py-2 w-16 text-gray-400 font-medium">OI Lks</th>
                        <th className="py-2 w-12 text-gray-400 font-medium">IV</th>
                        <th className="py-2 w-20 text-emerald-700 font-bold bg-emerald-50/50">LTP</th>
                        
                        <th className="py-2 bg-gray-100"></th>
                        
                        <th className="py-2 w-20 text-red-700 font-bold bg-red-50/50">LTP</th>
                        <th className="py-2 w-12 text-gray-400 font-medium">IV</th>
                        <th className="py-2 w-16 text-gray-400 font-medium">OI Lks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {data.map((row) => {
                        const isATM = Math.abs(row.strike - spotPrice) < (data[1].strike - data[0].strike) / 1.5;
                        const isITM_CE = row.strike < spotPrice;
                        const isITM_PE = row.strike > spotPrice;

                        return (
                            <tr key={row.strike} className={`group transition-colors ${isATM ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                                {/* CE DATA */}
                                <td className={`py-2 relative border-r border-dashed border-gray-100 ${isITM_CE ? 'bg-emerald-50/10' : ''}`}>
                                    <span className="relative z-10 text-gray-600">{(row.ce.oi / 100000).toFixed(1)}</span>
                                    <div className="absolute inset-y-1 left-0 bg-emerald-100 opacity-20 rounded-r" style={{ width: `${Math.min(100, row.ce.oi/20000)}%` }}></div>
                                </td>
                                <td className={`py-2 text-gray-400 ${isITM_CE ? 'bg-emerald-50/10' : ''}`}>{row.ce.iv.toFixed(1)}</td>
                                <td 
                                    onClick={() => handleRowClick(row.ce)}
                                    className={`py-2 font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 border-l border-emerald-100 ${isITM_CE ? 'bg-emerald-50/30 text-emerald-700' : 'text-emerald-600'} hover:bg-emerald-100 hover:shadow-inner`}
                                >
                                    {row.ce.price.toFixed(2)}
                                </td>
                                
                                {/* Strike */}
                                <td className={`py-2 font-bold text-gray-700 border-x border-gray-200 relative ${isATM ? 'bg-blue-50 text-blue-700' : 'bg-gray-50'}`}>
                                    {row.strike}
                                    {isATM && <div className="absolute inset-0 border-x-2 border-blue-200 pointer-events-none"></div>}
                                </td>
                                
                                {/* PE DATA */}
                                <td 
                                    onClick={() => handleRowClick(row.pe)}
                                    className={`py-2 font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 border-r border-red-100 ${isITM_PE ? 'bg-red-50/30 text-red-700' : 'text-red-600'} hover:bg-red-100 hover:shadow-inner`}
                                >
                                    {row.pe.price.toFixed(2)}
                                </td>
                                <td className={`py-2 text-gray-400 ${isITM_PE ? 'bg-red-50/10' : ''}`}>{row.pe.iv.toFixed(1)}</td>
                                <td className={`py-2 relative border-l border-dashed border-gray-100 ${isITM_PE ? 'bg-red-50/10' : ''}`}>
                                    <span className="relative z-10 text-gray-600">{(row.pe.oi / 100000).toFixed(1)}</span>
                                    <div className="absolute inset-y-1 right-0 bg-red-100 opacity-20 rounded-l" style={{ width: `${Math.min(100, row.pe.oi/20000)}%` }}></div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        
        {/* Legend Footer */}
        <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-center space-x-4 text-[10px] text-gray-400">
             <div className="flex items-center"><div className="w-2 h-2 bg-emerald-100 mr-1 rounded"></div> ITM Call</div>
             <div className="flex items-center"><div className="w-2 h-2 bg-red-100 mr-1 rounded"></div> ITM Put</div>
             <div className="flex items-center"><div className="w-2 h-2 bg-blue-100 mr-1 rounded"></div> ATM</div>
        </div>
    </div>
  );
};
