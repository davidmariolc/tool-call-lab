from typing import Annotated, Literal

from pydantic import BaseModel, Field


class Note(BaseModel):
    id: str
    title: str
    content: str
    created_at: str


class NotesData(BaseModel):
    type: Literal["notes"] = "notes"
    items: list[Note]


class CalculationData(BaseModel):
    type: Literal["calculation"] = "calculation"
    expression: str
    result: str


class WeatherData(BaseModel):
    type: Literal["weather"] = "weather"
    city: str
    country: str
    observed_at: str
    timezone: str
    temperature: float = Field(allow_inf_nan=False)
    temperature_unit: str
    humidity: float = Field(ge=0, le=100, allow_inf_nan=False)
    wind_speed: float = Field(ge=0, allow_inf_nan=False)
    wind_speed_unit: str
    source: Literal["https://open-meteo.com/"] = "https://open-meteo.com/"


class ToolErrorData(BaseModel):
    type: Literal["error"] = "error"
    tool: str
    message: str


AssistantData = Annotated[
    NotesData | CalculationData | WeatherData | ToolErrorData,
    Field(discriminator="type"),
]


class AssistantResponse(BaseModel):
    response: str
    data: list[AssistantData] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
