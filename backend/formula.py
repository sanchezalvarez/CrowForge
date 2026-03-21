"""Formula engine for Excel Lite sheets.

Supports: =, +, -, *, /, parentheses, cell refs (A1), ranges (A1:B3),
arithmetic comparison operators (>, <, >=, <=, =, <>),
and a wide set of functions:
  Aggregates: SUM, AVERAGE/AVG, COUNT, COUNTA, MIN, MAX
  Logic:      IF, IFERROR, AND, OR, NOT, TRUE, FALSE
  Text:       UPPER, LOWER, TRIM, LEN, LEFT, RIGHT, MID,
              CONCAT, CONCATENATE, TEXT, REPT, SUBSTITUTE
  Math:       ABS, ROUND, ROUNDUP, ROUNDDOWN, MOD, INT,
              SQRT, POWER, EXP, LN, LOG, CEILING, FLOOR
  Date:       TODAY, NOW, YEAR, MONTH, DAY

Error codes written to cells:
  #ERROR  — syntax error or unsupported formula
  #DIV/0  — division by zero
  #REF    — invalid or out-of-bounds cell reference
  #CYCLE  — circular dependency detected
  #VALUE! — wrong type for operation
  #NUM!   — numeric domain error
"""

import re
import math as _math
import datetime as _dt
from collections import deque

_MISSING = object()  # sentinel for optional arguments


# ── Error types ───────────────────────────────────────────────────

class FormulaError(Exception):
    """Base for all formula errors. `code` is the cell display string."""
    code: str = "#ERROR"

    def __init__(self, message: str = "", code: str | None = None):
        super().__init__(message)
        if code is not None:
            self.code = code

class FormulaSyntaxError(FormulaError):
    code = "#ERROR"

class DivisionByZeroError(FormulaError):
    code = "#DIV/0"

class InvalidRefError(FormulaError):
    code = "#REF"

class CycleError(FormulaError):
    code = "#CYCLE"

class ValueError_(FormulaError):
    code = "#VALUE!"

class NumError(FormulaError):
    code = "#NUM!"


# ── Helpers ───────────────────────────────────────────────────────

_CELL_REF_RE = re.compile(r'^([A-Za-z]{1,3})(\d{1,7})$')
_FUNC_RE = re.compile(
    r'(SUM|AVG|AVERAGE|COUNT|MIN|MAX)\(\s*([A-Za-z]{1,3}\d{1,7})\s*:\s*([A-Za-z]{1,3}\d{1,7})\s*\)',
    re.IGNORECASE,
)
_BARE_REF_RE = re.compile(r'[A-Za-z]{1,3}\d{1,7}')

# Validation: everything allowed after stripping functions and refs
# Includes comparison operators for IF conditions
_VALID_ARITH_RE = re.compile(r'^[\d\.\+\-\*/\(\)\s<>=!&|]*$')

# All function names recognised by the engine
_ALL_KNOWN_FUNCS = frozenset({
    'SUM', 'AVERAGE', 'AVG', 'COUNT', 'COUNTA', 'MIN', 'MAX',
    'IF', 'IFERROR', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE',
    'UPPER', 'LOWER', 'TRIM', 'LEN', 'LEFT', 'RIGHT', 'MID',
    'CONCAT', 'CONCATENATE', 'TEXT', 'REPT', 'SUBSTITUTE',
    'ABS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'MOD', 'INT',
    'SQRT', 'POWER', 'EXP', 'LN', 'LOG', 'CEILING', 'FLOOR',
    'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY',
})


def _split_func_args(args_str: str) -> list[str]:
    """Split comma-separated function arguments respecting nested parentheses and strings."""
    if not args_str.strip():
        return []
    parts: list[str] = []
    depth = 0
    in_str = False
    buf: list[str] = []
    for ch in args_str:
        if ch == '"' and not in_str:
            in_str = True
            buf.append(ch)
        elif ch == '"' and in_str:
            in_str = False
            buf.append(ch)
        elif in_str:
            buf.append(ch)
        elif ch == ',' and depth == 0:
            parts.append(''.join(buf).strip())
            buf = []
        else:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            buf.append(ch)
    parts.append(''.join(buf).strip())
    return [p for p in parts if p]


