"""Formula engine for Excel Lite sheets.

Supports: =, +, -, *, /, parentheses, cell refs (A1), ranges (A1:B3),
SUM(range), AVG(range), COUNT(range).
"""

import re


def col_to_index(col_str: str) -> int:
    """A->0, B->1, ..., Z->25, AA->26."""
    n = 0
    for ch in col_str.upper():
        n = n * 26 + (ord(ch) - ord('A') + 1)
    return n - 1


def parse_cell_ref(ref: str) -> tuple[int, int]:
    """'A1' -> (row=0, col=0). Row is 1-based in formula, 0-based returned."""
    m = re.match(r'^([A-Za-z]+)(\d+)$', ref.strip())
    if not m:
        raise ValueError(f"Bad cell ref: {ref}")
    return int(m.group(2)) - 1, col_to_index(m.group(1))


def expand_range(range_str: str) -> list[tuple[int, int]]:
    """'A1:B3' -> list of (row, col) tuples covering the rectangle."""
    a, b = range_str.split(':')
    r1, c1 = parse_cell_ref(a)
    r2, c2 = parse_cell_ref(b)
    return [
        (r, c)
        for r in range(min(r1, r2), max(r1, r2) + 1)
        for c in range(min(c1, c2), max(c1, c2) + 1)
    ]


def format_result(value: float) -> str:
    """Format a numeric result for cell display."""
    if value == int(value) and abs(value) < 1e15:
        return str(int(value))
    return f"{value:.10g}"


# ── Arithmetic parser (recursive descent) ─────────────────────────

class _Parser:
    """Parses and evaluates simple arithmetic: +, -, *, /, parentheses."""
    __slots__ = ('text', 'pos')

    def __init__(self, text: str):
        self.text = text.replace(' ', '')
        self.pos = 0

    def _peek(self):
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _eat(self, expected=None):
        ch = self.text[self.pos]
        if expected and ch != expected:
            raise ValueError(f"Expected '{expected}' at pos {self.pos}")
        self.pos += 1
        return ch

    def _number(self) -> float:
        start = self.pos
        while self.pos < len(self.text) and (self.text[self.pos].isdigit() or self.text[self.pos] == '.'):
            self.pos += 1
        if self.pos == start:
            raise ValueError(f"Expected number at pos {self.pos}")
        return float(self.text[start:self.pos])

    def _factor(self) -> float:
        if self._peek() == '(':
            self._eat('(')
            val = self._expr()
            self._eat(')')
            return val
        if self._peek() == '-':
            self._eat()
            return -self._factor()
        return self._number()

    def _term(self) -> float:
        left = self._factor()
        while self._peek() in ('*', '/'):
            op = self._eat()
            right = self._factor()
            if op == '*':
                left *= right
            else:
                if right == 0:
                    raise ValueError("#DIV/0!")
                left /= right
        return left

    def _expr(self) -> float:
        left = self._term()
        while self._peek() in ('+', '-'):
            op = self._eat()
            right = self._term()
            left = left + right if op == '+' else left - right
        return left

    def parse(self) -> float:
        result = self._expr()
        if self.pos != len(self.text):
            raise ValueError(f"Unexpected char at pos {self.pos}")
        return result


# ── Formula evaluation ────────────────────────────────────────────

_FUNC_RE = re.compile(
    r'(SUM|AVG|COUNT)\(([A-Za-z]+\d+:[A-Za-z]+\d+)\)', re.IGNORECASE
)
_CELL_RE = re.compile(r'[A-Za-z]+\d+')


def evaluate(formula: str, resolve_cell, has_content) -> float:
    """Evaluate a formula string (starting with =).

    resolve_cell(row, col) -> float   — value of any cell
    has_content(row, col)  -> bool    — whether cell is non-empty (for COUNT)
    """
    expr = formula.lstrip('=').strip()

    def _func_sub(m):
        name = m.group(1).upper()
        cells = expand_range(m.group(2))
        if name == 'SUM':
            return str(sum(resolve_cell(r, c) for r, c in cells))
        if name == 'AVG':
            vals = [resolve_cell(r, c) for r, c in cells]
            return str(sum(vals) / len(vals)) if vals else '0'
        if name == 'COUNT':
            return str(sum(1 for r, c in cells if has_content(r, c)))
        return '0'

    expr = _FUNC_RE.sub(_func_sub, expr)

    def _ref_sub(m):
        r, c = parse_cell_ref(m.group(0))
        return str(resolve_cell(r, c))

    expr = _CELL_RE.sub(_ref_sub, expr)

    return _Parser(expr).parse()


# ── Sheet recalculation ───────────────────────────────────────────

def recalculate(rows: list[list[str]], formulas: dict[str, str]) -> None:
    """Evaluate every formula and write computed values into *rows* in-place."""
    if not formulas:
        return

    cache: dict[str, float] = {}

    def _has_content(r: int, c: int) -> bool:
        key = f"{r},{c}"
        if key in formulas:
            return True
        return 0 <= r < len(rows) and 0 <= c < len(rows[r]) and bool(rows[r][c].strip())

    def _resolve(r: int, c: int, visiting: frozenset) -> float:
        key = f"{r},{c}"
        if key in cache:
            return cache[key]
        if key in visiting:
            raise ValueError("#CIRC!")
        if key in formulas:
            val = evaluate(
                formulas[key],
                lambda rr, cc: _resolve(rr, cc, visiting | {key}),
                _has_content,
            )
            cache[key] = val
            return val
        # Plain cell — read raw value
        if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
            v = rows[r][c]
            if v:
                try:
                    return float(v)
                except ValueError:
                    return 0.0
        return 0.0

    for key in formulas:
        r, c = map(int, key.split(','))
        try:
            val = _resolve(r, c, frozenset())
            if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
                rows[r][c] = format_result(val)
        except ValueError as e:
            msg = str(e)
            if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
                rows[r][c] = msg if msg.startswith('#') else "#ERR!"
        except Exception:
            if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
                rows[r][c] = "#ERR!"
