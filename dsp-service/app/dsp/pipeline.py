import numpy as np
from scipy.signal import butter, filtfilt, find_peaks

LAMBDA_MM = 3.9       # wavelength at 77 GHz in mm
LAMBDA_M = LAMBDA_MM / 1000


def extract_phase_signal(point_cloud: list[dict]) -> np.ndarray:
    velocities = np.array([p["v"] for p in point_cloud])
    # Phase shift: ΔΦ = (4π/λ) · d(t); d(t) ≈ v * dt at 20 fps
    dt = 1 / 20
    displacement = velocities * dt
    return (4 * np.pi / LAMBDA_M) * displacement


def bandpass_filter(signal: np.ndarray, lowcut: float, highcut: float, fs: float = 20.0) -> np.ndarray:
    if len(signal) < 15:
        return signal
    nyq = fs / 2
    low = lowcut / nyq
    high = min(highcut / nyq, 0.99)
    b, a = butter(4, [low, high], btype="band")
    return filtfilt(b, a, signal)


def estimate_heart_rate(phase: np.ndarray, fs: float = 20.0) -> tuple[int, float]:
    hr_signal = bandpass_filter(phase, 0.8, 2.5, fs)
    if len(hr_signal) < 10:
        return 72, 0.0
    peaks, _ = find_peaks(hr_signal, distance=int(fs * 0.4), prominence=0.01)
    if len(peaks) < 2:
        return 72, 0.3
    intervals = np.diff(peaks) / fs
    mean_interval = float(np.mean(intervals))
    bpm = int(60 / mean_interval) if mean_interval > 0 else 72
    bpm = max(30, min(200, bpm))
    quality = min(1.0, len(peaks) / 5)
    return bpm, quality


def estimate_resp_rate(phase: np.ndarray, fs: float = 20.0) -> int:
    rr_signal = bandpass_filter(phase, 0.1, 0.5, fs)
    if len(rr_signal) < 10:
        return 14
    peaks, _ = find_peaks(rr_signal, distance=int(fs * 2), prominence=0.005)
    if len(peaks) < 2:
        return 14
    intervals = np.diff(peaks) / fs
    mean_interval = float(np.mean(intervals))
    brpm = int(60 / mean_interval) if mean_interval > 0 else 14
    return max(4, min(40, brpm))


def compute_signal_quality(point_cloud: list[dict]) -> float:
    if not point_cloud:
        return 0.0
    return float(np.mean([p["snr"] for p in point_cloud]))


def compute_motion_magnitude(point_cloud: list[dict]) -> float:
    """RMS of radial velocities across all detected points.
    Near 0 = still, >0.5 = active movement."""
    if not point_cloud:
        return 0.0
    velocities = np.array([p["v"] for p in point_cloud])
    return round(float(np.sqrt(np.mean(velocities ** 2))), 4)


def process_frame(payload: dict) -> dict:
    pc = payload["point_cloud"]
    phase = extract_phase_signal(pc)
    hr_bpm, peak_quality = estimate_heart_rate(phase)
    rr_brpm = estimate_resp_rate(phase)
    snr_quality = compute_signal_quality(pc)
    final_quality = (peak_quality + snr_quality) / 2
    motion_magnitude = compute_motion_magnitude(pc)
    return {
        "heart_rate_bpm": hr_bpm,
        "resp_rate_brpm": rr_brpm,
        "signal_quality": round(final_quality, 3),
        "motion_magnitude": motion_magnitude,
    }
