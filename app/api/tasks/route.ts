import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { syncOverdueTaskNotifications, taskDateToday } from "@/lib/tasks";
import type { CropCycle, FarmTask } from "@/types";

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    await syncOverdueTaskNotifications(auth.user.id);
    const db = await getDb();
    const [cycles, tasks] = await Promise.all([
      db.collection<CropCycle>("cropCycles").find({ userId: auth.user.id, status: "ACTIVE" }).sort({ createdAt: -1 }).toArray(),
      db.collection<FarmTask>("farmTasks").find({ userId: auth.user.id, status: { $ne: "SKIPPED" } }).sort({ dueAt: 1 }).toArray()
    ]);
    const activeIds = new Set(cycles.map(cycle => String(cycle._id)));
    const today = taskDateToday();
    return NextResponse.json({
      today,
      cycles: cycles.map(cycle => ({
        id: String(cycle._id),
        cropSlug: cycle.cropSlug,
        cropName: cycle.cropName,
        startDate: cycle.startDate,
        projectedEndDate: cycle.projectedEndDate,
        recommendationScore: cycle.recommendationScore ?? null
      })),
      tasks: tasks.filter(task => activeIds.has(task.cycleId)).map(task => ({
        id: String(task._id),
        cycleId: task.cycleId,
        cropSlug: task.cropSlug,
        cropName: task.cropName,
        title: task.title,
        description: task.description,
        scheduledDate: task.scheduledDate,
        windowStart: task.windowStart,
        windowEnd: task.windowEnd,
        dueAt: task.dueAt,
        estimatedMinutes: task.estimatedMinutes,
        priority: task.priority,
        sourceSection: task.sourceSection,
        status: task.status,
        completedAt: task.completedAt ?? null
      }))
    });
  } catch (error) {
    return serverError(error);
  }
}
