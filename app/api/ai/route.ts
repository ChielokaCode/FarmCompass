import { NextResponse } from "next/server";
import OpenAI from "openai";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { getCropBySlug } from "@/lib/crops";
import type { FarmProfile } from "@/types";
import { effectiveSoilPH, effectiveSoilType, soilPHSource } from "@/lib/soil";

export async function POST(req: Request) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured. Add it to .env.local to enable the FarmCompass assistant." }, { status: 503 });
    }

    const form = await req.formData();
    const question = String(form.get("question") || "").trim();
    const cropSlug = String(form.get("cropSlug") || "").trim();
    if (question.length < 2 || question.length > 2000) {
      return NextResponse.json({ error: "Please enter a question between 2 and 2000 characters." }, { status: 400 });
    }

    const db = await getDb();
    const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId: auth.user.id });
    if (!profile) return NextResponse.json({ error: "Add your farm details before using the personalised FarmCompass assistant." }, { status: 409 });
    const crop = cropSlug ? await getCropBySlug(cropSlug) : null;

    const context = {
      farm: {
        state: profile.state,
        lga: profile.lga,
        farmSizeHa: profile.farmSizeHa,
        soilType: effectiveSoilType(profile),
        pH: effectiveSoilPH(profile),
        pHSource: soilPHSource(profile),
        farmerProvidedSoilType: profile.soilType,
        farmerProvidedMeasuredPH: profile.pH,
        soilIntelligence: profile.soilIntelligence ? {
          source: profile.soilIntelligence.source,
          pH: profile.soilIntelligence.pH,
          soilType: profile.soilIntelligence.soilType,
          faoClassification: profile.soilIntelligence.faoClassification,
          physical: profile.soilIntelligence.physical,
          chemical: profile.soilIntelligence.chemical,
          water: profile.soilIntelligence.water,
          providerLatencySeconds: profile.soilIntelligence.providerLatencySeconds,
          fetchedAt: profile.soilIntelligence.fetchedAt
        } : null,
        irrigation: profile.irrigation,
        farmingGoal: profile.farmingGoal,
        plantingMonth: profile.plantingMonth,
        location: profile.latitude != null && profile.longitude != null ? {
          latitude: profile.latitude,
          longitude: profile.longitude,
          horizontalAccuracyM: profile.locationAccuracyM ?? null,
          altitudeM: profile.altitudeM ?? null,
          altitudeAccuracyM: profile.altitudeAccuracyM ?? null,
          capturedAt: profile.locationCapturedAt ?? null
        } : null,
        averageAnnualRainfallMm: profile.averageRainfallMm,
        averageTemperatureC: profile.averageTemperatureC,
        climateBaseline: profile.climateBaseline ? {
          model: profile.climateBaseline.model,
          periodStart: profile.climateBaseline.periodStart,
          periodEnd: profile.climateBaseline.periodEnd,
          years: profile.climateBaseline.years
        } : null
      },
      crop: crop ? {
        name: crop.name,
        scientificName: crop.scientificName,
        category: crop.category,
        suitableStates: crop.suitableStates,
        soilTypes: crop.soilTypes,
        pH: crop.pH,
        rainfallMm: crop.rainfallMm,
        temperatureC: crop.temperatureC,
        growthDuration: crop.growthDuration,
        yieldPotential: crop.yieldPotential,
        plantingSeason: crop.plantingSeason,
        irrigation: crop.irrigation,
        sections: crop.sections,
        source: crop.source
      } : null
    };

    const content: any[] = [{
      type: "input_text",
      text: `Farmer question: ${question}\n\nRetrieved FarmCompass context:\n${JSON.stringify(context, null, 2)}`
    }];

    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Image must be 4 MB or smaller." }, { status: 413 });
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return NextResponse.json({ error: "Only JPEG, PNG and WebP images are accepted." }, { status: 415 });
      const bytes = Buffer.from(await image.arrayBuffer());
      content.push({ type: "input_image", image_url: `data:${image.type};base64,${bytes.toString("base64")}`, detail: "auto" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      instructions: `You are the FarmCompass agricultural explanation assistant for Nigerian farmers. Treat the retrieved FarmCompass crop record and farmer-supplied farm profile as the factual source for the answer. Stored climate averages may come from an ERA5 historical baseline around the saved farm location; describe them as area-level estimates rather than physical measurements from the farm. GPS latitude, longitude and altitude may be supplied as device-reported context; altitude can be null on devices that do not provide it and must not be invented. Soil intelligence may come from the Kaegro Soil API for the saved coordinates. Treat Kaegro soil values as location-based estimates, not laboratory measurements. If the farmer supplied a measured soil pH, that measured value takes precedence over the location estimate. Do not claim to know the current weather unless current forecast data is explicitly supplied in the context; direct the farmer to the Farm Weather screen for live forecast information. Do not invent fertiliser rates, pesticide names, crop varieties, soil values or planting windows that are not supported by the supplied context. If the data does not answer the question, say what is missing. When interpreting an image, describe visual possibilities and uncertainty; do not claim laboratory diagnosis. For agrochemical or fertiliser guidance, retain source safety conditions and advise checking current NAFDAC registration, product labels, PPE and a soil test where relevant. Use clear English suitable for a farmer and explain the reason behind the guidance.`,
      input: [{ role: "user", content }]
    });

    const answer = response.output_text || "No answer was returned.";
    await db.collection("chatSessions").insertOne({
      userId: auth.user.id,
      farmId: String(profile._id),
      cropSlug: crop?.slug || null,
      question,
      answer,
      retrievedCropIds: crop ? [crop.slug] : [],
      hasImage: image instanceof File && image.size > 0,
      model: process.env.OPENAI_MODEL || "gpt-5",
      createdAt: new Date()
    });
    return NextResponse.json({ answer });
  } catch (error) {
    return serverError(error);
  }
}
