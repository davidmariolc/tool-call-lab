"""Contract tests with real SDK serialization and controlled upstream responses."""

import importlib
import io
import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from openai import OpenAI

os.environ.setdefault("GROQ_API_KEY", "test-key")

from app.main import app  # noqa: E402

assistant_module = importlib.import_module("app.api.routes.assistant")


def tool_call(name, arguments, call_id="call-1"):
    return {
        "type": "function_call",
        "id": f"fc-{call_id}",
        "call_id": call_id,
        "name": name,
        "arguments": json.dumps(arguments),
    }


def text_output(text="Aquí tienes los resultados."):
    return {
        "type": "message",
        "id": "msg-1",
        "role": "assistant",
        "status": "completed",
        "content": [{"type": "output_text", "text": text, "annotations": []}],
    }


class AssistantTests(unittest.TestCase):
    def request(self, outputs, status=200):
        requests = []

        def upstream(request):
            requests.append(json.loads(request.content))
            if status != 200:
                return httpx.Response(status, json={"error": {"message": "private"}})
            return httpx.Response(
                200,
                json={
                    "id": "resp-1",
                    "object": "response",
                    "created_at": 0,
                    "status": "completed",
                    "model": "openai/gpt-oss-120b",
                    "output": outputs.pop(0),
                },
            )

        sdk = OpenAI(
            api_key="test-key",
            base_url="https://upstream.invalid/v1",
            http_client=httpx.Client(transport=httpx.MockTransport(upstream)),
            max_retries=0,
        )
        with patch.object(assistant_module, "OpenAI", return_value=sdk):
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/assistant/assistant", json={"prompt": "Mi consulta"}
                )
        return response, requests

    def test_plain_response_needs_no_card_or_tool(self):
        response, requests = self.request([[text_output("Hola.")]])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"response": "Hola.", "data": [], "tools_used": []}
        )
        self.assertEqual(requests[0]["tool_choice"], "auto")

    def test_multiple_and_dependent_tools_keep_authoritative_data(self):
        response, requests = self.request(
            [
                [
                    tool_call("get_note_by_position", {"position": 3, "order": "asc"}),
                    tool_call("calculate", {"expression": "150 * 8"}, "call-2"),
                ],
                [tool_call("calculate", {"expression": "1200 / 2"}, "call-3")],
                [text_output("Consulta completada.")],
            ]
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["response"], "Consulta completada.")
        self.assertEqual(body["tools_used"], ["get_note_by_position", "calculate"])
        self.assertEqual(body["data"][0]["items"][0]["title"], "Viaje a Ica")
        self.assertEqual(body["data"][1]["result"], "1200")
        self.assertEqual(body["data"][2]["result"], "600.0")
        self.assertEqual(len(requests), 3)
        results = [
            item
            for item in requests[1]["input"]
            if item.get("type") == "function_call_output"
        ]
        self.assertEqual([item["call_id"] for item in results], ["call-1", "call-2"])
        self.assertEqual(requests[0]["instructions"], requests[2]["instructions"])

    def test_empty_notes_are_successful_but_missing_position_is_an_error(self):
        for name, arguments, expected_type in [
            ("search_notes", {"query": "does-not-exist"}, "notes"),
            ("get_note_by_position", {"position": 90, "order": "asc"}, "error"),
        ]:
            with self.subTest(name=name):
                response, _ = self.request(
                    [[tool_call(name, arguments)], [text_output()]]
                )
                self.assertEqual(response.status_code, 200)
                card = response.json()["data"][0]
                self.assertEqual(card["type"], expected_type)
                if expected_type == "notes":
                    self.assertEqual(card["items"], [])
                else:
                    self.assertIn("No existe una nota", card["message"])

    def test_invalid_calculation_and_arguments_become_tool_errors(self):
        for arguments in [{"expression": "1 / 0"}, {"expression": "2 ** 8"}, []]:
            with self.subTest(arguments=arguments):
                response, requests = self.request(
                    [[tool_call("calculate", arguments)], [text_output()]]
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["data"][0]["type"], "error")
                self.assertEqual(response.json()["tools_used"], ["calculate"])
                result = requests[1]["input"][-1]
                self.assertIn("error", json.loads(result["output"]))

    def test_weather_card_uses_actual_units_and_observation(self):
        responses = [
            {
                "results": [
                    {
                        "name": "Ica",
                        "country": "Perú",
                        "latitude": -14,
                        "longitude": -75,
                    }
                ]
            },
            {
                "timezone": "America/Lima",
                "current": {
                    "time": "2026-11-09T10:15",
                    "temperature_2m": 24,
                    "relative_humidity_2m": 60,
                    "wind_speed_10m": 12,
                },
                "current_units": {"temperature_2m": "°C", "wind_speed_10m": "km/h"},
            },
        ]
        with patch.object(
            assistant_module,
            "urlopen",
            side_effect=[io.StringIO(json.dumps(payload)) for payload in responses],
        ):
            response, _ = self.request(
                [[tool_call("get_weather", {"city": "Ica"})], [text_output()]]
            )
        self.assertEqual(response.status_code, 200)
        card = response.json()["data"][0]
        self.assertEqual(card["type"], "weather")
        self.assertEqual(card["temperature"], 24)
        self.assertEqual(card["temperature_unit"], "°C")
        self.assertEqual(card["observed_at"], "2026-11-09T10:15")
        self.assertEqual(card["source"], "https://open-meteo.com/")

    def test_weather_unavailability_never_creates_weather_data(self):
        with patch.object(assistant_module, "urlopen", side_effect=TimeoutError):
            response, _ = self.request(
                [[tool_call("get_weather", {"city": "Ica"})], [text_output()]]
            )
        self.assertEqual(response.status_code, 200)
        card = response.json()["data"][0]
        self.assertEqual(card["type"], "error")
        self.assertIn("No se pudo consultar el clima", card["message"])

    def test_upstream_failure_is_a_sanitized_http_error(self):
        response, _ = self.request([], status=503)
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private", response.text)

    def test_tool_loop_has_a_limit(self):
        response, requests = self.request(
            [
                [tool_call("calculate", {"expression": "2 * 2"}, f"call-{i}")]
                for i in range(6)
            ]
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(requests), 6)
        self.assertEqual(requests[-1]["tool_choice"], "none")


if __name__ == "__main__":
    unittest.main()