def _to_num(val: 'str | float', context: str = '') -> float:
    """Coerce a formula result to float. Raises ValueError_ (#VALUE!) on failure."""
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        raise ValueError_(f"Expected number{': ' + context if context else ''}")


def _to_str(val: 'str | float') -> str:
    """Convert any formula result to a display string."""
    if isinstance(val, float):
        if val == int(val) and abs(val) < 1e15:
            return str(int(val))
        return f"{val:.10g}"
    return str(val)


def col_to_index(col_str: str) -> int:
    """A->0, B->1, ..., Z->25, AA->26."""
    n = 0
    for ch in col_str.upper():
        n = n * 26 + (ord(ch) - ord('A') + 1)
    return n - 1


def index_to_col(idx: int) -> str:
    """0->A, 1->B, ..., 25->Z, 26->AA."""
    result = ""
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        result = chr(rem + ord('A')) + result
    return result


_SHIFT_REF_RE = re.compile(r'([A-Za-z]{1,3})(\d{1,7})')


def shift_refs(formula: str, row_delta: int, col_delta: int) -> str:
    """Shift all cell references in a formula by (row_delta, col_delta).

    Returns the adjusted formula, or the original if any ref would go negative.
    """
    def _replace(m: re.Match) -> str:
        col_str = m.group(1)
        row_num = int(m.group(2))
        new_col = col_to_index(col_str) + col_delta
        new_row = row_num - 1 + row_delta  # 0-based
        if new_col < 0 or new_row < 0:
            raise InvalidRefError("Shifted ref out of bounds")
        return f"{index_to_col(new_col)}{new_row + 1}"

    try:
        return formula[0] + _SHIFT_REF_RE.sub(_replace, formula[1:])
    except InvalidRefError:
        return formula  # keep original if shift goes out of bounds


def parse_cell_ref(ref: str) -> tuple[int, int]:
    """'A1' -> (row=0, col=0). Raises InvalidRefError on bad input."""
    m = _CELL_REF_RE.match(ref.strip())
    if not m:
        raise InvalidRefError(f"Bad cell reference: {ref}")
    row = int(m.group(2)) - 1
    col = col_to_index(m.group(1))
    if row < 0:
        raise InvalidRefError(f"Row must be >= 1: {ref}")
    return row, col


def expand_range(range_str: str) -> list[tuple[int, int]]:
    """'A1:B3' -> list of (row, col) tuples covering the rectangle."""
    parts = range_str.split(':')
    if len(parts) != 2:
        raise InvalidRefError(f"Bad range: {range_str}")
    r1, c1 = parse_cell_ref(parts[0])
    r2, c2 = parse_cell_ref(parts[1])
    return [
        (r, c)
        for r in range(min(r1, r2), max(r1, r2) + 1)
        for c in range(min(c1, c2), max(c1, c2) + 1)
    ]


def format_result(value: 'float | str') -> str:
    """Format a formula result for cell display."""
    if isinstance(value, str):
        return value
    if value == int(value) and abs(value) < 1e15:
        return str(int(value))
    return f"{value:.10g}"


# ── Reference extraction ─────────────────────────────────────────

