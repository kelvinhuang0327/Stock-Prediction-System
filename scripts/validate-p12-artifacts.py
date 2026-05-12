#!/usr/bin/env python3
"""PART H: Artifact validation for P12-HARDRESET"""
import json, sys

files = [
    'outputs/online_validation/p12pit_feature_contract_preflight_audit.json',
    'outputs/online_validation/p12pit_feature_source_discovery.json',
    'outputs/online_validation/p12pit_feature_contract_v0.json',
    'outputs/online_validation/p12pit_feature_contract_validation.json',
]

errors = []

for f in files:
    try:
        d = json.load(open(f))
        print(f'OK: {f}')
    except Exception as e:
        errors.append(f'FAIL {f}: {e}')

# Contract structure
c = json.load(open('outputs/online_validation/p12pit_feature_contract_v0.json'))
assert c.get('contractVersion') == 'p12-pit-feature-contract-v0', 'Bad contractVersion'
assert isinstance(c.get('featureSourceContracts'), list), 'featureSourceContracts not a list'
assert len(c['featureSourceContracts']) > 0, 'featureSourceContracts empty'
assert isinstance(c.get('pitSafetyRequirements'), list), 'pitSafetyRequirements not a list'
assert 'snapshotCaptureRequirements' in c, 'missing snapshotCaptureRequirements'
print('Contract structure: OK')

# Validation status
v = json.load(open('outputs/online_validation/p12pit_feature_contract_validation.json'))
assert v.get('validationStatus') in ('PASS', 'PARTIAL', 'FAIL'), 'Bad validationStatus'
print(f"Validation status: {v['validationStatus']}")

# Frozen corpus line counts
corpus_counts = [
    ('simulation_snapshot_corpus.jsonl', 60),
    ('p1baseline_historical_replay_corpus.jsonl', 9900),
    ('p3active_scoring_historical_replay_corpus.jsonl', 4500),
]
for fname, expected in corpus_counts:
    path = f'outputs/online_validation/{fname}'
    with open(path) as ff:
        actual = sum(1 for line in ff if line.strip())
    assert actual == expected, f'{fname}: expected {expected}, got {actual}'
    print(f'Corpus {fname}: {actual} lines OK')

if errors:
    print('ERRORS:', errors)
    sys.exit(1)

print()
print('PART H: ALL CHECKS PASSED')
