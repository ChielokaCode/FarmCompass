import OpenAI from "openai";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCropBySlug } from "@/lib/crops";
import { effectiveSoilPH, effectiveSoilType } from "@/lib/soil";
import type {
  CropCycle,
  FarmProfile,
  FarmTask,
  FarmTaskSourceSection,
  InAppNotification
} from "@/types";

const LAGOS_OFFSET = "+01:00";
const SOURCE_SECTIONS: FarmTaskSourceSection[] = [
  "Farmer tips",
  "Fertiliser and nutrition",
  "Pests and diseases",
  "Varieties",
  "Planting guide",
  "Harvest and storage"
];


let indexesReady: Promise<void> | null = null;

async function ensureTaskIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection("cropCycles").createIndex({ userId: 1, cropSlug: 1, status: 1 }),
        db.collection("farmTasks").createIndex({ userId: 1, status: 1, dueAt: 1 }),
        db.collection("notifications").createIndex({ userId: 1, key: 1 }, { unique: true })
      ]);
    })();
  }
  await indexesReady;
}

type GeneratedTask = {
  dayOffset: number;
  title: string;
  description: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  estimatedMinutes: number;
  priority: "NORMAL" | "IMPORTANT" | "CRITICAL";
  sourceSection: FarmTaskSourceSection;
};

function lagosDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(dateText: string, days: number) {
  const base = new Date(`${dateText}T12:00:00${LAGOS_OFFSET}`);
  base.setUTCDate(base.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(base);
}

function dueAtFor(dateText: string, time: string) {
  return new Date(`${dateText}T${time}:00${LAGOS_OFFSET}`);
}

function parseDurationDays(value: string): number {
  const text = value.toLowerCase();
  const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(days?|months?|years?)/g)].map(match => {
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit.startsWith("year")) return Math.round(amount * 365);
    if (unit.startsWith("month")) return Math.round(amount * 30);
    return Math.round(amount);
  });
  if (values.length) return Math.max(1, Math.max(...values));

  const plainNumbers = [...text.matchAll(/\b(\d{2,4})\b/g)].map(match => Number(match[1])).filter(Number.isFinite);
  if (plainNumbers.length) return Math.max(1, Math.max(...plainNumbers));
  throw new Error(`FarmCompass could not determine a production duration from the crop record: ${value || "duration missing"}.`);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function validClock(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function normaliseSourceSection(value: unknown): FarmTaskSourceSection {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  const found = SOURCE_SECTIONS.find(section => section.toLowerCase() === text);
  return found || "Farmer tips";
}

function stripCodeFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseGeneratedTasks(raw: string, durationDays: number): GeneratedTask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("The AI task planner returned invalid JSON.");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The AI task planner returned an unexpected response.");
  }
  const tasks = (parsed as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error("The AI task planner returned no tasks.");

  const cleaned = tasks.slice(0, 80).map((task, index) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return null;
    const item = task as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 140) : "";
    const description = typeof item.description === "string" ? item.description.trim().slice(0, 900) : "";
    if (!title || !description) return null;
    const priorityText = typeof item.priority === "string" ? item.priority.toUpperCase() : "NORMAL";
    const priority: GeneratedTask["priority"] = priorityText === "CRITICAL" ? "CRITICAL" : priorityText === "IMPORTANT" ? "IMPORTANT" : "NORMAL";
    const start = validClock(item.timeWindowStart, "07:00");
    let end = validClock(item.timeWindowEnd, "10:00");
    if (end <= start) end = "17:00";
    return {
      dayOffset: clampInt(item.dayOffset, 0, durationDays, Math.min(index, durationDays)),
      title,
      description,
      timeWindowStart: start,
      timeWindowEnd: end,
      estimatedMinutes: clampInt(item.estimatedMinutes, 10, 480, 45),
      priority,
      sourceSection: normaliseSourceSection(item.sourceSection)
    } satisfies GeneratedTask;
  }).filter((task): task is GeneratedTask => Boolean(task));

  if (!cleaned.length) throw new Error("The AI task planner returned no usable tasks.");
  cleaned.sort((a, b) => a.dayOffset - b.dayOffset || a.timeWindowStart.localeCompare(b.timeWindowStart));
  return cleaned;
}