def extract_refs(formula: str) -> set[str]:
    """Return set of 'row,col' keys for all cells referenced by a formula."""
    body = formula.lstrip('=').strip()
    refs: set[str] = set()

    # Extract function ranges first
    for m in _FUNC_RE.finditer(body):
        range_str = f"{m.group(2)}:{m.group(3)}"
        try:
            for r, c in expand_range(range_str):
                refs.add(f"{r},{c}")
        except (InvalidRefError, ValueError):
            pass

    # Remove function calls to avoid double-counting refs inside them
    reduced = _FUNC_RE.sub('0', body)

    # Extract bare cell refs from what remains
    for m in _BARE_REF_RE.finditer(reduced):
        try:
            r, c = parse_cell_ref(m.group(0))
            refs.add(f"{r},{c}")
        except (InvalidRefError, ValueError):
            pass

    return refs


# ── Dependency graph ──────────────────────────────────────────────

class DependencyGraph:
    """Tracks which formulas depend on which cells.

    forward:  formula_key -> set of cell keys it reads
    reverse:  cell_key    -> set of formula keys that read it
    """
    MAX_DEPTH = 20

    def __init__(self, formulas: dict[str, str]):
        self.forward: dict[str, set[str]] = {}
        self.reverse: dict[str, set[str]] = {}

        for key, formula in formulas.items():
            refs = extract_refs(formula)
            self.forward[key] = refs
            for ref in refs:
                if ref not in self.reverse:
                    self.reverse[ref] = set()
                self.reverse[ref].add(key)

    def affected(self, changed: set[str]) -> list[str]:
        """Return formula keys that need recalculation, topologically ordered.

        BFS from *changed* cells through reverse edges.
        Stops propagating past MAX_DEPTH hops from the original change set.
        """
        affected: set[str] = set()
        queue: deque[tuple[str, int]] = deque()  # (cell_key, depth)

        for cell in changed:
            for dep in self.reverse.get(cell, ()):
                if dep not in affected:
                    affected.add(dep)
                    queue.append((dep, 1))

        while queue:
            cell, depth = queue.popleft()
            if depth >= self.MAX_DEPTH:
                continue
            for dep in self.reverse.get(cell, ()):
                if dep not in affected:
                    affected.add(dep)
                    queue.append((dep, depth + 1))

        return self._topo_sort(affected)

    def topo_sort_all(self) -> list[str]:
        """Return all formula keys in dependency order (Kahn's algorithm)."""
        return self._topo_sort(set(self.forward.keys()))

    def _topo_sort(self, keys: set[str]) -> list[str]:
        """Kahn's algorithm on a subset of formula keys.

        Formulas involved in cycles are appended at the end
        (they will receive #CYCLE during evaluation).
        """
        if not keys:
            return []

        # Build adjacency and in-degree within the subset.
        # An edge ref->dep exists when *dep* reads cell *ref* and both are in *keys*.
        in_degree: dict[str, int] = {k: 0 for k in keys}
        adj: dict[str, list[str]] = {k: [] for k in keys}

        for k in keys:
            for ref in self.forward.get(k, ()):
                if ref in keys:
                    adj[ref].append(k)
                    in_degree[k] += 1

        queue = deque(k for k in keys if in_degree[k] == 0)
        result: list[str] = []

        while queue:
            node = queue.popleft()
            result.append(node)
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # Remaining nodes are in cycles — append so they get evaluated (and error)
        for k in keys:
            if k not in set(result):
                result.append(k)

        return result


# ── Validation ────────────────────────────────────────────────────

