import type {
  ClimateBaseline,
  FarmWeatherAdvisory,
  FarmWeatherDay,
  FarmWeatherForecast,
  MonthlyClimateNormal
} from "@/types";

const HISTORY_YEARS = 20;
const FETCH_TIMEOUT_MS = 18_000;

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateParts(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

async function getJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "accept": "application/json" }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Weather service returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export async function getClimateBaseline(latitude: number, longitude: number): Promise<ClimateBaseline> {
  const endYear = new Date().getUTCFullYear() - 1;
  const startYear = endYear - (HISTORY_YEARS - 1);
  const periodStart = `${startYear}-01-01`;
  const periodEnd = `${endYear}-12-31`;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: periodStart,
    end_date: periodEnd,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "auto",
    models: "era5"
  });

  const data = await getJson(`https://archive-api.open-meteo.com/v1/archive?${params}`);
  const times: string[] = Array.isArray(data?.daily?.time) ? data.daily.time : [];
  const temperatures: unknown[] = Array.isArray(data?.daily?.temperature_2m_mean) ? data.daily.temperature_2m_mean : [];
  const precipitation: unknown[] = Array.isArray(data?.daily?.precipitation_sum) ? data.daily.precipitation_sum : [];

  if (!times.length) throw new Error("Historical climate data was not returned for this farm location.");

  const allTemperatures: number[] = [];
  const annualRainfall = new Map<number, number>();
  const monthlyRainfall = new Map<string, number>();
  const monthlyTemperatures = new Map<number, number[]>();

  times.forEach((time, index) => {
    const { year, month } = dateParts(time);
    const temp = finiteNumber(temperatures[index]);
    const rain = finiteNumber(precipitation[index]);

    if (temp != null) {
      allTemperatures.push(temp);
      const bucket = monthlyTemperatures.get(month) || [];
      bucket.push(temp);
      monthlyTemperatures.set(month, bucket);
    }
    if (rain != null) {
      annualRainfall.set(year, (annualRainfall.get(year) || 0) + rain);
      const key = `${year}-${month}`;
      monthlyRainfall.set(key, (monthlyRainfall.get(key) || 0) + rain);
    }
  });

  const annualValues = [...annualRainfall.values()];
  const averageTemperature = mean(allTemperatures);
  const averageRainfall = mean(annualValues);
  if (averageTemperature == null || averageRainfall == null) throw new Error("Climate averages could not be calculated for this location.");

  const monthly: MonthlyClimateNormal[] = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const rainfallForMonth: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      const value = monthlyRainfall.get(`${year}-${month}`);
      if (value != null) rainfallForMonth.push(value);
    }
    const monthlyTemp = mean(monthlyTemperatures.get(month) || []);
    const monthlyRain = mean(rainfallForMonth);
    return {
      month,
      rainfallMm: monthlyRain == null ? null : round(monthlyRain, 1),
      temperatureC: monthlyTemp == null ? null : round(monthlyTemp, 1)
    };
  });

  return {
    source: "Open-Meteo Historical Weather API",
    model: "ERA5",
    periodStart,
    periodEnd,
    years: annualValues.length,
    averageAnnualRainfallMm: round(averageRainfall, 0),
    averageTemperatureC: round(averageTemperature, 1),
    monthly,
    updatedAt: new Date()
  };
}

function dayAt(days: FarmWeatherDay[], index: number) {
  return days[index] || null;
}