async function generateTaskPlan(profile: FarmProfile, cropSlug: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to create the FarmCompass accountability task plan.");
  }
  const crop = await getCropBySlug(cropSlug);
  if (!crop) throw new Error("The selected crop record could not be found.");
  const durationDays = parseDurationDays(crop.growthDuration);
  const startDate = lagosDateString();

  const context = {
    farmer: {
      state: profile.state,
      lga: profile.lga,
      farmSizeHa: profile.farmSizeHa ?? null,
      irrigation: profile.irrigation,
      farmingGoal: profile.farmingGoal ?? null,
      plantingMonth: profile.plantingMonth ?? null,
      soilType: effectiveSoilType(profile),
      pH: effectiveSoilPH(profile),
      averageAnnualRainfallMm: profile.averageRainfallMm ?? null,
      averageTemperatureC: profile.averageTemperatureC ?? null
    },
    crop: {
      slug: crop.slug,
      name: crop.name,
      scientificName: crop.scientificName,
      growthDuration: crop.growthDuration,
      plantingSeason: crop.plantingSeason,
      irrigation: crop.irrigation,
      farmerTips: crop.sections.farmerTips,
      fertiliserAndNutrition: crop.sections.fertiliser,
      pestsAndDiseases: crop.sections.pestDisease,
      varieties: crop.sections.varieties,
      plantingGuide: crop.sections.plantingGuide,
      harvestAndStorage: crop.sections.harvestStorage
    },
    planning: {
      startDate,
      durationDays,
      timezone: "Africa/Lagos"
    }
  };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5";
  const response = await client.responses.create({
    model,
    instructions: `You are the FarmCompass farm-operations planner. Convert ONLY the supplied FarmCompass crop record into an actionable schedule for the selected Nigerian farmer. The crop record is authoritative. Do not invent fertiliser rates, pesticide names, pesticide doses, varieties, planting windows, disease treatments, or agronomic facts that are absent from the supplied record. You may organise and sequence supported guidance into practical tasks and estimate how long a field activity may take, but duration estimates must be clearly practical estimates rather than agronomic facts. Use the supplied crop duration as the planning horizon. Create tasks from planting through harvest/storage. Do not create a task for every calendar day unless the source explicitly requires daily action; instead create actionable tasks on the dates/stages when work or inspection is useful so the Tasks page can show the farmer what is due each day. If guidance says only "during growth" or is otherwise broad, schedule it at a reasonable stage and keep the description explicit that it follows the broad source guidance. Prefer morning windows for field work where sensible. Output JSON only with this exact shape: {"tasks":[{"dayOffset":0,"title":"...","description":"...","timeWindowStart":"07:00","timeWindowEnd":"10:00","estimatedMinutes":45,"priority":"NORMAL","sourceSection":"Planting guide"}]}. priority must be NORMAL, IMPORTANT, or CRITICAL. sourceSection must be exactly one of: Farmer tips; Fertiliser and nutrition; Pests and diseases; Varieties; Planting guide; Harvest and storage. Keep the plan under 80 tasks. Include at least one planting-stage task and one harvest/storage-stage task when those sections contain usable guidance.`,
    input: [{
      role: "user",
      content: [{ type: "input_text", text: JSON.stringify(context, null, 2) }]
    }]
  });

  const tasks = parseGeneratedTasks(response.output_text || "", durationDays);
  return { crop, model, durationDays, startDate, tasks };
}

