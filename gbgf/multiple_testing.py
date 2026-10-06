from typing import List, Tuple

class MultipleTestingCorrector:
    def bonferroni(self, p_values: List[float], alpha: float = 0.05) -> List[bool]:
        """Returns list of booleans: True if hypothesis passes after Bonferroni correction."""
        n = len(p_values)
        if n == 0:
            return []
        threshold = alpha / n
        return [p < threshold for p in p_values]

    def bh_fdr(self, p_values: List[float], alpha: float = 0.05) -> List[bool]:
        """Benjamini-Hochberg FDR correction. Returns True if hypothesis is significant."""
        n = len(p_values)
        if n == 0:
            return []
        indexed = sorted(enumerate(p_values), key=lambda x: x[1])
        results = [False] * n
        for rank, (orig_idx, p) in enumerate(indexed, 1):
            if p <= (rank / n) * alpha:
                results[orig_idx] = True
        return results
