from fastapi import APIRouter
from openai import OpenAI
from openai.types.responses import FunctionToolParam, ResponseInputParam

from app.core.config import settings

router = APIRouter(prefix="/assistant", tags=["assistant"])

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=settings.GROQ_API_KEY,
)

tools: list[FunctionToolParam] = [
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
    }
]


def calculate() -> str:
    return "soy la respuesta de la tool calculate."


messages: ResponseInputParam = [{"role": "user", "content": "cuanto es 2*2 ?"}]

response = client.responses.create(
    model="openai/gpt-oss-120b",
    instructions="Eres un asistente llamado Colly que ayuda a los usuarios.",
    input=messages,
    tools=tools,
    tool_choice="auto",
)


for item in response.output:
    if item.type == "function_call":
        if item.name == "calculate":
            result = calculate()
            messages.append(
                {
                    "type": "function_call_output",
                    "call_id": item.call_id,
                    "output": result,
                }
            )


response = client.responses.create(
    model="openai/gpt-oss-120b", input=messages, tools=tools
)
print(response.output_text)

# response = client.chat.completions.create(
#     model="openai/gpt-oss-120b",
#     messages=[{"role": "user", "content": "Explain closures in one paragraph."}],
# )


@router.get("/hello")
def say_hello():
    return "hello, world!"
