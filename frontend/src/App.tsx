import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon, Mark, type IconName } from "./components/Icon";
import { Modal } from "./components/Modal";
import "./App.css";

type Attachment = { name: string; content: string };
type Message = { id: string; role: "user" | "assistant"; text: string; files?: string[] };
type Conversation = { id: string; title: string; messages: Message[] };
type Intent = "Escribir" | "Crear ideas" | "Aprender" | "Programar";
const storageKey = "asistente.conversations.v1";
const intents: { label: Intent; icon: IconName }[] = [
  { label: "Escribir", icon: "write" },
  { label: "Crear ideas", icon: "idea" },
  { label: "Aprender", icon: "book" },
  { label: "Programar", icon: "code" },
];
const suggestions: Record<Intent, { title: string; description: string; prompt: string }[]> = {
  Escribir: [
    {
      title: "Encuentra las palabras",
      description: "Dale forma a ese correo pendiente.",
      prompt: "Ayúdame a redactar un correo claro y cercano para ",
    },
    {
      title: "Dale una segunda mirada",
      description: "Un texto más claro, con tu voz.",
      prompt: "Revisa este texto para mejorar su claridad sin cambiar mi tono:\n\n",
    },
    {
      title: "Empieza por un borrador",
      description: "De una idea suelta a una primera versión.",
      prompt: "Quiero escribir sobre esta idea. Ayúdame con un primer borrador:\n\n",
    },
  ],
  "Crear ideas": [
    {
      title: "Mira desde otro ángulo",
      description: "Encuentra alternativas para tu proyecto.",
      prompt: "Propón cinco enfoques diferentes para este proyecto: ",
    },
    {
      title: "Ordena tus ideas",
      description: "Convierte tus notas en un plan.",
      prompt: "Organiza estas ideas en un plan con próximos pasos:\n\n",
    },
    {
      title: "Haz las preguntas correctas",
      description: "Descubre lo que aún falta por pensar.",
      prompt: "Hazme preguntas que me ayuden a desarrollar esta idea: ",
    },
  ],
  Aprender: [
    {
      title: "Entiende lo esencial",
      description: "Un tema nuevo, explicado con claridad.",
      prompt: "Explícame con ejemplos sencillos este tema: ",
    },
    {
      title: "Aprende a tu ritmo",
      description: "Traza una ruta para seguir aprendiendo.",
      prompt: "Ayúdame a crear un plan para aprender ",
    },
    {
      title: "Ponlo en práctica",
      description: "Comprueba lo que has aprendido.",
      prompt: "Prepara preguntas de práctica sobre ",
    },
  ],
  Programar: [
    {
      title: "Desbloquea tu código",
      description: "Revisa un error paso a paso.",
      prompt: "Ayúdame a entender y resolver este error:\n\n",
    },
    {
      title: "Construye algo nuevo",
      description: "Empieza con una estructura clara.",
      prompt: "Quiero desarrollar esta funcionalidad. Ayúdame a planificarla: ",
    },
    {
      title: "Entiende cómo funciona",
      description: "Lee el código con otra perspectiva.",
      prompt: "Explícame qué hace este código y cómo podría mejorarlo:\n\n",
    },
  ],
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function loadConversations(): Conversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
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
  } catch {
    return [];
  }
}
const previewResponse =
  "Tu mensaje está listo. Esta es una vista previa de la conversación: todavía no hay un modelo de IA conectado.\n\nPuedes probar el editor, adjuntar notas y organizar tus conversaciones. Cuando conectemos el asistente, sus respuestas aparecerán aquí.";

