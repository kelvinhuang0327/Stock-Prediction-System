from typing import Dict, Optional
from .models import Hypothesis, DomainType
import json
from pathlib import Path

class HypothesisRegistry:
    def __init__(self, storage_path: Optional[str] = None):
        self._registry: Dict[str, Hypothesis] = {}
        self._storage_path = storage_path

    def register(self, hypothesis: Hypothesis) -> bool:
        if hypothesis.id in self._registry:
            return False
        self._registry[hypothesis.id] = hypothesis
        return True

    def exists(self, hypothesis_id: str) -> bool:
        return hypothesis_id in self._registry

    def reject_post_hoc(self, hypothesis_id: str) -> bool:
        """Returns True if hypothesis is post-hoc (not pre-registered)."""
        h = self._registry.get(hypothesis_id)
        if h is None:
            return True  # not registered at all = post-hoc
        return not h.pre_registered

    def get(self, hypothesis_id: str) -> Optional[Hypothesis]:
        return self._registry.get(hypothesis_id)