export async function selectCropAndCreateTasks(userId: string, cropSlug: string, recommendationScore?: number | null) {
  await ensureTaskIndexes();
  const db = await getDb();
  const existing = await db.collection<CropCycle>("cropCycles").findOne({ userId, cropSlug, status: "ACTIVE" });
  if (existing) {
    return { cycleId: String(existing._id), alreadySelected: true, taskCount: await db.collection<FarmTask>("farmTasks").countDocuments({ userId, cycleId: String(existing._id), status: { $ne: "SKIPPED" } }) };
  }

  const profile = await db.collection<FarmProfile>("farmProfiles").findOne({ userId });
  if (!profile) throw new Error("Add your farm details before selecting a crop task plan.");

  const latest = await db.collection("recommendations").findOne({ userId }, { sort: { createdAt: -1 } });
  const ranked = Array.isArray(latest?.rankedCrops) ? latest.rankedCrops : [];
  const recommendation = ranked.find((item: any) => item?.crop?.slug === cropSlug);
  if (!recommendation) throw new Error("Generate a recommendation first, then select one of the recommended crops.");

  const generated = await generateTaskPlan(profile, cropSlug);
  const projectedEndDate = addDays(generated.startDate, generated.durationDays);
  const now = new Date();
  const cycle: CropCycle = {
    userId,
    cropSlug,
    cropName: generated.crop.name,
    scientificName: generated.crop.scientificName,
    recommendationScore: recommendation.score ?? recommendationScore ?? null,
    status: "ACTIVE",
    startDate: generated.startDate,
    projectedEndDate,
    durationDays: generated.durationDays,
    generationModel: generated.model,
    profileSnapshot: {
      state: profile.state,
      lga: profile.lga,
      farmSizeHa: profile.farmSizeHa ?? null,
      irrigation: profile.irrigation,
      farmingGoal: profile.farmingGoal ?? null,
      plantingMonth: profile.plantingMonth ?? null,
      soilType: effectiveSoilType(profile),
      pH: effectiveSoilPH(profile),
      averageRainfallMm: profile.averageRainfallMm ?? null,
      averageTemperatureC: profile.averageTemperatureC ?? null
    },
    createdAt: now,
    updatedAt: now
  };

  const cycleResult = await db.collection<CropCycle>("cropCycles").insertOne(cycle);
  const cycleId = String(cycleResult.insertedId);
  const taskDocs: FarmTask[] = generated.tasks.map(task => {
    const scheduledDate = addDays(generated.startDate, task.dayOffset);
    return {
      userId,
      cycleId,
      cropSlug,
      cropName: generated.crop.name,
      title: task.title,
      description: task.description,
      scheduledDate,
      windowStart: task.timeWindowStart,
      windowEnd: task.timeWindowEnd,
      dueAt: dueAtFor(scheduledDate, task.timeWindowEnd),
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
      sourceSection: task.sourceSection,
      status: "PENDING",
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
  });

  if (taskDocs.length) await db.collection<FarmTask>("farmTasks").insertMany(taskDocs);
  return { cycleId, alreadySelected: false, taskCount: taskDocs.length };
}

export async function archiveCropCycle(userId: string, cropSlug: string) {
  await ensureTaskIndexes();
  const db = await getDb();
  const cycle = await db.collection<CropCycle>("cropCycles").findOne({ userId, cropSlug, status: "ACTIVE" });
  if (!cycle) return { archived: false };
  const cycleId = String(cycle._id);
  const now = new Date();
  await db.collection<CropCycle>("cropCycles").updateOne({ _id: cycle._id, userId }, { $set: { status: "ARCHIVED", archivedAt: now, updatedAt: now } });
  await db.collection<FarmTask>("farmTasks").updateMany({ userId, cycleId, status: "PENDING" }, { $set: { status: "SKIPPED", updatedAt: now } });
  await db.collection<InAppNotification>("notifications").updateMany({ userId, cropSlug, resolvedAt: null }, { $set: { resolvedAt: now, readAt: now, updatedAt: now } });
  return { archived: true };
}

export async function syncOverdueTaskNotifications(userId: string) {
  await ensureTaskIndexes();
  const db = await getDb();
  const now = new Date();
  const activeCycles = await db.collection<CropCycle>("cropCycles").find({ userId, status: "ACTIVE" }, { projection: { _id: 1 } }).toArray();
  const cycleIds = activeCycles.map(cycle => String(cycle._id));
  if (!cycleIds.length) return;

  const overdue = await db.collection<FarmTask>("farmTasks").find({
    userId,
    cycleId: { $in: cycleIds },
    status: "PENDING",
    dueAt: { $lte: now }
  }).limit(100).toArray();

  for (const task of overdue) {
    const taskId = String(task._id);
    const key = `TASK_OVERDUE:${taskId}`;
    const lateText = task.scheduledDate < lagosDateString(now)
      ? `This ${task.cropName} task was due on ${task.scheduledDate}.`
      : `This ${task.cropName} task was due by ${task.windowEnd} today.`;
    await db.collection<InAppNotification>("notifications").updateOne(
      { userId, key },
      {
        $setOnInsert: {
          userId,
          type: "TASK_OVERDUE",
          key,
          taskId,
          cropSlug: task.cropSlug,
          title: `Overdue: ${task.title}`,
          message: `${lateText} It has not been marked complete.`,
          href: "/tasks",
          readAt: null,
          resolvedAt: null,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );
  }
}

export async function setTaskCompletion(userId: string, taskId: string, completed: boolean) {
  await ensureTaskIndexes();
  if (!ObjectId.isValid(taskId)) throw new Error("Invalid task identifier.");
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<FarmTask>("farmTasks").findOneAndUpdate(
    { _id: new ObjectId(taskId), userId, status: { $ne: "SKIPPED" } },
    { $set: { status: completed ? "COMPLETED" : "PENDING", completedAt: completed ? now : null, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Task not found.");
  if (completed) {
    await db.collection<InAppNotification>("notifications").updateMany(
      { userId, taskId, resolvedAt: null },
      { $set: { resolvedAt: now, readAt: now, updatedAt: now } }
    );
  }
  return result;
}

export function taskDateToday() {
  return lagosDateString();
}
