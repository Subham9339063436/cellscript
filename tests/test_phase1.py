import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / "build" / "cellscript"


def test_default_formula():
    result = subprocess.run([str(BINARY)], capture_output=True, text=True, check=False)
    assert result.returncode == 0
    assert "FuncName  'SUM'" in result.stdout
    assert "Range(A1:B3)" in result.stdout
    assert "CellRef(C2)" in result.stdout


def test_precedence():
    result = subprocess.run(
        [str(BINARY), "=A1+B1*C1"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0
    assert result.stdout.count("BinaryOp") == 2
    assert "BinaryOp(+)" in result.stdout
    assert "BinaryOp(*)" in result.stdout


def test_parentheses():
    result = subprocess.run(
        [str(BINARY), "=(A1+B1)*2"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0
    assert "BinaryOp(*)" in result.stdout
    assert "BinaryOp(+)" in result.stdout


def test_lexical_error():
    result = subprocess.run(
        [str(BINARY), "=UNKNOWN(A1)"], capture_output=True, text=True, check=False
    )
    assert result.returncode != 0
    assert "Lexical Error" in result.stderr


def test_syntax_error():
    result = subprocess.run(
        [str(BINARY), "=SUM(A1:B3"], capture_output=True, text=True, check=False
    )
    assert result.returncode != 0
    assert "Syntax Error" in result.stderr
