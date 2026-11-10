import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import App from "./App";

beforeAll(() => {
  // jsdom does not implement native modal dialogs; browser QA covers the real dialog.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
const reply = "Aquí tienes la respuesta a tu consulta.";
const note = {
  id: "3",
  title: "Viaje a Ica",
  content: "Reservar hotel en Ica y visitar la laguna de Huacachina.",
  created_at: "2026-11-08T11:00:00-05:00",
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ response: reply, data: [], tools_used: [] })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("starts with an empty composer and loads editable tool examples", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Tu asistente de IA");
  expect(
    (screen.getByRole("button", { name: "Enviar mensaje" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.queryByRole("group", { name: "¿Por dónde empezamos?" })).toBeNull();
  const tools = screen.getByRole("group", { name: "Herramientas disponibles" });
  expect(within(tools).getAllByRole("button")).toHaveLength(3);
  for (const [name, prompt] of [
    [/Hacer un cálculo/, "Calcula 150 * 8"],
    [/Consultar el clima/, "¿Cuál es el clima actual en Ica?"],
    [/Buscar notas/, "Busca notas sobre Ica"],
  ] as const) {
    await user.click(within(tools).getByRole("button", { name }));
    expect(
      (screen.getByRole("textbox", { name: "Escribe tu mensaje" }) as HTMLTextAreaElement).value,
    ).toBe(prompt);
  }
  expect(fetch).not.toHaveBeenCalled();
});

test("sends on Enter, preserves Shift+Enter, and saves the actual conversation", async () => {
  const user = userEvent.setup();
  render(<App />);
  const input = screen.getByRole("textbox", { name: "Escribe tu mensaje" });
  await user.type(input, "Mi primer proyecto{Shift>}{Enter}{/Shift}Quiero crear algo útil");
  expect((input as HTMLTextAreaElement).value).toBe("Mi primer proyecto\nQuiero crear algo útil");
  await user.keyboard("{Enter}");
  const messages = screen.getByRole("log");
  expect(messages.textContent).toContain("Mi primer proyecto");
  expect(await within(messages).findByText(reply)).toBeDefined();
  expect(within(messages).getByText("Sin tools · Respuesta directa")).toBeDefined();
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem("asistente.conversations.v1") ?? "[]");
    expect(saved[0].messages).toHaveLength(2);
  });
  const saved = JSON.parse(localStorage.getItem("asistente.conversations.v1") ?? "[]");
  expect(saved).toHaveLength(1);
  expect(saved[0].messages).toHaveLength(2);
  expect(saved[0].messages[0].text).toBe("Mi primer proyecto\nQuiero crear algo útil");
  expect((input as HTMLTextAreaElement).value).toBe("");
});

test("starts a fresh conversation and reopens previous messages from history", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Escribe tu mensaje" }),
    "Plan de aprendizaje{Enter}",
  );
  await user.click(screen.getByRole("button", { name: /Nueva conversación/ }));
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  const history = screen.getByRole("navigation", { name: "Historial de conversaciones" });
  await user.click(within(history).getByRole("button", { name: "Plan de aprendizaje" }));
  expect(screen.getByRole("log").textContent).toContain("Plan de aprendizaje");
});

test("filters saved conversations through the search dialog", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Escribe tu mensaje" }),
    "Ideas para mi web{Enter}",
  );
  await user.click(screen.getByRole("button", { name: /Nueva conversación/ }));
  await user.click(screen.getByRole("button", { name: /Buscar conversaciones/ }));
  await user.type(screen.getByRole("textbox", { name: "Buscar en el historial" }), "imposible");
  expect(screen.getByText("No encontramos conversaciones con esa búsqueda.")).toBeDefined();
  await user.clear(screen.getByRole("textbox", { name: "Buscar en el historial" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Ideas para mi web" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("log").textContent).toContain("Ideas para mi web");
});

test("respects the history preference and allows deleting existing conversations", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Escribe tu mensaje" }),
    "Una idea privada{Enter}",
  );
  await user.click(screen.getByRole("button", { name: /Tu espacio personal/ }));
  await user.click(screen.getByRole("checkbox", { name: /Guardar conversaciones/ }));
  expect(localStorage.getItem("asistente.conversations.v1")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Eliminar todo el historial" }));
  await user.click(screen.getByRole("button", { name: "Cerrar ventana" }));
  expect(screen.queryByRole("navigation", { name: "Historial de conversaciones" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
});

test("recovers from malformed stored data without breaking the interface", () => {
  localStorage.setItem(
    "asistente.conversations.v1",
    JSON.stringify([{ id: "invalid", title: "Broken", messages: [{ role: "user" }] }]),
  );
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Historial de conversaciones" })).toBeNull();
});

test("renders multiple tool cards alongside the explanation and restores them from history", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      response: "Encontré tu nota y resolví el cálculo.",
      tools_used: ["search_notes", "calculate", "calculate"],
      data: [
        { type: "notes", items: [note] },
        { type: "calculation", expression: "150 * 8", result: "1200" },
      ],
    }),
  );
  const user = userEvent.setup();
  const view = render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Escribe tu mensaje" }),
    "Busca Ica y calcula 150 * 8{Enter}",
  );
  expect(await screen.findByText("Encontré tu nota y resolví el cálculo.")).toBeDefined();
  expect(screen.getByLabelText("Uso de herramientas").textContent).toBe(
    "Tools usadas:search_notescalculate",
  );
  expect(screen.getByRole("region", { name: "Notas encontradas" }).textContent).toContain(
    note.content,
  );
  expect(screen.getByRole("region", { name: "Resultado del cálculo" }).textContent).toContain(
    "1200",
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/assistant/assistant",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ prompt: "Busca Ica y calcula 150 * 8" }),
    }),
  );
  await waitFor(() =>
    expect(localStorage.getItem("asistente.conversations.v1")).toContain('"type":"notes"'),
  );
  view.unmount();
  render(<App />);
  await user.click(
    within(screen.getByRole("navigation", { name: "Historial de conversaciones" })).getByRole(
      "button",
    ),
  );
  expect(screen.getByRole("region", { name: "Notas encontradas" }).textContent).toContain(
    note.title,
  );
  expect(screen.getByLabelText("Uso de herramientas").textContent).toBe(
    "Tools usadas:search_notescalculate",
  );
});

