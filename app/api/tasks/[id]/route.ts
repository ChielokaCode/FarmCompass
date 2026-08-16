import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { setTaskCompletion } from "@/lib/tasks";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await req.json();
    if (typeof body.completed !== "boolean") return NextResponse.json({ error: "completed must be true or false." }, { status: 400 });
    const task = await setTaskCompletion(auth.user.id, id, body.completed);
    return NextResponse.json({
      task: {
        id: String(task._id),
        status: task.status,
        completedAt: task.completedAt ?? null
      }
    });
  } catch (error) {
    return serverError(error);
  }
}
