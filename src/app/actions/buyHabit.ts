"use server";

// Server Action, чтобы платёж шёл с сервера.
import { postPaidJSON } from "@/lib/x402Client";
import { getUserIdDev } from "@/lib/auth";

export async function buyHabitInsight(formData: FormData) {
    // читаем флажок highAccuracy
    const highAccuracy = formData.get("highAccuracy") === "1";
    const userId = getUserIdDev();

    // пробрасываем userId временно на бэк
    return await postPaidJSON("/api/paid/insight/habit", { userId, highAccuracy });
}
