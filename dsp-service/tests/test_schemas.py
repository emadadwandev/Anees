from app.dsp.schemas import MmWavePayload


def test_mmwave_payload_accepts_uuid_strings_from_json():
    payload = MmWavePayload.model_validate({
        "device_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "patient_id": "ffffffff-aaaa-bbbb-cccc-dddddddddddd",
        "timestamp": 1,
        "frame_seq": 1,
        "firmware_version": "2.4.1",
        "point_cloud": [{"x": 0.0, "y": 0.0, "z": 0.0, "v": 0.0, "snr": 0.5}],
    })

    assert str(payload.device_id) == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    assert str(payload.patient_id) == "ffffffff-aaaa-bbbb-cccc-dddddddddddd"
