export type Note = { id: string; title: string; content: string; created_at: string };
export type AssistantData =
  | { type: "notes"; items: Note[] }
  | { type: "calculation"; expression: string; result: string }
  | {
      type: "weather";
      city: string;
      country: string;
      observed_at: string;
      timezone: string;
      temperature: number;
      temperature_unit: string;
      humidity: number;
      wind_speed: number;
      wind_speed_unit: string;
      source: "https://open-meteo.com/";
    }
  | { type: "error"; tool: string; message: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Missing metadata in older responses must not be interpreted as no tool use.
export function parseToolsUsed(value: unknown): string[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((name: unknown) => typeof name === "string" && name.trim().length > 0)
  ) {
    return undefined;
  }
  return [...new Set(value as string[])];
}

export function isAssistantData(value: unknown): value is AssistantData {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "notes":
      return (
        Array.isArray(value.items) &&
        value.items.every(
          (note: unknown) =>
            isRecord(note) &&
            typeof note.id === "string" &&
            typeof note.title === "string" &&
            typeof note.content === "string" &&
            typeof note.created_at === "string" &&
            Number.isFinite(Date.parse(note.created_at)),
        )
      );
    case "calculation":
      return typeof value.expression === "string" && typeof value.result === "string";
    case "weather":
      return (
        typeof value.city === "string" &&
        typeof value.country === "string" &&
        typeof value.observed_at === "string" &&
        typeof value.timezone === "string" &&
        isFiniteNumber(value.temperature) &&
        typeof value.temperature_unit === "string" &&
        isFiniteNumber(value.humidity) &&
        value.humidity >= 0 &&
        value.humidity <= 100 &&
        isFiniteNumber(value.wind_speed) &&
        value.wind_speed >= 0 &&
        typeof value.wind_speed_unit === "string" &&
        value.source === "https://open-meteo.com/"
      );
    case "error":
      return typeof value.tool === "string" && typeof value.message === "string";
    default:
      return false;
  }
}

export async function askAssistant(prompt: string) {
  const result = await fetch(import.meta.env.VITE_ASSISTANT_URL ?? "/api/v1/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!result.ok) throw new Error("No se pudo obtener una respuesta. Inténtalo nuevamente.");
  const payload: unknown = await result.json();
  if (!isRecord(payload) || typeof payload.response !== "string" || !payload.response.trim()) {
    throw new Error("El asistente devolvió una respuesta inválida. Inténtalo nuevamente.");
  }
  return {
    response: payload.response,
    // Unknown or malformed cards never prevent the explanation from rendering.
    data: Array.isArray(payload.data) ? payload.data.filter(isAssistantData) : [],
    toolsUsed: parseToolsUsed(payload.tools_used),
  };
}
