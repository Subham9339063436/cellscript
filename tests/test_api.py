import json
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_BINARY = ROOT / "build" / "cellscript-api"


def request_json(url, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
        method="GET" if data is None else "POST"
    )
    with urllib.request.urlopen(request, timeout=2) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def test_http_api_health_and_evaluation():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen(
        [str(API_BINARY), str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        for _ in range(40):
            if process.poll() is not None:
                raise AssertionError("API process exited before becoming ready")
            try:
                status, health = request_json(base_url + "/health")
                if status == 200:
                    break
            except (OSError, urllib.error.URLError):
                time.sleep(0.05)
        else:
            raise AssertionError("API did not become ready in time")

        status, result = request_json(base_url + "/evaluate", {
            "formulas": {
                "A1": "=10",
                "B1": "=A1*2",
                "C1": "=SUM(A1:B1)",
                "D1": "=COUNT(A1:C1,E1)"
            },
            "values": {"E1": 8}
        })
        assert status == 200
        assert result["values"]["A1"] == 10
        assert result["values"]["B1"] == 20
        assert result["values"]["C1"] == 30
        assert result["values"]["D1"] == 4
        assert result["errors"] == {}

        # Dashboard diagnostic tabs use these compiler-stage outputs.
        assert result["tokens"]["B1"]
        assert result["tokens"]["B1"][0]["type"] == "Equals"
        assert "BinaryOp(*)" in result["asts"]["B1"]
        assert result["dependencies"]["B1"] == ["A1"]
        assert "evaluationOrder" in result

        _, cycle = request_json(base_url + "/evaluate", {
            "formulas": {"A1": "=B1+1", "B1": "=A1+1"},
            "values": {}
        })
        assert "A1" in cycle["errors"] and "B1" in cycle["errors"]
    finally:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
