"use server";

// Server Action: платный запрос без прокидывания userId
import { postPaidJSON } from "@/lib/x402Client";

export async function buyHabitInsight(formData: FormData) {
    const highAccuracy = formData.get("highAccuracy") === "1";
    return await postPaidJSON("/api/paid/insight/habit", { highAccuracy });
}
