import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / "build" / "cellscript"


def test_phase2_evaluation_demo():
    r = subprocess.run([str(BINARY), "--eval"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "A3 = 30.00" in r.stdout
    assert "B1 = 60.00" in r.stdout
    assert "B2 = 20.00" in r.stdout
    assert "C3 = 120.00" in r.stdout


def test_phase1_parser_still_operates():
    r = subprocess.run([str(BINARY), "=A1+B1*C1"], capture_output=True, text=True)
    assert r.returncode == 0
    assert "BinaryOp(+)" in r.stdout and "BinaryOp(*)" in r.stdout


def test_unknown_function_error():
    r = subprocess.run([str(BINARY), "=UNKNOWN(A1)"], capture_output=True, text=True)
    assert r.returncode != 0
    assert "Lexical Error" in r.stderr
