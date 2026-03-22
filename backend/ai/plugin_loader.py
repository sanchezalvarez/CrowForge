import os
import importlib.util
import logging
from typing import Any, Callable, Awaitable, List, Dict
from backend.ai.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)

class GlobalPluginRegistry:
    """Singleton to store tools and definitions loaded from plugins."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GlobalPluginRegistry, cls).__new__(cls)
            cls._instance.tools: Dict[str, Callable[..., Awaitable[Any]]] = {}
            cls._instance.definitions: List[dict] = []
            cls._instance.plugin_records: List[dict] = []
        return cls._instance

    def register_tool(self, name: str, handler: Callable[..., Awaitable[Any]], definition: dict):
        self.tools[name] = handler
        self.definitions.append(definition)
        logger.info(f"Plugin tool registered: {name}")

    def apply_to(self, registry: ToolRegistry):
        """Apply all plugin tools to a local ToolRegistry."""
        for name, handler in self.tools.items():
            registry.register(name, handler)
        for definition in self.definitions:
            registry.add_dynamic_definition(definition)

    def get_records(self) -> List[dict]:
        return self.plugin_records

def load_plugins(plugin_dir: str = "plugins"):
    """Discover and load all .py files in the plugin_dir."""
    registry = GlobalPluginRegistry()

    # Clear existing state so reload works correctly
    registry.tools.clear()
    registry.definitions.clear()
    registry.plugin_records.clear()

    if not os.path.exists(plugin_dir):
        os.makedirs(plugin_dir)
        with open(os.path.join(plugin_dir, "__init__.py"), "w") as f:
            pass
        return

    for filename in sorted(os.listdir(plugin_dir)):
        if filename.endswith(".py") and filename != "__init__.py":
            plugin_name = filename[:-3]
            file_path = os.path.join(plugin_dir, filename)
            tools_before = list(registry.tools.keys())

            try:
                spec = importlib.util.spec_from_file_location(plugin_name, file_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    if hasattr(module, "initialize_plugin"):
                        module.initialize_plugin(registry)
                        tools_added = [t for t in registry.tools if t not in tools_before]
                        registry.plugin_records.append({
                            "name": plugin_name,
                            "file": file_path,
                            "tools": tools_added,
                            "status": "ok",
                            "error": None,
                        })
                        logger.info(f"Loaded plugin: {plugin_name}")
                    else:
                        registry.plugin_records.append({
                            "name": plugin_name,
                            "file": file_path,
                            "tools": [],
                            "status": "error",
                            "error": "Missing initialize_plugin(registry) function",
                        })
                        logger.warning(f"Plugin {plugin_name} is missing initialize_plugin function.")
            except Exception as e:
                registry.plugin_records.append({
                    "name": plugin_name,
                    "file": file_path,
                    "tools": [],
                    "status": "error",
                    "error": str(e),
                })
                logger.error(f"Failed to load plugin {plugin_name}: {e}")
