import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

async def get_weather_mock(city: str):
    """
    A sample tool that returns mock weather data.
    """
    logger.info(f"Mock weather requested for: {city}")
    return {
        "city": city,
        "temperature": "22°C",
        "condition": "Partly Cloudy",
        "forecast": "Sunny intervals for the rest of the day."
    }

def initialize_plugin(registry: Any):
    """
    This function is called by the plugin loader to register tools.
    """
    definition = {
        "type": "function",
        "function": {
            "name": "get_weather_plugin",
            "description": "Get mock weather information for a city. Use this as an example of a plugin tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "The city name."},
                },
                "required": ["city"],
            },
        },
    }
    
    # Register the handler and the definition
    registry.register_tool("get_weather_plugin", get_weather_mock, definition)
