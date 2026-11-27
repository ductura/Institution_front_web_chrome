import { createApi, type ApiResult } from "../../../../../../src/client/api";

// F4-MEN-R03: the tasks agreed at a consultation, on N-16. The mentor writes a task on a record
// (work.consultation-tasks.post) and marks it done or not done (work.consultation-task-mark.post); the list is
// work.consultation-tasks.get, the same the student reads in "Priprema za konzultacije". A task is never
// changed or deleted. Every state shown is the server's answer; anything the contract does not name is "unknown".

type Body<T> = Extract<T, { ok: true }> extends { body: infer Shape } ? Shape : never;
export type AgreedTask = Body<ApiResult<"work.consultation-tasks.post">>;

/** At most 20 tasks a record and 500 code points a task (the contract). */
export const MAX_TASKS = 20;
export const MAX_TASK_TEXT = 500;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string };
type Params = { documentId: string; recordId?: string; taskId?: string };
export type TasksCall = (
  id: "work.consultation-tasks.get" | "work.consultation-tasks.post" | "work.consultation-task-mark.post",
  input: { params: Params; query: undefined; body: unknown },
) => Promise<Answer>;

export const tasksCall = (): TasksCall => createApi() as unknown as TasksCall;

export type TaskFailure = "signedOut" | "forbidden" | "notFound" | "invalid" | "unknown";
export type TaskWrite = { kind: "saved"; task: AgreedTask } | { kind: TaskFailure };
export type TasksRead = { kind: "read"; tasks: readonly AgreedTask[] } | { kind: "signedOut" } | { kind: "unknown" };

const isTask = (value: unknown): value is AgreedTask => {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string" && typeof task.recordId === "string" && typeof task.position === "number"
    && typeof task.text === "string" && typeof task.done === "boolean";
};

export function failure(answer: Extract<Answer, { ok: false }>): TaskFailure {
  switch (answer.status) {
    case 401: return "signedOut";
    case 403: return answer.code === "forbidden" ? "forbidden" : "unknown";
    case 404: return "notFound";
    case 422: return "invalid";
    default: return "unknown";
  }
}

/** The tasks of one record in the mentor's order. */
export function tasksOf(tasks: readonly AgreedTask[], recordId: string): AgreedTask[] {
  return tasks.filter((task) => task.recordId === recordId).sort((a, b) => a.position - b.position);
}

/** What is wrong with a task's text before it is sent; null when it can be sent. */
export function taskTextProblem(text: string): "blank" | "long" | null {
  if (text.trim() === "") return "blank";
  return [...text].length > MAX_TASK_TEXT ? "long" : null;
}

export async function readTasks(call: TasksCall, documentId: string): Promise<TasksRead> {
  try {
    const answer = await call("work.consultation-tasks.get", { params: { documentId }, query: undefined, body: undefined });
    if (!answer.ok) return { kind: answer.status === 401 ? "signedOut" : "unknown" };
    const tasks = (answer.body as { tasks?: unknown }).tasks;
    return Array.isArray(tasks) && tasks.every(isTask) ? { kind: "read", tasks } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

async function write(run: () => Promise<Answer>): Promise<TaskWrite> {
  try {
    const answer = await run();
    if (!answer.ok) return { kind: failure(answer) };
    return isTask(answer.body) ? { kind: "saved", task: answer.body } : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

export function addTask(call: TasksCall, documentId: string, recordId: string, text: string): Promise<TaskWrite> {
  return write(() => call("work.consultation-tasks.post", { params: { documentId, recordId }, query: undefined, body: { text } }));
}

export function markTask(call: TasksCall, documentId: string, taskId: string, done: boolean): Promise<TaskWrite> {
  return write(() => call("work.consultation-task-mark.post", { params: { documentId, taskId }, query: undefined, body: { done } }));
}
