# FastAPI Starter

Deploy your [FastAPI](https://fastapi.tiangolo.com/) project to Vercel with zero configuration.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel/vercel/tree/main/examples/fastapi&template=fastapi)

_Live Example: https://vercel-plus-fastapi.vercel.app/_

Visit the [FastAPI documentation](https://fastapi.tiangolo.com/) to learn more.

## Project Structure

This example follows the [larger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) pattern from the FastAPI docs:

```
app/
├── __init__.py
├── main.py              # FastAPI application entry point
├── templates/
│   └── index.html       # Landing page template
├── api/
│   ├── __init__.py
│   ├── main.py          # API router assembly
│   ├── deps.py          # Shared dependencies
│   └── routes/
│       ├── __init__.py
│       └── items.py     # Item endpoints
└── core/
    ├── __init__.py
    └── config.py        # Application settings
```

## Getting Started

Install the required dependencies using [uv](https://docs.astral.sh/uv/):

```bash
uv sync
```

## Running Locally

```bash
vercel dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page |
| `GET` | `/api/v1/items/` | List sample items |
| `GET` | `/api/v1/items/{item_id}` | Get item by ID |
| `GET` | `/docs` | Interactive API docs (Swagger UI) |
| `POST` | `/api/v1/assistant/assistant` | Hybrid assistant response: text and typed tool results |

The assistant accepts `{ "prompt": "..." }`. Configure `GROQ_API_KEY` in
`.env.local`. Its response preserves the `response` text field and adds `data`,
an array of `notes`, `calculation`, `weather`, or `error` cards generated directly
from executed tools. Plain text replies return an empty array. See `/docs` for
the complete Pydantic response schema and `../frontend/README.md` for local setup.

Run backend contract tests with `uv run python -m unittest discover -s tests -v`.
These use controlled upstream responses; they do not contact Groq or Open-Meteo.

## Deploying to Vercel

Deploy your project to Vercel with the following command:

```bash
npm install -g vercel
vercel --prod
```

Or `git push` to your repository with our [git integration](https://vercel.com/docs/deployments/git).

To view the source code for this template, [visit the example repository](https://github.com/vercel/vercel/tree/main/examples/fastapi).
