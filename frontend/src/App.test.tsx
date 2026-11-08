import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, test } from "vite-plus/test";
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
beforeEach(() => localStorage.clear());
afterEach(cleanup);

test("starts with an empty composer and loads editable suggestions by intent", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Tu asistente de IA");
  expect(
    (screen.getByRole("button", { name: "Enviar mensaje" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Programar" }));
  await user.click(screen.getByRole("button", { name: /Desbloquea tu código/ }));
  expect(
    (screen.getByRole("textbox", { name: "Escribe tu mensaje" }) as HTMLTextAreaElement).value,
  ).toContain("entender y resolver este error");
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
  expect(messages.textContent).toContain("todavía no hay un modelo de IA conectado");
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