function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [intent, setIntent] = useState<Intent>("Escribir");
  const [files, setFiles] = useState<Attachment[]>([]);
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
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
  }, [active]);
  useEffect(() => {
    if (!copiedId) return;
    const timeout = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedId]);

  function newConversation() {
    setActiveId(null);
    setDraft("");
    setFiles([]);
    setSidebarOpen(false);
    setNotice("");
    textarea.current?.focus();
  }
  function openConversation(id: string) {
    setActiveId(id);
    setDraft("");
    setFiles([]);
    setModal(null);
    setSidebarOpen(false);
  }
  function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = activeId ?? crypto.randomUUID();
    const messages: Message[] = [
      { id: crypto.randomUUID(), role: "user", text, files: files.map((file) => file.name) },
      { id: crypto.randomUUID(), role: "assistant", text: previewResponse },
    ];
    setConversations((current) => {
      const existing = current.find((item) => item.id === id);
      const conversation = existing
        ? { ...existing, messages: [...existing.messages, ...messages] }
        : { id, title: text.split("\n")[0].slice(0, 65), messages };
      return [conversation, ...current.filter((item) => item.id !== id)];
    });
    setActiveId(id);
    setDraft("");
    setFiles([]);
    setNotice("");
    textarea.current?.focus();
  }
  function onEditorKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }
  async function attach(selected: FileList | null) {
    if (!selected) return;
    const incoming: Attachment[] = [];
    for (const file of Array.from(selected)) {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
        setNotice("Adjunta archivos .txt o .md de hasta 2 MB.");
        continue;
      }
      try {
        incoming.push({ name: file.name, content: await file.text() });
      } catch {
        setNotice(`No se pudo leer ${file.name}.`);
      }
    }
    setFiles((current) => [...current, ...incoming].slice(0, 3));
    if (fileInput.current) fileInput.current.value = "";
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
              Vista previa
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
                      {message.role === "assistant" ? (
                        <span className="message-preview">Vista previa</span>
                      ) : null}
                    </div>
                    <p>{message.text}</p>
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
                    {message.role === "assistant" ? (
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
            <form className="composer" onSubmit={send}>
              <label className="sr-only" htmlFor="message-input">
                Escribe tu mensaje
              </label>
              {files.length ? (
                <div className="attachment-list">
                  {files.map((file, index) => (
                    <span key={`${file.name}-${index}`} className="attachment-chip">
                      <Icon name="file" size={16} />
                      {file.name}
                      <button
                        type="button"
                        aria-label={`Quitar ${file.name}`}
                        onClick={() =>
                          setFiles((current) => current.filter((_, item) => item !== index))
                        }
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
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
                <div className="composer-tools">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Adjuntar archivo de texto"
                    title="Adjuntar .txt o .md (hasta 2 MB)"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="paperclip" />
                  </button>
                  <span className="toolbar-divider" />
                  <span className="composer-mode">
                    <Mark />
                    <span>Asistente personal</span>
                  </span>
                </div>
                <button
                  className="send-button btn btn--primary"
                  type="submit"
                  aria-label="Enviar mensaje"
                  disabled={!draft.trim()}
                >
                  <Icon name="arrow" size={20} />
                </button>
              </div>
              <input
                className="sr-only"
                ref={fileInput}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                multiple
                tabIndex={-1}
                onChange={(event) => void attach(event.target.files)}
              />
            </form>
            {notice ? (
              <p className="inline-notice" role="status">
                {notice}
              </p>
            ) : null}
            {!active ? (
              <>
                <div className="intent-tabs" role="group" aria-label="¿Por dónde empezamos?">
                  {intents.map((item) => (
                    <button
                      type="button"
                      key={item.label}
                      className={intent === item.label ? "intent-tab is-selected" : "intent-tab"}
                      aria-pressed={intent === item.label}
                      onClick={() => setIntent(item.label)}
                    >
                      <Icon name={item.icon} size={17} />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="suggestions">
                  {suggestions[intent].map((suggestion, index) => (
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
                        <span className="suggestion-number">0{index + 1}</span>
                        <Icon name="chevron" size={16} />
                      </div>
                      <strong>{suggestion.title}</strong>
                      <p>{suggestion.description}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className="composer-footer">
              <span>
                {active
                  ? "Vista previa · Las respuestas de IA aún no están conectadas."
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
            Esta es la interfaz de tu futuro asistente de IA. Puedes escribir, organizar
            conversaciones y adjuntar notas de texto.
          </p>
          <div className="preview-explanation">
            <span className="small-status-dot" />
            <div>
              <strong>Estás en modo de vista previa</strong>
              <p>
                No hay un modelo de IA conectado. Las respuestas son de demostración y los archivos
                no se envían a ningún servidor.
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
