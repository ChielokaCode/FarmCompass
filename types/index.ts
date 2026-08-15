export type Role = "FARMER" | "ADMIN";

export type UserDoc = {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  onboardingCompleted?: boolean;
  onboardedAt?: Date;
  createdAt: Date;
};

export type MonthlyClimateNormal = {
  month: number;
  rainfallMm: number | null;
  temperatureC: number | null;
};

export type ClimateBaseline = {
  source: "Open-Meteo Historical Weather API";
  model: "ERA5";
  periodStart: string;
  periodEnd: string;
  years: number;
  averageAnnualRainfallMm: number;
  averageTemperatureC: number;
  monthly: MonthlyClimateNormal[];
  updatedAt: Date | string;
};


export type SoilIntelligence = {
  source: "Kaegro Soil API";
  endpoint: string;
  latitude: number;
  longitude: number;
  pH: number | null;
  soilType: string | null;
  attributes: Record<string, string | number | boolean | null>;
  fetchedAt: Date | string;
};

export type FarmProfile = {
  userId: string;
  state: string;
  lga: string;
  farmSizeHa?: number | null;
  soilType?: string | null;
  pH?: number | null;
  irrigation: "rainfed" | "irrigated" | "mixed" | "unknown";
  farmingGoal?: string | null;
  plantingMonth?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  altitudeM?: number | null;
  altitudeAccuracyM?: number | null;
  locationCapturedAt?: Date | string | null;
  averageRainfallMm?: number | null;
  averageTemperatureC?: number | null;
  climateBaseline?: ClimateBaseline | null;
  soilIntelligence?: SoilIntelligence | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt: Date;
  updatedBy: "FARMER";
};

export type CropRecord = {
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

export type FarmWeatherDay = {
  date: string;
  weatherCode: number | null;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  precipitationProbability: number | null;
  evapotranspirationMm: number | null;
  windSpeedMaxKmh: number | null;
};

export type FarmWeatherAdvisory = {
  id: string;
  level: "info" | "watch" | "important";
  title: string;
  message: string;
};

export type FarmWeatherForecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string | null;
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    precipitationMm: number | null;
    weatherCode: number | null;
    windSpeedKmh: number | null;
  };
  daily: FarmWeatherDay[];
  advisories: FarmWeatherAdvisory[];
  source: "Open-Meteo Forecast API";
  fetchedAt: string;
};
