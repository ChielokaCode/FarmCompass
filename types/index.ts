export type Role = "FARMER" | "ADMIN";

export type UserDoc = {
  _id?: unknown;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  onboardingCompleted?: boolean;
  onboardedAt?: Date;
  createdAt: Date;
};

export type FarmProfile = {
  _id?: unknown;
  userId: string;
  state: string;
  lga: string;
  farmSizeHa?: number | null;
  soilType?: string | null;
  pH?: number | null;
  irrigation: "rainfed" | "irrigated" | "mixed" | "unknown";
  farmingGoal?: string | null;
  plantingMonth?: string | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt: Date;
  updatedBy: "FARMER";
};

export type CropRecord = {
  _id?: unknown;
  slug: string;
  name: string;
  scientificName: string;
  category: string;
  localNames: Record<string, string>;
  description: string;
  suitableStates: string[];
  soilTypes: string[];
  pH: { min: number | null; optimal: number | null; max: number | null };
  rainfallMm: { min: number | null; optimal: number | null; max: number | null };
  temperatureC: { min: number | null; optimal: number | null; max: number | null };
  growthDuration: string;
  yieldPotential: string;
  plantingSeason: string;
  irrigation: string;
  sections: {
    farmerTips: string;
    fertiliser: string;
    pestDisease: string;
    varieties: string;
    plantingGuide: string;
    harvestStorage: string;
  };
  source: Record<string, unknown>;
  rawSource: string;
  active?: boolean;
};

export type RecommendationResult = {
  crop: CropRecord;
  score: number;
  reasons: string[];
  components: Record<string, number | null>;
};