def validate_formula(formula: str) -> str | None:
    """Check formula syntax without evaluating.

    Returns None if valid, or an error code string (#ERROR / #REF).
    """
    if not formula or not formula.startswith('='):
        return "#ERROR"

    body = formula[1:].strip()
    if not body:
        return "#ERROR"

    # If the body uses any extended function, delegate full validation to the evaluator.
    # This avoids false rejections from the arithmetic-only checker below.
    _RANGE_FUNCS = frozenset({'SUM', 'AVERAGE', 'AVG', 'COUNT', 'MIN', 'MAX'})
    for fm in re.finditer(r'([A-Za-z_][A-Za-z0-9_]*)\s*\(', body):
        fn = fm.group(1).upper()
        if fn not in _RANGE_FUNCS:
            if fn in _ALL_KNOWN_FUNCS:
                return None  # extended function — trust the evaluator
            return "#ERROR"  # unknown function

    # Check range function calls — must be FUNC(REF:REF)
    _has_bad_ref = False

    def _check_func(m):
        nonlocal _has_bad_ref
        try:
            parse_cell_ref(m.group(2))
            parse_cell_ref(m.group(3))
        except InvalidRefError:
            _has_bad_ref = True
            return "0"  # must return str for re.sub; flag signals error
        return "0"  # placeholder

    reduced = _FUNC_RE.sub(_check_func, body)
    if _has_bad_ref:
        return "#REF"

    # Check bare cell references
    _has_bad_bare_ref = False

    def _check_ref(m):
        nonlocal _has_bad_bare_ref
        try:
            parse_cell_ref(m.group(0))
        except InvalidRefError:
            _has_bad_bare_ref = True
            return "0"  # must return str for re.sub; flag signals error
        return "0"

    reduced = _BARE_REF_RE.sub(_check_ref, reduced)
    if _has_bad_bare_ref:
        return "#REF"

    # After replacing functions and refs with "0", only arithmetic should remain
    if not _VALID_ARITH_RE.match(reduced):
        return "#ERROR"

    # Check balanced parentheses
    depth = 0
    for ch in reduced:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if depth < 0:
            return "#ERROR"
    if depth != 0:
        return "#ERROR"

    # Trial-parse the arithmetic to catch structural errors (e.g. trailing operators)
    # DivisionByZeroError is a runtime issue (0/0 in placeholders), not a syntax error.
    try:
        _Parser(reduced).parse()
    except FormulaSyntaxError:
        return "#ERROR"
    except (DivisionByZeroError, FormulaError):
        pass  # runtime errors are valid syntax

    return None


# ── Arithmetic parser (recursive descent, no eval()) ──────────────

class _Parser:
    """Parses and evaluates: +, -, *, /, unary -, parentheses, numbers."""
    __slots__ = ('text', 'pos')

    def __init__(self, text: str):
        self.text = text.replace(' ', '')
        self.pos = 0

    def _peek(self):
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _eat(self, expected=None):
        if self.pos >= len(self.text):
            raise FormulaSyntaxError("Unexpected end of expression")
        ch = self.text[self.pos]
        if expected and ch != expected:
            raise FormulaSyntaxError(f"Expected '{expected}', got '{ch}'")
        self.pos += 1
        return ch

    def _number(self) -> float:
        start = self.pos
        dot_count = 0
        while self.pos < len(self.text) and (self.text[self.pos].isdigit() or self.text[self.pos] == '.'):
            if self.text[self.pos] == '.':
                dot_count += 1
                if dot_count > 1:
                    raise FormulaSyntaxError(f"Invalid number at pos {start}")
            self.pos += 1
        if self.pos == start:
            raise FormulaSyntaxError(
                f"Expected number at pos {self.pos}"
                + (f", got '{self.text[self.pos]}'" if self.pos < len(self.text) else "")
            )
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
        if self._peek() == '+':
            self._eat()
            return self._factor()
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
                    raise DivisionByZeroError("Division by zero")
                left /= right
        return left

    def _expr(self) -> float:
        left = self._term()
        while self._peek() in ('+', '-'):
            op = self._eat()
            right = self._term()
            left = left + right if op == '+' else left - right
        return left

    def _comparison(self) -> float:
        left = self._expr()
        ch = self._peek()
        if ch in ('>', '<', '=', '!'):
            op = self._eat()
            if self._peek() == '=':
                op += self._eat()
            elif op == '<' and self._peek() == '>':
                op += self._eat()
            right = self._expr()
            if op == '>':   return 1.0 if left > right else 0.0
            if op == '<':   return 1.0 if left < right else 0.0
            if op == '>=':  return 1.0 if left >= right else 0.0
            if op == '<=':  return 1.0 if left <= right else 0.0
            if op in ('=', '=='): return 1.0 if left == right else 0.0
            if op in ('<>', '!='): return 1.0 if left != right else 0.0
        return left

    def parse(self) -> float:
        if not self.text:
            raise FormulaSyntaxError("Empty expression")
        result = self._comparison()
        if self.pos != len(self.text):
            raise FormulaSyntaxError(f"Unexpected '{self.text[self.pos]}' at pos {self.pos}")
        return result


