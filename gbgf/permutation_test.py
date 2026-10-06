import random
from typing import List, Optional

class PermutationNullTest:
    def __init__(self, n_permutations: int = 10000, seed: int = 42):
        self.n_permutations = n_permutations
        self.seed = seed

    def evaluate_pvalue(self, observed_edge: float, null_distribution: Optional[List[float]] = None) -> float:
        """
        Returns p-value: fraction of null distribution >= observed_edge.
        If null_distribution not provided, generates uniform null as placeholder.
        """
        if null_distribution is None:
            rng = random.Random(self.seed)
            null_distribution = [rng.gauss(0, 1) for _ in range(self.n_permutations)]
        p_value = sum(1 for v in null_distribution if v >= observed_edge) / len(null_distribution)
        return p_value

    def pass_threshold(self, p_value: float, alpha: float = 0.05) -> bool:
        return p_value < alpha
