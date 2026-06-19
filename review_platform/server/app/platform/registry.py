from app.platform.business_line import BusinessLine, BusinessLineManifest


class BusinessLineRegistry:
    def __init__(self) -> None:
        self._lines: dict[str, BusinessLine] = {}

    def register(self, line: BusinessLine) -> None:
        manifest = line.get_manifest()
        if manifest.line_id in self._lines:
            raise ValueError(f"business line already registered: {manifest.line_id}")
        self._lines[manifest.line_id] = line

    def get(self, line_id: str) -> BusinessLine:
        try:
            return self._lines[line_id]
        except KeyError as exc:
            raise KeyError(f"unknown business line: {line_id}") from exc

    def list_manifests(self) -> list[BusinessLineManifest]:
        return [line.get_manifest() for line in self._lines.values()]


registry = BusinessLineRegistry()

