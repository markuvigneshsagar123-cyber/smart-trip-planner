export interface TripDetails {
  source: string;
  destination: string;
  days: number;
  travelers: number;
  transportMode: 'car' | 'bus' | 'train' | 'flight';
  budgetCategory: 'budget' | 'mid-range' | 'luxury';
  vehicleMileage?: number; // km per liter
  includeInsurance: boolean;
  insuranceCost: number;
}

export interface CostEstimation {
  fuelCost: number;
  accommodationCost: number;
  foodCost: number;
  otherExpenses: number;
  insuranceCost: number;
  totalCost: number;
  distance: number; // km
  duration: string;
}

export const BUDGET_RATES = {
  budget: { accommodation: 1500, food: 800, other: 500 },
  'mid-range': { accommodation: 4000, food: 2000, other: 1500 },
  luxury: { accommodation: 12000, food: 5000, other: 4000 },
};

export const FUEL_PRICE = 105; // Average fuel price