function buildAdvisories(days: FarmWeatherDay[]): FarmWeatherAdvisory[] {
  const advisories: FarmWeatherAdvisory[] = [];
  const firstThree = days.slice(0, 3);
  const firstTwo = days.slice(0, 2);

  const heavy = firstThree.find(day => (day.precipitationMm ?? 0) >= 25);
  if (heavy) {
    advisories.push({
      id: "heavy-rain",
      level: "important",
      title: "Heavy rain is possible",
      message: `${formatDay(heavy.date)} is forecast to receive about ${Math.round(heavy.precipitationMm || 0)} mm of precipitation. Check drainage and avoid timing fertiliser or crop-protection applications immediately before heavy rain unless the product guidance specifically allows it.`
    });
  }

  const rainSoon = firstTwo.find(day => (day.precipitationProbability ?? 0) >= 65 && (day.precipitationMm ?? 0) >= 2);
  if (rainSoon && !heavy) {
    advisories.push({
      id: "rain-soon",
      level: "watch",
      title: "Rain is likely soon",
      message: `${formatDay(rainSoon.date)} has a ${Math.round(rainSoon.precipitationProbability || 0)}% rain probability. If planting is already planned and the field is ready, prepare for wet conditions and avoid leaving inputs exposed to rain.`
    });
  }

  const threeDayRain = firstThree.reduce((sum, day) => sum + (day.precipitationMm || 0), 0);
  const hottest = Math.max(...firstThree.map(day => day.temperatureMaxC ?? -Infinity));
  if (firstThree.length && threeDayRain < 3 && hottest >= 34) {
    advisories.push({
      id: "hot-dry",
      level: "watch",
      title: "Hot and dry conditions ahead",
      message: `The next three days are forecast to be mostly dry, with temperatures reaching about ${Math.round(hottest)}°C. Check soil moisture, young plants and irrigation availability before carrying out moisture-sensitive field activities.`
    });
  }

  const highEt = firstThree.find(day => (day.evapotranspirationMm ?? 0) >= 5 && (day.precipitationMm ?? 0) < 2);
  if (highEt && !advisories.some(item => item.id === "hot-dry")) {
    advisories.push({
      id: "water-loss",
      level: "info",
      title: "Watch soil moisture",
      message: `Estimated crop-water demand is relatively high around ${formatDay(highEt.date)} while little rain is forecast. Rainfed farms should monitor soil moisture and signs of crop water stress.`
    });
  }

  if (!advisories.length) {
    const today = dayAt(days, 0);
    advisories.push({
      id: "general",
      level: "info",
      title: "No major short-term weather alert",
      message: today
        ? `Today's forecast is about ${Math.round(today.temperatureMinC || 0)}–${Math.round(today.temperatureMaxC || 0)}°C with ${Math.round(today.precipitationMm || 0)} mm of precipitation. Continue checking the forecast before weather-sensitive farm work.`
        : "Continue checking the farm forecast before weather-sensitive activities."
    });
  }

  return advisories.slice(0, 3);
}

export function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function weatherCodeLabel(code: number | null) {
  if (code == null) return "Weather unavailable";
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed weather";
}

export async function getFarmWeatherForecast(latitude: number, longitude: number): Promise<FarmWeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7"
  });
  const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const daily = data?.daily || {};
  const times: string[] = Array.isArray(daily.time) ? daily.time : [];

  const days: FarmWeatherDay[] = times.map((date, index) => ({
    date,
    weatherCode: finiteNumber(daily.weather_code?.[index]),
    temperatureMaxC: finiteNumber(daily.temperature_2m_max?.[index]),
    temperatureMinC: finiteNumber(daily.temperature_2m_min?.[index]),
    precipitationMm: finiteNumber(daily.precipitation_sum?.[index]),
    rainMm: finiteNumber(daily.rain_sum?.[index]),
    precipitationProbability: finiteNumber(daily.precipitation_probability_max?.[index]),
    evapotranspirationMm: finiteNumber(daily.et0_fao_evapotranspiration?.[index]),
    windSpeedMaxKmh: finiteNumber(daily.wind_speed_10m_max?.[index])
  }));

  return {
    latitude: finiteNumber(data?.latitude) ?? latitude,
    longitude: finiteNumber(data?.longitude) ?? longitude,
    timezone: typeof data?.timezone === "string" ? data.timezone : "auto",
    current: {
      time: typeof data?.current?.time === "string" ? data.current.time : null,
      temperatureC: finiteNumber(data?.current?.temperature_2m),
      apparentTemperatureC: finiteNumber(data?.current?.apparent_temperature),
      precipitationMm: finiteNumber(data?.current?.precipitation),
      weatherCode: finiteNumber(data?.current?.weather_code),
      windSpeedKmh: finiteNumber(data?.current?.wind_speed_10m)
    },
    daily: days,
    advisories: buildAdvisories(days),
    source: "Open-Meteo Forecast API",
    fetchedAt: new Date().toISOString()
  };
}
