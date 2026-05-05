from pathlib import Path
from typing import List, Tuple

TRUSTED_SOURCES = [
    "wiki/README.md",
    "wiki/system/governance.md",
    "wiki/system/validation_gates.md",
    "wiki/system/strategy_retirement_policy.md",
    "wiki/system/feedback_loop.md",
    "wiki/system/stability_audit.md",
    "memory/lessons.md",
    "memory/MEMORY.md",
]

UNTRUSTED_PATTERNS = [
    "archive/", "legacy/", "docs/archive/",
]

class KnowledgeGate:
    def required_sources(self) -> List[str]:
        return TRUSTED_SOURCES

    def validate_sources(self, requested_paths: List[str], base_dir: str = ".") -> Tuple[bool, List[str]]:
        """
        Returns (all_trusted, list_of_untrusted_paths).
        Checks that all requested paths are from trusted sources.
        """
        untrusted = []
        for path in requested_paths:
            norm = path.replace("\\", "/")
            is_trusted = any(norm.endswith(s) or norm == s for s in TRUSTED_SOURCES)
            is_untrusted = any(p in norm for p in UNTRUSTED_PATTERNS)
            if is_untrusted or not is_trusted:
                untrusted.append(path)
        return len(untrusted) == 0, untrusted
