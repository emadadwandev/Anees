from enum import Enum


class SleepStage(str, Enum):
    deep = "deep"
    light = "light"
    rem = "rem"
    awake = "awake"


def classify_epoch(
    hr_bpm: int,
    rr_brpm: int,
    motion_magnitude: float,
    signal_quality: float,
) -> SleepStage:
    """
    Rule-based 30-second epoch classifier.
    Heuristic order: signal gate → awake → deep → rem → light.
    ML upgrade tracked in roadmap.
    """
    if signal_quality < 0.2:
        return SleepStage.awake

    if motion_magnitude > 0.5 or hr_bpm > 90:
        return SleepStage.awake

    if hr_bpm < 60 and rr_brpm < 12 and motion_magnitude < 0.1:
        return SleepStage.deep

    if 60 <= hr_bpm <= 80 and motion_magnitude < 0.2:
        return SleepStage.rem

    return SleepStage.light


def compute_fragmentation_index(epochs: list[str]) -> float:
    """
    Ratio of stage transitions to total epochs.
    Higher value = more fragmented (worse) sleep.
    """
    if len(epochs) < 2:
        return 0.0
    transitions = sum(1 for i in range(1, len(epochs)) if epochs[i] != epochs[i - 1])
    return round(transitions / len(epochs), 3)