test("shows weather units, observation time and source without inferring weather conditions", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      response: "Este es el clima en Ica.",
      data: [
        {
          type: "weather",
          city: "Ica",
          country: "Perú",
          observed_at: "2026-11-09T10:15",
          timezone: "America/Lima",
          temperature: 24,
          temperature_unit: "°C",
          humidity: 60,
          wind_speed: 12,
          wind_speed_unit: "km/h",
          source: "https://open-meteo.com/",
        },
      ],
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Escribe tu mensaje" }),
    "Clima en Ica{Enter}",
  );
  const weather = await screen.findByRole("region", { name: "Clima en Ica" });
  expect(weather.textContent).toContain("24°C");
  expect(weather.textContent).toContain("60 %");
  expect(weather.textContent).toContain("12 km/h");
  expect(weather.textContent).toContain("America/Lima");
  expect(
    within(weather)
      .getByRole("link", { name: /Open-Meteo/ })
      .getAttribute("href"),
  ).toBe("https://open-meteo.com/");
});

test("shows empty searches and tool failures as distinct cards", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      response: "No encontré resultados.",
      tools_used: ["search_notes", "get_weather"],
      data: [
        { type: "notes", items: [] },
        { type: "error", tool: "get_weather", message: "No se encontró la ciudad." },
      ],
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole("textbox", { name: "Escribe tu mensaje" }), "Busca algo{Enter}");
  expect(
    await screen.findByText("No se encontraron notas que coincidan con tu búsqueda."),
  ).toBeDefined();
  expect(screen.getByRole("region", { name: "Consulta sin completar" }).textContent).toContain(
    "No se encontró la ciudad.",
  );
  expect(screen.getByLabelText("Uso de herramientas").textContent).toContain("get_weather");
});

test("keeps a text response usable when a card is malformed or unknown", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      response: reply,
      data: [
        { type: "notes", items: [{ ...note, created_at: "invalid" }] },
        { type: "new-type", html: "<script>invalid</script>" },
        { type: "calculation", expression: "2 * 2", result: "4" },
      ],
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole("textbox", { name: "Escribe tu mensaje" }), "Hola{Enter}");
  expect(await screen.findByText(reply)).toBeDefined();
  expect(screen.getByText("Uso de tools no registrado")).toBeDefined();
  expect(screen.queryByRole("region", { name: "Notas encontradas" })).toBeNull();
  expect(screen.getByRole("region", { name: "Resultado del cálculo" })).toBeDefined();
});

test.each(["http", "network", "invalid"])(
  "recovers from an %s failure and allows another message",
  async (failure) => {
    if (failure === "network")
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    else
      vi.mocked(fetch).mockResolvedValueOnce(
        failure === "http"
          ? new Response("upstream failed", { status: 502 })
          : Response.json({ response: null }),
      );
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("textbox", { name: "Escribe tu mensaje" });
    await user.type(input, "Mi consulta{Enter}");
    expect(
      await screen.findByText("No se pudo obtener una respuesta. Inténtalo nuevamente."),
    ).toBeDefined();
    await user.type(input, "Intentar otra vez{Enter}");
    expect(await screen.findByText(reply)).toBeDefined();
  },
);

test("prevents duplicate sends while waiting and routes a late reply to its original conversation", async () => {
  let resolveRequest!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<App />);
  const input = screen.getByRole("textbox", { name: "Escribe tu mensaje" });
  await user.type(input, "Mi consulta{Enter}");
  expect(screen.getByRole("status").textContent).toContain("Preparando tu respuesta");
  await user.type(input, "Segundo mensaje{Enter}");
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /Nueva conversación/ }));
  await act(async () => resolveRequest(Response.json({ response: reply, data: [] })));
  expect(screen.queryByRole("log")).toBeNull();
  await user.click(
    within(screen.getByRole("navigation", { name: "Historial de conversaciones" })).getByRole(
      "button",
      { name: "Mi consulta" },
    ),
  );
  expect(screen.getByText(reply)).toBeDefined();
});
