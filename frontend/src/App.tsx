import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon, Mark } from "./components/Icon";
import { Modal } from "./components/Modal";
import { AssistantCards } from "./components/AssistantCards";
import {
  askAssistant,
  isAssistantData,
  isRecord,
  parseToolsUsed,
  type AssistantData,
} from "./lib/assistant";
import "./App.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  files?: string[];
  data?: AssistantData[];
  toolsUsed?: string[];
  error?: boolean;
};
type Conversation = { id: string; title: string; messages: Message[] };
const storageKey = "asistente.conversations.v1";
const suggestions = [
  {
    tool: "calculate",
    title: "Hacer un cálculo",
    description: "Resuelve operaciones matemáticas.",
    prompt: "Calcula 150 * 8",
  },
  {
    tool: "get_weather",
    title: "Consultar el clima",
    description: "Consulta el clima actual de una ciudad.",
    prompt: "¿Cuál es el clima actual en Ica?",
  },
  {
    tool: "search_notes",
    title: "Buscar notas",
    description: "Encuentra notas por título o contenido.",
    prompt: "Busca notas sobre Ica",
  },
];
function loadConversations(): Conversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    const conversations = value.filter(
      (item): item is Conversation =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        Array.isArray(item.messages) &&
        item.messages.every(
          (message: unknown) =>
            isRecord(message) &&
            typeof message.id === "string" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.text === "string" &&
            (message.files === undefined ||
              (Array.isArray(message.files) &&
                message.files.every((file: unknown) => typeof file === "string"))),
        ),
    );
    return conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        data: Array.isArray(message.data) ? message.data.filter(isAssistantData) : [],
        toolsUsed: parseToolsUsed(message.toolsUsed),
        error: message.error === true,
      })),
    }));
  } catch {
    return [];
  }
}
function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<"search" | "preferences" | "about" | null>(null);
  const [search, setSearch] = useState("");
  const [saveHistory, setSaveHistory] = useState(() => {
    try {
      return localStorage.getItem("asistente.history") !== "off";
    } catch {
      return true;
    }
  });
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const sending = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const active = conversations.find((item) => item.id === activeId);
  const visibleConversations = conversations.filter((item) =>
    `${item.title} ${item.messages.map((message) => message.text).join(" ")}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );

  useEffect(() => {
    // Defer storage writes so typing and navigation stay responsive.
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem("asistente.history", saveHistory ? "on" : "off");
        if (saveHistory) localStorage.setItem(storageKey, JSON.stringify(conversations));
        else localStorage.removeItem(storageKey);
      } catch {
        setNotice("No se pudo guardar el historial en este navegador.");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [conversations, saveHistory]);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal((current) => (current === "search" ? null : "search"));
      }
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const field = textarea.current;
    if (field) {
      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight, 180)}px`;
    }
  }, [draft]);
  useEffect(() => {
    messageEnd.current?.scrollIntoView?.({ behavior: "instant", block: "end" });
  }, [active, pendingId]);
  useEffect(() => {
    if (!copiedId) return;
    const timeout = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedId]);

  function newConversation() {
    setActiveId(null);
    setDraft("");
    setSidebarOpen(false);
    setNotice("");
    textarea.current?.focus();
  }
  function openConversation(id: string) {
    setActiveId(id);
    setDraft("");
    setModal(null);
    setSidebarOpen(false);
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending.current) return;
    sending.current = true;
    const id = activeId ?? crypto.randomUUID();
    const messages: Message[] = [{ id: crypto.randomUUID(), role: "user", text }];
    setConversations((current) => {
      const existing = current.find((item) => item.id === id);
      const conversation = existing
        ? { ...existing, messages: [...existing.messages, ...messages] }
        : { id, title: text.split("\n")[0].slice(0, 65), messages };
      return [conversation, ...current.filter((item) => item.id !== id)];
    });
    setActiveId(id);
    setPendingId(id);
    setDraft("");
    setNotice("");
    textarea.current?.focus();
    try {
      const result = await askAssistant(text);
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.response,
        data: result.data,
        toolsUsed: result.toolsUsed,
      };
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id
            ? { ...conversation, messages: [...conversation.messages, reply] }
            : conversation,
        ),
      );
    } catch {
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "No se pudo obtener una respuesta. Inténtalo nuevamente.",
        error: true,
      };
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id
            ? { ...conversation, messages: [...conversation.messages, reply] }
            : conversation,
        ),
      );
    } finally {
      sending.current = false;
      setPendingId(null);
    }
  }
  function onEditorKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }
  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
    } catch {
      setNotice("No se pudo copiar el mensaje. Puedes seleccionar el texto.");
    }
  }

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-is-open" : ""}`}>
      <a className="skip-to-content" href="#message-input">
        Ir al mensaje
      </a>
      {sidebarOpen ? (
        <button
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              newConversation();
            }}
          >
            <Mark />
            <span>
              asistente<span className="brand-period">.</span>
            </span>
          </a>
          <button
            className="icon-button sidebar-toggle"
            aria-label="Cerrar navegación"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="panel" size={18} />
          </button>
        </div>
        <button type="button" className="new-chat btn btn--secondary" onClick={newConversation}>
          <Icon name="plus" size={19} />
          <span>Nueva conversación</span>
          <span className="new-chat-hint">↗</span>
        </button>
        <button
          type="button"
          className="search-nav"
          onClick={() => {
            setSearch("");
            setModal("search");
          }}
        >
          <Icon name="search" size={18} />
          <span>Buscar conversaciones</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="history-area">
          <div className="sidebar-label">
            <span>Conversaciones</span>
            <span>{conversations.length.toString().padStart(2, "0")}</span>
          </div>
          {conversations.length ? (
            <nav className="history-list" aria-label="Historial de conversaciones">
              {conversations.map((conversation) => (
                <button
                  className={`history-item${conversation.id === activeId ? " is-active" : ""}`}
                  key={conversation.id}
                  aria-current={conversation.id === activeId ? "page" : undefined}
                  onClick={() => openConversation(conversation.id)}
                >
                  <Icon name="chat" size={17} />
                  <span>{conversation.title}</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="history-empty">
              <span className="empty-history-line" />
              <p>Un lugar para cada idea.</p>
              <p>Tus conversaciones aparecerán aquí.</p>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="workspace-symbol">
              <Icon name="shield" size={18} />
            </span>
            <div>
              <span>Tu espacio, a tu ritmo</span>
              <p>El historial se queda en este navegador.</p>
            </div>
          </div>
          <button type="button" className="profile-button" onClick={() => setModal("preferences")}>
            <span className="avatar">T</span>
            <span>
              <strong>Tu espacio personal</strong>
              <small>Preferencias del asistente</small>
            </span>
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>
      <main
        className={`workspace${active ? " workspace--conversation" : ""}`}
        id="workspace"
        inert={sidebarOpen}
      >
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label="Abrir navegación"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="panel" />
            </button>
            <span className="breadcrumb-home">Espacio personal</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">
              {active ? active.title : "Nueva conversación"}
            </span>
          </div>
          <div className="header-actions">
            <button type="button" className="preview-badge" onClick={() => setModal("about")}>
              <span />
              Colly
            </button>
            <button
              type="button"
              className="icon-button help-button"
              aria-label="Acerca de este asistente"
              onClick={() => setModal("about")}
            >
              <Icon name="help" size={19} />
            </button>
          </div>
        </header>
        <div className={`conversation-stage${active ? " conversation-stage--active" : ""}`}>
          {active ? (
            <div
              className="messages"
              role="log"
              aria-label="Mensajes de la conversación"
              aria-live="polite"
            >
              {active.messages.map((message) => (
                <article key={message.id} className={`message message--${message.role}`}>
                  <div className="message-avatar">
                    {message.role === "assistant" ? <Mark /> : "T"}
                  </div>
                  <div className="message-body">
                    <div className="message-author">
                      {message.role === "assistant" ? "Asistente" : "Tú"}
                    </div>
                    {message.role === "assistant" && !message.error ? (
                      <div className="message-tools" aria-label="Uso de herramientas">
                        {message.toolsUsed === undefined ? (
                          <span>Uso de tools no registrado</span>
                        ) : message.toolsUsed.length ? (
                          <>
                            <span>
                              {message.toolsUsed.length === 1 ? "Tool usada:" : "Tools usadas:"}
                            </span>
                            {message.toolsUsed.map((name) => (
                              <code key={name}>{name}</code>
                            ))}
                          </>
                        ) : (
                          <span>Sin tools · Respuesta directa</span>
                        )}
                      </div>
                    ) : null}
                    <p>{message.text}</p>
                    {message.role === "assistant" && message.data?.length ? (
                      <AssistantCards data={message.data} />
                    ) : null}
                    {message.files?.length ? (
                      <div className="message-files">
                        {message.files.map((file, index) => (
                          <span key={`${file}-${index}`}>
                            <Icon name="file" size={16} />
                            {file}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && !message.error ? (
                      <button
                        className="copy-button"
                        aria-label={
                          copiedId === message.id ? "Mensaje copiado" : "Copiar respuesta"
                        }
                        onClick={() => void copyMessage(message)}
                      >
                        <Icon name={copiedId === message.id ? "check" : "copy"} size={16} />
                        <span>{copiedId === message.id ? "Copiado" : "Copiar"}</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {pendingId === active.id ? (
                <div className="message message--assistant" role="status">
                  <div className="message-avatar">
                    <Mark />
                  </div>
                  <div className="message-body">
                    <div className="message-author">Asistente</div>
                    <p className="assistant-pending">Preparando tu respuesta…</p>
                  </div>
                </div>
              ) : null}
              <div ref={messageEnd} />
            </div>
          ) : (
            <div className="welcome">
              <div className="welcome-emblem">
                <Mark large />
              </div>
              <div className="welcome-eyebrow">Un espacio para lo que tienes en mente</div>
              <h1>
                Tu asistente de IA,
                <br />
                <span>a tu manera.</span>
              </h1>
              <p className="welcome-description">
                Para esa primera idea, ese texto pendiente
                <br className="desktop-break" /> o eso que quieres entender mejor.
              </p>
            </div>
          )}
          <div className="composer-area">
            <form className="composer" onSubmit={(event) => void send(event)}>
              <label className="sr-only" htmlFor="message-input">
                Escribe tu mensaje
              </label>
              <textarea
                ref={textarea}
                id="message-input"
                value={draft}
                placeholder="Cuéntame, ¿qué tienes en mente?"
                rows={2}
                maxLength={12000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onEditorKey}
              />
              <div className="composer-toolbar">
                <span className="composer-mode">
                  <Mark />
                  <span>Asistente personal</span>
                </span>
                <button
                  className="send-button btn btn--primary"
                  type="submit"
                  aria-label="Enviar mensaje"
                  disabled={!draft.trim() || pendingId !== null}
                >
                  <Icon name="arrow" size={20} />
                </button>
              </div>
            </form>
            {notice ? (
              <p className="inline-notice" role="status">
                {notice}
              </p>
            ) : null}
            {!active ? (
              <div className="suggestions" role="group" aria-label="Herramientas disponibles">
                <h2 className="suggestions-heading">Tools disponibles</h2>
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    className="suggestion-card"
                    key={suggestion.title}
                    onClick={() => {
                      setDraft(suggestion.prompt);
                      textarea.current?.focus();
                    }}
                  >
                    <div className="suggestion-top">
                      <code className="suggestion-tool">{suggestion.tool}</code>
                      <Icon name="chevron" size={16} />
                    </div>
                    <strong>{suggestion.title}</strong>
                    <p>{suggestion.description}</p>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="composer-footer">
              <span>
                {active
                  ? "La IA puede cometer errores. Revisa la información importante."
                  : "A veces, todo empieza con una buena pregunta."}
              </span>
              <span className="enter-hint">
                <kbd>↵</kbd> para enviar
              </span>
            </div>
          </div>
        </div>
        <footer className="workspace-footer">
          <span className="footer-wordmark">Hecho para pensar contigo.</span>
          <button type="button" onClick={() => setModal("about")}>
            <span className="small-status-dot" />
            Conoce tu espacio
            <Icon name="chevron" size={14} />
          </button>
        </footer>
      </main>
      {modal === "search" ? (
        <Modal title="Buscar conversaciones" onClose={() => setModal(null)}>
          <div className="search-field">
            <Icon name="search" />
            <input
              aria-label="Buscar en el historial"
              placeholder="Busca una idea, una pregunta…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="search-results">
            {visibleConversations.length ? (
              visibleConversations.map((item) => (
                <button key={item.id} onClick={() => openConversation(item.id)}>
                  <Icon name="chat" />
                  <span>{item.title}</span>
                  <Icon name="chevron" size={16} />
                </button>
              ))
            ) : (
              <p>
                {search
                  ? "No encontramos conversaciones con esa búsqueda."
                  : "Tu historial está vacío. Empieza una conversación para encontrarla aquí."}
              </p>
            )}
          </div>
        </Modal>
      ) : null}
      {modal === "preferences" ? (
        <Modal title="Tu espacio personal" onClose={() => setModal(null)}>
          <p className="dialog-description">Unas pequeñas decisiones para trabajar a tu manera.</p>
          <label className="preference-row">
            <span>
              <strong>Guardar conversaciones</strong>
              <small>Solo en este navegador, sin sincronización.</small>
            </span>
            <input
              type="checkbox"
              checked={saveHistory}
              onChange={(event) => setSaveHistory(event.target.checked)}
            />
            <span className="toggle-switch" aria-hidden="true" />
          </label>
          <div className="preference-row">
            <span>
              <strong>Historial de conversaciones</strong>
              <small>{conversations.length} conversaciones en este espacio.</small>
            </span>
            <button
              className="icon-button danger-button"
              aria-label="Eliminar todo el historial"
              disabled={!conversations.length}
              onClick={() => {
                setConversations([]);
                newConversation();
                setNotice("Se ha eliminado el historial.");
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
          <p className="privacy-note">
            <Icon name="shield" size={18} />
            Puedes desactivar el guardado cuando quieras. Tus conversaciones abiertas seguirán
            disponibles hasta cerrar o recargar la página.
          </p>
        </Modal>
      ) : null}
      {modal === "about" ? (
        <Modal title="Un espacio para tus ideas" onClose={() => setModal(null)}>
          <div className="about-mark">
            <Mark large />
          </div>
          <p className="dialog-description">
            Colly te ayuda a consultar notas, hacer cálculos y conocer el clima. Puedes escribir y
            organizar tus conversaciones.
          </p>
          <div className="preview-explanation">
            <span className="small-status-dot" />
            <div>
              <strong>Respuestas con más contexto</strong>
              <p>
                Las respuestas pueden incluir tarjetas con notas, cálculos y clima. Al enviar un
                mensaje, su texto se comparte con el servicio de IA. El historial se guarda solo en
                este navegador.
              </p>
            </div>
          </div>
          <button className="btn btn--primary dialog-done" onClick={() => setModal(null)}>
            Empezar una conversación
            <Icon name="chevron" size={16} />
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
export default App;
