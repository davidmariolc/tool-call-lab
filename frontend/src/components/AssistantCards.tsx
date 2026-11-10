import type { AssistantData } from "../lib/assistant";
import { Icon } from "./Icon";
import "./AssistantCards.css";

const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });
const numberFormat = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

function ResultCard({ card }: { card: AssistantData }) {
  switch (card.type) {
    case "notes":
      return (
        <section className="result-card" aria-label="Notas encontradas">
          <div className="result-card-heading">
            <Icon name="file" size={18} />
            <h3>Notas</h3>
            <span className="result-count">{card.items.length}</span>
          </div>
          {card.items.length ? (
            <ul className="result-notes">
              {card.items.map((note) => (
                <li key={note.id}>
                  <h4>{note.title}</h4>
                  <p>{note.content}</p>
                  <time dateTime={note.created_at}>
                    {dateFormat.format(new Date(note.created_at))}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="result-empty">No se encontraron notas que coincidan con tu búsqueda.</p>
          )}
        </section>
      );
    case "calculation":
      return (
        <section className="result-card" aria-label="Resultado del cálculo">
          <div className="result-card-heading">
            <Icon name="calculator" size={18} />
            <h3>Cálculo</h3>
          </div>
          <div className="result-calculation">
            <code>{card.expression}</code>
            <span aria-hidden="true">=</span>
            <output>{card.result}</output>
          </div>
        </section>
      );
    case "weather":
      return (
        <section className="result-card" aria-label={`Clima en ${card.city}`}>
          <div className="result-card-heading">
            <Icon name="sun" size={18} />
            <h3>
              {card.city}
              {card.country ? `, ${card.country}` : ""}
            </h3>
            <span className="result-weather-label">Clima actual</span>
          </div>
          <div className="result-temperature">
            {numberFormat.format(card.temperature)}
            <span>{card.temperature_unit}</span>
          </div>
          <dl className="result-weather-details">
            <div>
              <dt>Humedad</dt>
              <dd>{numberFormat.format(card.humidity)} %</dd>
            </div>
            <div>
              <dt>Viento</dt>
              <dd>
                {numberFormat.format(card.wind_speed)} {card.wind_speed_unit}
              </dd>
            </div>
          </dl>
          <div className="result-weather-footer">
            <span>
              Medición: {card.observed_at.replace("T", " · ")} ({card.timezone})
            </span>
            <a href={card.source} target="_blank" rel="noreferrer">
              Open-Meteo ↗
            </a>
          </div>
        </section>
      );
    case "error":
      return (
        <section className="result-card result-card--error" aria-label="Consulta sin completar">
          <div className="result-card-heading">
            <Icon name="help" size={18} />
            <h3>No pudimos completar esta consulta</h3>
          </div>
          <p className="result-empty">{card.message}</p>
        </section>
      );
  }
}

export function AssistantCards({ data }: { data: AssistantData[] }) {
  return (
    <div className="assistant-results">
      {data.map((card, index) => (
        <ResultCard key={index} card={card} />
      ))}
    </div>
  );
}
