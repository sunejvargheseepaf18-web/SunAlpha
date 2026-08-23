import { ExploreItem, AppMode } from '../types';
import { EXPLORE_DATA } from '../constants';

export const fetchExploreContent = async (mode: AppMode): Promise<ExploreItem[]> => {
  // Simulate network delay
  
  // Filter content based on relevance to the current mode
  // Some content might be relevant to multiple modes
  return EXPLORE_DATA.filter(item => item.relevance.includes(mode)).map(item => ({
    ...item,
    // Add dynamic types for UI if needed
  })) as ExploreItem[];
};