# ── Extended recursive evaluator ──────────────────────────────────

_TOP_FUNC_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$', re.DOTALL)
_INNER_FUNC_RE = re.compile(r'([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)')


def _eval_any(
    expr: str,
    resolve_num,   # (r, c) -> float
    resolve_raw,   # (r, c) -> str
    has_content,   # (r, c) -> bool
    *,
    num_rows: int = 0,
    num_cols: int = 0,
) -> 'str | float':
    """Evaluate any formula sub-expression, returning str or float.

    Handles: string literals, numbers, cell refs, all known functions,
    arithmetic with comparison operators.
    """
    expr = expr.strip()
    if not expr:
        return 0.0

    # --- String literal "..." ---
    if expr.startswith('"') and expr.endswith('"') and len(expr) >= 2:
        return expr[1:-1].replace('""', '"')

    # --- Cell reference A1 ---
    m = _CELL_REF_RE.match(expr)
    if m and m.end() == len(expr):
        r, c = parse_cell_ref(expr)
        if num_rows and r >= num_rows:
            raise InvalidRefError(f"Row out of bounds: {expr}")
        if num_cols and c >= num_cols:
            raise InvalidRefError(f"Column out of bounds: {expr}")
        raw = resolve_raw(r, c)
        try:
            return float(raw) if raw.strip() else 0.0
        except ValueError:
            return raw

    # --- Number literal ---
    try:
        return float(expr)
    except ValueError:
        pass

    # --- Function call: NAME(...) ---
    fn_m = _TOP_FUNC_RE.match(expr)
    if fn_m:
        name = fn_m.group(1).upper()
        args_str = fn_m.group(2).strip()
        raw_args = _split_func_args(args_str)

        def _arg(i, default=_MISSING):
            if i < len(raw_args):
                return _eval_any(raw_args[i], resolve_num, resolve_raw, has_content,
                                 num_rows=num_rows, num_cols=num_cols)
            if default is not _MISSING:
                return default
            raise FormulaSyntaxError(f"{name}: missing argument {i + 1}")

        def _anum(i, default=_MISSING):
            v = _arg(i) if default is _MISSING else _arg(i, default)
            return _to_num(v, name)

        def _astr(i, default=_MISSING):
            v = _arg(i) if default is _MISSING else _arg(i, default)
            return _to_str(v)

        def _range_cells(ref: str) -> list[tuple[int, int]]:
            if ':' not in ref:
                ref = f"{ref.strip()}:{ref.strip()}"
            cells = expand_range(ref)
            for rr, cc in cells:
                if num_rows and rr >= num_rows:
                    raise InvalidRefError(f"Out of bounds: {ref}")
                if num_cols and cc >= num_cols:
                    raise InvalidRefError(f"Out of bounds: {ref}")
            return cells

        # Aggregate functions (require a range arg)
        if name in ('SUM', 'AVERAGE', 'AVG', 'COUNT', 'COUNTA', 'MIN', 'MAX'):
            if not raw_args:
                raise FormulaSyntaxError(f"{name}: requires a range")
            cells = _range_cells(raw_args[0])
            if name == 'SUM':
                return sum(resolve_num(r, c) for r, c in cells)
            if name in ('AVERAGE', 'AVG'):
                vals = [resolve_num(r, c) for r, c in cells]
                return sum(vals) / len(vals) if vals else 0.0
            if name == 'COUNT':
                return float(sum(1 for r, c in cells
                                 if has_content(r, c) and _is_numeric(resolve_raw(r, c))))
            if name == 'COUNTA':
                return float(sum(1 for r, c in cells if has_content(r, c) and resolve_raw(r, c).strip()))
            if name == 'MIN':
                vals = [resolve_num(r, c) for r, c in cells]
                return min(vals) if vals else 0.0
            if name == 'MAX':
                vals = [resolve_num(r, c) for r, c in cells]
                return max(vals) if vals else 0.0

        # Logic
        if name == 'IF':
            if len(raw_args) < 2:
                raise FormulaSyntaxError("IF: requires at least 2 arguments")
            cond = _to_num(_arg(0), 'IF')
            return _arg(1) if cond != 0 else _arg(2, 0.0)

        if name == 'IFERROR':
            try:
                return _arg(0)
            except Exception:
                return _arg(1, '')

        if name == 'AND':
            return 1.0 if all(_to_num(_arg(i), 'AND') != 0 for i in range(len(raw_args))) else 0.0

        if name == 'OR':
            return 1.0 if any(_to_num(_arg(i), 'OR') != 0 for i in range(len(raw_args))) else 0.0

        if name == 'NOT':
            return 0.0 if _anum(0) != 0 else 1.0

        if name == 'TRUE':
            return 1.0

        if name == 'FALSE':
            return 0.0

        # Text
        if name == 'UPPER':
            return _astr(0).upper()

        if name == 'LOWER':
            return _astr(0).lower()

        if name == 'TRIM':
            return ' '.join(_astr(0).split())

        if name == 'LEN':
            return float(len(_astr(0)))

        if name in ('CONCAT', 'CONCATENATE'):
            return ''.join(_astr(i) for i in range(len(raw_args)))

        if name == 'LEFT':
            s = _astr(0)
            n = max(0, int(_anum(1, 1.0)))
            return s[:n]

        if name == 'RIGHT':
            s = _astr(0)
            n = max(0, int(_anum(1, 1.0)))
            return s[-n:] if n > 0 else ''

        if name == 'MID':
            s = _astr(0)
            start = max(0, int(_anum(1)) - 1)  # Excel is 1-based
            length = max(0, int(_anum(2)))
            return s[start:start + length]

        if name == 'TEXT':
            return _to_str(_anum(0))

        if name == 'REPT':
            return _astr(0) * max(0, int(_anum(1)))

        if name == 'SUBSTITUTE':
            s = _astr(0)
            old = _astr(1)
            new = _astr(2)
            return s.replace(old, new) if old else s

        # Math
        if name == 'ABS':
            return abs(_anum(0))

        if name == 'ROUND':
            return float(round(_anum(0), int(_anum(1, 0.0))))

        if name == 'ROUNDUP':
            d = int(_anum(1, 0.0))
            v = _anum(0)
            factor = 10 ** d
            return float(_math.ceil(v * factor) / factor)

        if name == 'ROUNDDOWN':
            d = int(_anum(1, 0.0))
            v = _anum(0)
            factor = 10 ** d
            return float(_math.floor(v * factor) / factor)

        if name == 'MOD':
            b = _anum(1)
            if b == 0:
                raise DivisionByZeroError("MOD by zero")
            return float(_anum(0) % b)

        if name == 'INT':
            return float(_math.floor(_anum(0)))

        if name == 'SQRT':
            v = _anum(0)
            if v < 0:
                raise NumError("SQRT of negative number")
            return _math.sqrt(v)

        if name == 'POWER':
            return float(_anum(0) ** _anum(1))

        if name == 'EXP':
            return _math.exp(_anum(0))

        if name == 'LN':
            v = _anum(0)
            if v <= 0:
                raise NumError("LN of non-positive")
            return _math.log(v)

        if name == 'LOG':
            v = _anum(0)
            base = _anum(1, 10.0)
            if v <= 0 or base <= 0 or base == 1:
                raise NumError("LOG domain error")
            return _math.log(v, base)

        if name == 'CEILING':
            sig = _anum(1, 1.0)
            if sig == 0:
                return 0.0
            return float(_math.ceil(_anum(0) / sig) * sig)

        if name == 'FLOOR':
            sig = _anum(1, 1.0)
            if sig == 0:
                return 0.0
            return float(_math.floor(_anum(0) / sig) * sig)

        # Date
        if name == 'TODAY':
            return _dt.date.today().isoformat()

        if name == 'NOW':
            return _dt.datetime.now().strftime('%Y-%m-%d %H:%M')

        if name == 'YEAR':
            try:
                return float(_dt.datetime.fromisoformat(_astr(0)).year)
            except (ValueError, TypeError):
                raise ValueError_("#VALUE!")

        if name == 'MONTH':
            try:
                return float(_dt.datetime.fromisoformat(_astr(0)).month)
            except (ValueError, TypeError):
                raise ValueError_("#VALUE!")

        if name == 'DAY':
            try:
                return float(_dt.datetime.fromisoformat(_astr(0)).day)
            except (ValueError, TypeError):
                raise ValueError_("#VALUE!")

        raise FormulaSyntaxError(f"Unknown function: {name}")

    # --- Arithmetic expression (may contain cell refs and function calls) ---
    # Iteratively substitute innermost function calls until none remain
    _iter_limit = 50
    working = expr
    for _ in range(_iter_limit):
        inner = _INNER_FUNC_RE.search(working)
        if not inner:
            break
        fn_name = inner.group(1).upper()
        if fn_name not in _ALL_KNOWN_FUNCS:
            break
        sub_result = _eval_any(inner.group(0), resolve_num, resolve_raw, has_content,
                                num_rows=num_rows, num_cols=num_cols)
        if isinstance(sub_result, str):
            raise ValueError_("String value used in arithmetic")
        working = working[:inner.start()] + str(sub_result) + working[inner.end():]

    # Substitute bare cell refs
    def _ref_sub(m):
        r, c = parse_cell_ref(m.group(0))
        if num_rows and r >= num_rows:
            raise InvalidRefError(f"Row out of bounds: {m.group(0)}")
        if num_cols and c >= num_cols:
            raise InvalidRefError(f"Column out of bounds: {m.group(0)}")
        return str(resolve_num(r, c))

    working = _BARE_REF_RE.sub(_ref_sub, working)

    if re.search(r'[A-Za-z]+\(', working):
        raise FormulaSyntaxError(f"Unsupported function in: {expr!r}")

    if not _VALID_ARITH_RE.match(working):
        raise FormulaSyntaxError(f"Invalid expression: {working!r}")

    return _Parser(working).parse()


