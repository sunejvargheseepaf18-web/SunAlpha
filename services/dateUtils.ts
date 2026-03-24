
import { PeriodContext, PeriodType } from '../types';

/**
 * Returns the Financial Year label for a given date.
 * Indian FY starts April 1.
 * e.g., March 2024 -> FY 2023-24
 * e.g., April 2024 -> FY 2024-25
 */
export const getFYLabel = (date: Date): string => {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();
    const startYear = month < 3 ? year - 1 : year; // Jan-Mar belongs to prev year
    return `${startYear}-${(startYear + 1).toString().slice(2)}`;
};

/**
 * Returns the start and end dates for a given FY label (e.g., "2023-24")
 */
export const getFYRange = (fyLabel: string): { start: string, end: string } => {
    const startYear = parseInt(fyLabel.split('-')[0]);
    return {
        start: `${startYear}-04-01`,
        end: `${startYear + 1}-03-31`
    };
};

/**
 * Generates the current active financial year context
 */
export const getCurrentFY = (): PeriodContext => {
    const now = new Date();
    const label = `FY ${getFYLabel(now)}`;
    const { start, end } = getFYRange(getFYLabel(now));
    
    return {
        type: 'FY',
        label: label,
        startDate: start,
        endDate: end,
        fyLabel: getFYLabel(now)
    };
};

/**
 * Helper to get available Financial Years for selection (e.g., current + last 2)
 */
export const getAvailableFYs = (count: number = 3): PeriodContext[] => {
    const fys: PeriodContext[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
        // Shift date back by 1 year each iteration
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - i);
        
        const fyLabelStr = getFYLabel(d);
        const { start, end } = getFYRange(fyLabelStr);
        
        fys.push({
            type: 'FY',
            label: `FY ${fyLabelStr}`,
            startDate: start,
            endDate: end,
            fyLabel: fyLabelStr
        });
    }
    return fys;
};

/**
 * Helper to get quarters for a specific FY
 */
export const getQuartersForFY = (fyLabel: string): PeriodContext[] => {
    const startYear = parseInt(fyLabel.split('-')[0]);
    
    return [
        { 
            type: 'QTR', label: `Q1 (Apr-Jun)`, 
            startDate: `${startYear}-04-01`, endDate: `${startYear}-06-30`, fyLabel 
        },
        { 
            type: 'QTR', label: `Q2 (Jul-Sep)`, 
            startDate: `${startYear}-07-01`, endDate: `${startYear}-09-30`, fyLabel 
        },
        { 
            type: 'QTR', label: `Q3 (Oct-Dec)`, 
            startDate: `${startYear}-10-01`, endDate: `${startYear}-12-31`, fyLabel 
        },
        { 
            type: 'QTR', label: `Q4 (Jan-Mar)`, 
            startDate: `${startYear + 1}-01-01`, endDate: `${startYear + 1}-03-31`, fyLabel 
        },
    ];
};
