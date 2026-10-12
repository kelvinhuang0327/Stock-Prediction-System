import json
from pathlib import Path
from typing import Optional
from .models import EvidenceBundle

class EvidenceCollector:
    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = Path(output_dir)

    def collect(self, bundle: EvidenceBundle) -> EvidenceBundle:
        """Add metadata to bundle."""
        import datetime
        bundle.metadata["collected_at"] = datetime.datetime.utcnow().isoformat()
        return bundle

    def write_json(self, bundle: EvidenceBundle, filename: Optional[str] = None) -> str:
        """Write evidence bundle to JSON file. Returns file path."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        if filename is None:
            filename = f"evidence_{bundle.strategy_id}.json"
        path = self.output_dir / filename
        with open(path, "w") as f:
            json.dump(bundle.to_dict(), f, indent=2, ensure_ascii=False)
        return str(path)
