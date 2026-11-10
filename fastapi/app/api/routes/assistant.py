import ast
import json
import operator
from datetime import datetime
from typing import cast
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException
from openai import APIError, OpenAI
from openai.types.responses import FunctionToolParam, ResponseInputParam
from pydantic import BaseModel, Field

from app.api.assistant_models import (
    AssistantData,
    AssistantResponse,
    CalculationData,
    NotesData,
    ToolErrorData,
    WeatherData,
)
from app.core.config import settings

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantRequest(BaseModel):
    prompt: str = Field(min_length=1)


@router.post("/chat", response_model=AssistantResponse)
def assistant(request: AssistantRequest) -> AssistantResponse:
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.GROQ_API_KEY,
        timeout=30,
        max_retries=0,
    )

    tools: list[FunctionToolParam] = [
        # tool calculate
        {
            "type": "function",
            "name": "calculate",
            "description": "Realiza cálculos matemáticos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Expresión matemática, por ejemplo: 150 * 8",
                    }
                },
                "required": ["expression"],
                "additionalProperties": False,
            },
            "strict": True,
        },
        # tool get_weather
        {
            "type": "function",
            "name": "get_weather",
            "description": "Obtiene el clima actual de una ciudad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Nombre de la ciudad, por ejemplo: Ica, Perú.",
                    }
                },
                "required": ["city"],
                "additionalProperties": False,
            },
            "strict": True,
        },
        # tool search_notes
        {
            "type": "function",
            "name": "search_notes",
            "description": (
                "Busca información en notas ficticias por título o contenido."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Texto a buscar en las notas, por ejemplo: compras."
                        ),
                    }
                },
                "required": ["query"],
                "additionalProperties": False,
            },
            "strict": True,
        },
        # tool get_note_by_position
        {
            "type": "function",
            "name": "get_note_by_position",
            "description": (
                "Obtiene una nota por posición según su fecha de creación. "
                "La posición 1 con order asc es la primera nota; con desc es la última."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "position": {
                        "type": "integer",
                        "minimum": 1,
                        "description": (
                            "Posición: 1 para la primera, 3 para la tercera."
                        ),
                    },
                    "order": {
                        "type": "string",
                        "enum": ["asc", "desc"],
                        "description": (
                            "asc: de la más antigua a la más reciente. "
                            "desc: de la más reciente a la más antigua."
                        ),
                    },
                },
                "required": ["position", "order"],
                "additionalProperties": False,
            },
            "strict": True,
        },
    ]

    OPERATIONS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    NOTES: dict[str, dict[str, str]] = {
        "1": {
            "title": "Reunión del proyecto de AI",
            "content": (
                "Preparar la demo del asistente y revisar las tareas del equipo."
            ),
            "created_at": "2026-11-06T09:00:00-05:00",
        },
        "2": {
            "title": "Lista de compras",
            "content": "Comprar café, pan, leche y frutas para la semana.",
            "created_at": "2026-11-07T15:30:00-05:00",
        },
        "3": {
            "title": "Viaje a Ica",
            "content": "Reservar hotel en Ica y visitar la laguna de Huacachina.",
            "created_at": "2026-11-08T11:00:00-05:00",
        },
        "4": {
            "title": "Plan de estudio",
            "content": "Practicar Python y crear herramientas para el asistente.",
            "created_at": "2026-11-09T08:00:00-05:00",
        },
    }

    def calculate(expression: str):
        """Evalúa operaciones matemáticas permitidas."""

        if len(expression) > 100:
            raise ValueError("Expresión demasiado larga")

        def evaluate(node):
            if isinstance(node, ast.Constant):
                if type(node.value) in (int, float):
                    return node.value

            if isinstance(node, ast.BinOp):
                operation = OPERATIONS.get(type(node.op))

                if operation:
                    return operation(
                        evaluate(node.left),
                        evaluate(node.right),
                    )

            if isinstance(node, ast.UnaryOp):
                operation = OPERATIONS.get(type(node.op))

                if operation:
                    return operation(evaluate(node.operand))

            raise ValueError("Operación no permitida")

        tree = ast.parse(expression, mode="eval")
        return str(evaluate(tree.body))

    def get_weather(city: str) -> str:
        """Consulta el clima actual en Open-Meteo y devuelve un JSON para el modelo."""
        city = city.strip()
        if not city:
            return json.dumps(
                {"error": "Debes indicar una ciudad."}, ensure_ascii=False
            )

        try:
            search_params = urlencode({"name": city, "count": 1, "language": "es"})
            with urlopen(
                f"https://geocoding-api.open-meteo.com/v1/search?{search_params}",
                timeout=10,
            ) as response:
                locations = json.load(response).get("results", [])

            if not locations:
                return json.dumps(
                    {"error": f"No se encontró la ciudad: {city}."}, ensure_ascii=False
                )

            location = locations[0]
            weather_params = urlencode(
                {
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
                    "temperature_unit": "celsius",
                    "wind_speed_unit": "kmh",
                    "timezone": "auto",
                }
            )
            with urlopen(
                f"https://api.open-meteo.com/v1/forecast?{weather_params}", timeout=10
            ) as response:
                weather = json.load(response)

            return json.dumps(
                {
                    "city": location["name"],
                    "country": location.get("country", ""),
                    "timezone": weather["timezone"],
                    "current": weather["current"],
                    "units": weather["current_units"],
                    "source": "https://open-meteo.com/",
                },
                ensure_ascii=False,
            )
        except (URLError, TimeoutError, OSError):
            return json.dumps(
                {"error": "No se pudo consultar el clima. Inténtalo nuevamente."},
                ensure_ascii=False,
            )
        except (ValueError, KeyError, TypeError, IndexError):
            return json.dumps(
                {"error": "El servicio de clima devolvió una respuesta inválida."},
                ensure_ascii=False,
            )

    def search_notes(query: str) -> str:
        """Busca coincidencias parciales sin distinguir mayúsculas y devuelve JSON."""
        query = query.strip()
        if not query:
            return json.dumps(
                {"error": "Debes indicar un texto para buscar en las notas."},
                ensure_ascii=False,
            )

        search_text = query.casefold()
        results = [
            {"id": note_id, **note}
            for note_id, note in NOTES.items()
            if search_text in note["title"].casefold()
            or search_text in note["content"].casefold()
        ]
        return json.dumps({"query": query, "results": results}, ensure_ascii=False)

    def get_note_by_position(position: int, order: str = "asc") -> str:
        """Devuelve una nota por posición desde 1, en orden ascendente o descendente."""
        if type(position) is not int or position < 1:
            return json.dumps(
                {"error": "La posición debe ser un número entero mayor o igual a 1."},
                ensure_ascii=False,
            )

        if order not in ("asc", "desc"):
            return json.dumps(
                {"error": "El orden debe ser 'asc' o 'desc'."}, ensure_ascii=False
            )

        if not NOTES:
            return json.dumps({"error": "No hay notas guardadas."}, ensure_ascii=False)

        if position > len(NOTES):
            return json.dumps(
                {
                    "error": (
                        f"No existe una nota en la posición {position}. "
                        f"Hay {len(NOTES)} notas guardadas."
                    )
                },
                ensure_ascii=False,
            )

        ordered_notes = sorted(
            NOTES.items(),
            key=lambda item: datetime.fromisoformat(item[1]["created_at"]),
            reverse=order == "desc",
        )
        note_id, note = ordered_notes[position - 1]
        return json.dumps({"id": note_id, **note}, ensure_ascii=False)

    messages: ResponseInputParam = [{"role": "user", "content": request.prompt}]

    instructions = """
        Eres un asistente llamado Colly que ayuda a los usuarios con sus consultas.
        <instrucción>
        1. Para cálculos matemáticos debes llamar a calculate.
        2. Para consultas del clima usa get_weather.
        3. Para buscar notas por título o contenido usa search_notes.
        4. Para consultar notas por posición usa get_note_by_position y cuenta desde 1.
        Usa order="asc" para contar de la más antigua a la más reciente:
        primera nota: position=1; tercera: position=3; cuarta: position=4.
        Usa order="desc" para contar de la más reciente a la más antigua:
        última nota: position=1; penúltima: position=2.
        5. Si ninguna herramienta es necesaria, responde directamente.
        6. Si una herramienta devuelve un error, explícalo sin inventar resultados.
        7. Responde en español y en texto plano, sin Markdown ni asteriscos.
        Si usaste herramientas, resume el resultado en una o dos frases.
        La interfaz mostrará los datos en tarjetas; evita repetir todos los campos.
        </instrucción>
    """

    def call_function(name, arguments):
        if name == "calculate":
            return calculate(**arguments)
        if name == "get_weather":
            return get_weather(**arguments)
        if name == "search_notes":
            return search_notes(**arguments)
        if name == "get_note_by_position":
            return get_note_by_position(**arguments)
        raise ValueError(f"Función no soportada: {name}")

    data: list[AssistantData] = []
    tools_used: list[str] = []

    def build_card(name: str, arguments: dict, result: str) -> AssistantData:
        if name == "calculate":
            return CalculationData(expression=arguments["expression"], result=result)
        payload = json.loads(result)
        if "error" in payload:
            return ToolErrorData(tool=name, message=payload["error"])
        if name == "search_notes":
            return NotesData(items=payload["results"])
        if name == "get_note_by_position":
            return NotesData(items=[payload])
        return WeatherData(
            city=payload["city"],
            country=payload["country"],
            observed_at=payload["current"]["time"],
            timezone=payload["timezone"],
            temperature=payload["current"]["temperature_2m"],
            temperature_unit=payload["units"]["temperature_2m"],
            humidity=payload["current"]["relative_humidity_2m"],
            wind_speed=payload["current"]["wind_speed_10m"],
            wind_speed_unit=payload["units"]["wind_speed_10m"],
        )

    # Continue until the model finishes, including dependent tool calls.
    try:
        for step in range(6):
            response = client.responses.create(
                model="openai/gpt-oss-120b",
                instructions=instructions,
                input=messages,
                tools=tools,
                tool_choice="none" if step == 5 else "auto",
            )
            messages.extend(
                cast(
                    ResponseInputParam,
                    [item.model_dump(exclude_none=True) for item in response.output],
                )
            )
            calls = [item for item in response.output if item.type == "function_call"]
            if not calls:
                if not response.output_text.strip():
                    raise HTTPException(502, "El asistente no devolvió una respuesta.")
                return AssistantResponse(
                    response=response.output_text, data=data, tools_used=tools_used
                )

            for tool in calls:
                if tool.name not in tools_used:
                    tools_used.append(tool.name)
                try:
                    arguments = json.loads(tool.arguments)
                    if not isinstance(arguments, dict):
                        raise ValueError("Argumentos inválidos")
                    result = call_function(tool.name, arguments)
                    card = build_card(tool.name, arguments, result)
                except (ValueError, TypeError, KeyError, ArithmeticError, SyntaxError):
                    message = "No se pudo completar esta consulta. Revisa los datos."
                    card = ToolErrorData(tool=tool.name, message=message)
                    result = json.dumps({"error": message}, ensure_ascii=False)
                data.append(card)
                messages.append(
                    {
                        "type": "function_call_output",
                        "call_id": tool.call_id,
                        "output": result,
                    }
                )
    except APIError as exc:
        raise HTTPException(
            502, "No se pudo contactar al asistente. Inténtalo nuevamente."
        ) from exc
    finally:
        client.close()

    raise HTTPException(502, "El asistente no pudo completar la consulta.")