def _is_numeric(s: str) -> bool:
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


# ── Formula evaluation ────────────────────────────────────────────

def evaluate(formula: str, resolve_cell, has_content, *, num_rows: int = 0, num_cols: int = 0,
             resolve_raw=None) -> 'str | float':
    """Evaluate a formula string (starting with =).

    resolve_cell(row, col) -> float
    has_content(row, col)  -> bool
    resolve_raw(row, col)  -> str   (optional; used for text functions)
    num_rows / num_cols    — sheet dimensions for bounds checking (0 = skip check)
    """
    expr = formula.lstrip('=').strip()
    if not expr:
        raise FormulaSyntaxError("Empty formula")

    _raw = resolve_raw if resolve_raw is not None else (lambda r, c: str(resolve_cell(r, c)))

    return _eval_any(expr, resolve_cell, _raw, has_content,
                     num_rows=num_rows, num_cols=num_cols)


# ── Sheet recalculation ───────────────────────────────────────────

def recalculate(rows: list[list[str]], formulas: dict[str, str],
                changed_cells: set[str] | None = None) -> None:
    """Evaluate formulas and write computed values into *rows* in-place.

    changed_cells=None  — full recalculation (all formulas, topologically ordered).
    changed_cells={..}  — targeted: only formulas transitively depending on those cells.
    changed_cells=set()  — no-op (nothing changed).
    """
    if not formulas:
        return
    if changed_cells is not None and not changed_cells:
        return  # nothing changed, skip entirely

    num_rows = len(rows)
    num_cols = max((len(r) for r in rows), default=0)

    graph = DependencyGraph(formulas)

    if changed_cells is not None:
        eval_order = graph.affected(changed_cells)
        # Also evaluate formulas AT the changed cells themselves
        # (e.g. when a new formula is entered or an existing one is modified)
        for key in changed_cells:
            if key in formulas and key not in set(eval_order):
                eval_order.insert(0, key)
    else:
        eval_order = graph.topo_sort_all()

    if not eval_order:
        return

    eval_set = set(eval_order)
    cache: dict[str, float] = {}
    str_cache: dict[str, str] = {}   # for formula cells that returned a string
    errors: dict[str, str] = {}  # key -> error code

    def _has_content(r: int, c: int) -> bool:
        key = f"{r},{c}"
        if key in formulas:
            return True
        return 0 <= r < num_rows and 0 <= c < len(rows[r]) and bool(rows[r][c].strip())

    def _raw(r: int, c: int) -> str:
        """Return the current displayed/raw value of a cell as a string."""
        if 0 <= r < num_rows and 0 <= c < len(rows[r]):
            return rows[r][c]
        return ''

    def _resolve(r: int, c: int, visiting: frozenset, depth: int = 0) -> float:
        if depth > DependencyGraph.MAX_DEPTH:
            raise FormulaError("Max depth exceeded", code="#ERROR")

        key = f"{r},{c}"
        if key in errors:
            raise FormulaError(errors[key], code=errors[key])
        if key in cache:
            return cache[key]
        if key in visiting:
            raise CycleError(f"Circular reference at {key}")

        if key in formulas and key in eval_set:
            # Formula being recalculated — evaluate it
            val = evaluate(
                formulas[key],
                lambda rr, cc: _resolve(rr, cc, visiting | {key}, depth + 1),
                _has_content,
                num_rows=num_rows,
                num_cols=num_cols,
                resolve_raw=_raw,
            )
            if isinstance(val, str):
                str_cache[key] = val
                return 0.0  # string result: treat as 0 for numeric dependents
            cache[key] = float(val)
            return float(val)

        if key in formulas:
            # Formula NOT being recalculated — read its current computed value
            if 0 <= r < num_rows and 0 <= c < len(rows[r]):
                v = rows[r][c]
                if v and v.startswith('#'):
                    raise FormulaError(v, code=v)
                if v:
                    try:
                        val = float(v)
                        cache[key] = val
                        return val
                    except ValueError:
                        return 0.0
            return 0.0

        # Plain cell — read raw value
        if 0 <= r < num_rows and 0 <= c < len(rows[r]):
            v = rows[r][c]
            if v:
                try:
                    return float(v)
                except ValueError:
                    return 0.0
        return 0.0

    for key in eval_order:
        r, c = map(int, key.split(','))
        if not (0 <= r < num_rows and 0 <= c < len(rows[r])):
            continue
        try:
            syntax_err = validate_formula(formulas[key])
            if syntax_err:
                rows[r][c] = syntax_err
                errors[key] = syntax_err
                continue
            _resolve(r, c, frozenset())
            if key in str_cache:
                rows[r][c] = str_cache[key]
            elif key in cache:
                rows[r][c] = format_result(cache[key])
        except FormulaError as e:
            rows[r][c] = e.code
            errors[key] = e.code
        except Exception:
            rows[r][c] = "#ERROR"
            errors[key] = "#ERROR"
