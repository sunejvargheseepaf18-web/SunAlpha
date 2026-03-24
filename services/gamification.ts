import { UserProgress } from '../types';
import { MOCK_USER_PROGRESS } from '../constants';

// In a real app, this would fetch from backend based on user ID
export const fetchUserProgress = async (): Promise<UserProgress> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_USER_PROGRESS;
};

export const calculateProgressPercentage = (current: number, max: number) => {
  return Math.min(100, Math.max(0, (current / max) * 100));
};
