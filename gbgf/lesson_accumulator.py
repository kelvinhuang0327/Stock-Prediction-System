from pathlib import Path
from typing import Optional
import datetime

class LessonAccumulator:
    def __init__(self, lessons_path: str = "memory/lessons.md"):
        self.lessons_path = Path(lessons_path)

    def _get_next_id(self) -> str:
        if not self.lessons_path.exists():
            return "L001"
        content = self.lessons_path.read_text()
        ids = []
        for line in content.split("\n"):
            if line.startswith("## L") or line.startswith("### L"):
                try:
                    num = int(line.split("L")[1].split()[0].split(":")[0])
                    ids.append(num)
                except (IndexError, ValueError):
                    pass
        return f"L{(max(ids) + 1):03d}" if ids else "L001"

    def format_lesson(self, lesson_text: str, tags: Optional[list] = None, source: str = "") -> str:
        lesson_id = self._get_next_id()
        ts = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        tag_str = ", ".join(tags or [])
        lines = [
            f"## {lesson_id}: {lesson_text[:80]}",
            f"- **Date:** {ts}",
            f"- **Source:** {source}",
        ]
        if tag_str:
            lines.append(f"- **Tags:** {tag_str}")
        lines.append(f"- **Detail:** {lesson_text}")
        return "\n".join(lines)

    def append_lesson_dry_run(self, lesson_text: str, tags: Optional[list] = None, source: str = "") -> str:
        """Returns formatted lesson WITHOUT writing to disk (dry run)."""
        return self.format_lesson(lesson_text, tags=tags, source=source)
