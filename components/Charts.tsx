import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line, ComposedChart, PieChart, Pie, Cell, ReferenceArea, ReferenceLine
} from 'recharts';
import { CPRLevels } from '../types';

interface ChartProps {
  data: any[];
  color?: string; // Hex color
  colors?: string[]; // Array of hex colors for Pie/Donut
  type?: 'AREA' | 'BAR' | 'CANDLE' | 'LINE';
  height?: number;
  benchmarkData?: any[];
  cpr?: CPRLevels | null;
}

export const SimpleAreaChart: React.FC<ChartProps> = ({ data, color = '#10b981', height = 300 }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`color-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 12, fill: '#9ca3af'}} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
          />
          <YAxis 
            tick={{fontSize: 12, fill: '#9ca3af'}} 
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={color} 
            fillOpacity={1} 
            fill={`url(#color-${color.replace('#', '')})`} 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ComparisonLineChart: React.FC<ChartProps & { seriesNames?: [string, string] }> = ({ data, height = 300, seriesNames }) => {
  const [primaryName, secondaryName] = seriesNames ?? ['Your Portfolio', 'NIFTY 50'];
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 12, fill: '#9ca3af'}} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {month: 'short'})}
            minTickGap={30}
          />
          <YAxis 
            tick={{fontSize: 12, fill: '#9ca3af'}} 
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          />
          <Legend verticalAlign="top" height={36}/>
          <Line 
            type="monotone" 
            dataKey="portfolioValue"
            name={primaryName}
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="benchmarkValue"
            name={secondaryName}
            stroke="#94a3b8" 
            strokeWidth={2} 
            strokeDasharray="4 4" 
            dot={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ComparisonBarChart: React.FC<ChartProps> = ({ data, height = 300 }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
          <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
          <Tooltip cursor={{fill: 'transparent'}} />
          <Legend />
          <Bar dataKey="portfolio" fill="#3b82f6" name="Your Portfolio" radius={[4, 4, 0, 0]} />
          <Bar dataKey="benchmark" fill="#94a3b8" name="Benchmark" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Custom Tooltip for Donut Chart to show Percentage
const CustomDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg">
        <p className="text-sm font-bold text-gray-800">{data.name}</p>
        <p className="text-xs text-gray-500">Allocation: <span className="font-mono font-bold text-blue-600">{data.value}%</span></p>
      </div>
    );
  }
  return null;
};

export const DonutChart: React.FC<ChartProps> = ({ data, colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'], height = 300 }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomDonutTooltip />} />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TechChart: React.FC<ChartProps> = ({ data, height = 400, cpr }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 11, fill: '#94a3b8'}} 
            tickLine={false}
            axisLine={{stroke: '#334155'}}
            tickFormatter={(value) => value.substring(5)}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            orientation="right" 
            tick={{fontSize: 11, fill: '#94a3b8'}}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          <Line type="monotone" dataKey="close" stroke="#f97316" strokeWidth={2} dot={false} name="Price" />
          <Line type="monotone" dataKey="close" stroke="#22c55e" strokeWidth={1} strokeDasharray="5 5" dot={false} name="EMA 20" />
          
          {cpr && (
            <>
              {/* Shade the CPR Zone */}
              {/* recharts 3.x typings omit SVG presentation props here; they
                  are valid at runtime, so pass them through a spread. */}
              <ReferenceArea
                y1={cpr.bc}
                y2={cpr.tc}
                {...({ fill: '#6366f1', fillOpacity: 0.15, strokeOpacity: 0 } as any)}
              />
              {/* Draw Lines */}
              <ReferenceLine y={cpr.tc} stroke="#6366f1" strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'right', value: 'TC', fill: '#6366f1', fontSize: 10 }} />
              <ReferenceLine y={cpr.pivot} stroke="#a855f7" strokeWidth={1} strokeOpacity={0.8} label={{ position: 'right', value: 'P', fill: '#a855f7', fontSize: 10 }} />
              <ReferenceLine y={cpr.bc} stroke="#6366f1" strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'right', value: 'BC', fill: '#6366f1', fontSize: 10 }} />
            </>
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
