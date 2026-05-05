from typing import List, Tuple

class LeakageDetector:
    def check_temporal_order(self, timestamps: List) -> Tuple[bool, str]:
        """Returns (no_leakage, message). Checks timestamps are strictly ascending."""
        for i in range(1, len(timestamps)):
            if timestamps[i] <= timestamps[i-1]:
                return False, f"Temporal order violation at index {i}: {timestamps[i]} <= {timestamps[i-1]}"
        return True, "Temporal order OK"

    def check_target_access(self, feature_timestamps: List, target_timestamps: List) -> Tuple[bool, str]:
        """Ensure features are always before their targets."""
        for ft, tt in zip(feature_timestamps, target_timestamps):
            if ft >= tt:
                return False, f"Feature timestamp {ft} >= target timestamp {tt} — look-ahead detected"
        return True, "Target access order OK"

    def detect(self, data_meta: dict) -> Tuple[bool, str]:
        """
        Generalized leakage detection entry point.
        data_meta must have: 'temporal_order_ok', 'target_access_ok', 'pit_enforced'
        Returns (clean, message).
        """
        if not data_meta.get("temporal_order_ok", False):
            return False, "Temporal order violation detected"
        if not data_meta.get("target_access_ok", False):
            return False, "Target access leakage detected"
        if not data_meta.get("pit_enforced", False):
            return False, "Point-in-time (PIT) enforcement not confirmed"
        return True, "No leakage detected"
