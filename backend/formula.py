"""Formula engine for Excel Lite sheets.

Supports: =, +, -, *, /, parentheses, cell refs (A1), ranges (A1:B3),
arithmetic comparison operators (>, <, >=, <=, =, <>),
and a wide set of functions:
  Aggregates: SUM, AVERAGE/AVG, COUNT, COUNTA, MIN, MAX
  Conditional: SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF
  Logic:      IF, IFS, IFERROR, AND, OR, NOT, TRUE, FALSE
  Lookup:     VLOOKUP, HLOOKUP, INDEX, MATCH
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
    'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'AVERAGEIF',
    'IF', 'IFS', 'IFERROR', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE',
    'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH',
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


def _matches_criteria(cell_val: str, criteria: 'str | float') -> bool:
    """Check if cell_val matches an Excel-style criteria string.

    Supports: exact match, operator prefixes (>, <, >=, <=, =, <>, !=),
    and wildcard patterns (* and ?) for string matching.
    """
    import fnmatch as _fnmatch

    # Numeric criteria passed directly as float/int — exact equality check
    if isinstance(criteria, (int, float)):
        try:
            return float(cell_val) == float(criteria)
        except (ValueError, TypeError):
            return False

    crit = str(criteria).strip()

    # Operator-prefixed criteria: ">10", "<=foo", "<>x"
    for op in ('>=', '<=', '<>', '!=', '>', '<', '='):
        if crit.startswith(op):
            rhs = crit[len(op):].strip().strip('"')
            try:
                lhs_n = float(cell_val) if cell_val.strip() else None
                rhs_n = float(rhs)
                if lhs_n is None:
                    return False
                if op in ('=', '=='):   return lhs_n == rhs_n
                if op == '>':           return lhs_n > rhs_n
                if op == '<':           return lhs_n < rhs_n
                if op == '>=':          return lhs_n >= rhs_n
                if op == '<=':          return lhs_n <= rhs_n
                if op in ('<>', '!='):  return lhs_n != rhs_n
            except (ValueError, TypeError):
                cl, rl = cell_val.strip().lower(), rhs.lower()
                if op in ('=', '=='):   return cl == rl
                if op in ('<>', '!='):  return cl != rl
                if op == '>':           return cl > rl
                if op == '<':           return cl < rl
                if op == '>=':          return cl >= rl
                if op == '<=':          return cl <= rl
            return False

    # Wildcard patterns: * matches any sequence, ? matches one char
    if '*' in crit or '?' in crit:
        return _fnmatch.fnmatch(cell_val.strip().lower(), crit.lower())

    # Plain exact match (case-insensitive string, or numeric equality)
    if cell_val.strip().lower() == crit.lower():
        return True
    try:
        return float(cell_val) == float(crit)
    except (ValueError, TypeError):
        return False


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

        # ── Lookup / Reference ─────────────────────────────────────────────

        if name == 'VLOOKUP':
            # VLOOKUP(lookup_value, table_range, col_index, [range_lookup])
            # range_lookup: 0/FALSE = exact match (default), 1/TRUE = approximate (sorted)
            if len(raw_args) < 3:
                raise FormulaSyntaxError("VLOOKUP: requires at least 3 arguments")
            lookup_val = _arg(0)
            table_ref = raw_args[1].strip()
            col_idx = int(_anum(2)) - 1  # 1-based → 0-based
            range_lookup = int(_anum(3, 1.0))  # 1 = approximate, 0 = exact

            cells = _range_cells(table_ref)
            # Group cells by row (preserving order)
            rows_map: dict[int, list[int]] = {}
            for rr, cc in cells:
                rows_map.setdefault(rr, []).append(cc)
            sorted_rows = sorted(rows_map)

            lookup_str = _to_str(lookup_val).lower()
            try:
                lookup_num: float | None = float(lookup_val) if not isinstance(lookup_val, str) else float(str(lookup_val))
            except (ValueError, TypeError):
                lookup_num = None

            found_row: int | None = None
            if range_lookup == 0:  # exact match
                for rr in sorted_rows:
                    first_col = sorted(rows_map[rr])[0]
                    cv = resolve_raw(rr, first_col)
                    if cv.strip().lower() == lookup_str:
                        found_row = rr
                        break
                    if lookup_num is not None and _is_numeric(cv) and float(cv) == lookup_num:
                        found_row = rr
                        break
            else:  # approximate: last row where first col <= lookup_val
                for rr in sorted_rows:
                    first_col = sorted(rows_map[rr])[0]
                    cv = resolve_raw(rr, first_col)
                    try:
                        if lookup_num is not None and float(cv) <= lookup_num:
                            found_row = rr
                        elif lookup_num is None and cv.strip().lower() <= lookup_str:
                            found_row = rr
                    except (ValueError, TypeError):
                        if cv.strip().lower() <= lookup_str:
                            found_row = rr

            if found_row is None:
                raise InvalidRefError("VLOOKUP: value not found (#N/A)")
            sorted_cols = sorted(rows_map[found_row])
            if col_idx >= len(sorted_cols):
                raise InvalidRefError("VLOOKUP: col_index out of range")
            raw = resolve_raw(found_row, sorted_cols[col_idx])
            try:
                return float(raw) if raw.strip() else 0.0
            except ValueError:
                return raw

        if name == 'HLOOKUP':
            # HLOOKUP(lookup_value, table_range, row_index, [range_lookup])
            if len(raw_args) < 3:
                raise FormulaSyntaxError("HLOOKUP: requires at least 3 arguments")
            lookup_val = _arg(0)
            table_ref = raw_args[1].strip()
            row_idx = int(_anum(2)) - 1  # 1-based → 0-based
            range_lookup = int(_anum(3, 1.0))

            cells = _range_cells(table_ref)
            cols_map: dict[int, list[int]] = {}
            for rr, cc in cells:
                cols_map.setdefault(cc, []).append(rr)
            sorted_cols = sorted(cols_map)

            lookup_str = _to_str(lookup_val).lower()
            try:
                lookup_num = float(lookup_val) if not isinstance(lookup_val, str) else float(str(lookup_val))
            except (ValueError, TypeError):
                lookup_num = None

            found_col: int | None = None
            if range_lookup == 0:
                for cc in sorted_cols:
                    first_row = sorted(cols_map[cc])[0]
                    cv = resolve_raw(first_row, cc)
                    if cv.strip().lower() == lookup_str:
                        found_col = cc
                        break
                    if lookup_num is not None and _is_numeric(cv) and float(cv) == lookup_num:
                        found_col = cc
                        break
            else:
                for cc in sorted_cols:
                    first_row = sorted(cols_map[cc])[0]
                    cv = resolve_raw(first_row, cc)
                    try:
                        if lookup_num is not None and float(cv) <= lookup_num:
                            found_col = cc
                        elif lookup_num is None and cv.strip().lower() <= lookup_str:
                            found_col = cc
                    except (ValueError, TypeError):
                        if cv.strip().lower() <= lookup_str:
                            found_col = cc

            if found_col is None:
                raise InvalidRefError("HLOOKUP: value not found (#N/A)")
            sorted_rows_in_col = sorted(cols_map[found_col])
            if row_idx >= len(sorted_rows_in_col):
                raise InvalidRefError("HLOOKUP: row_index out of range")
            raw = resolve_raw(sorted_rows_in_col[row_idx], found_col)
            try:
                return float(raw) if raw.strip() else 0.0
            except ValueError:
                return raw

        if name == 'MATCH':
            # MATCH(lookup_value, lookup_range, [match_type])
            # match_type: 0=exact, 1=ascending approx (default), -1=descending approx
            # Returns 1-based position
            if len(raw_args) < 2:
                raise FormulaSyntaxError("MATCH: requires at least 2 arguments")
            lookup_val = _arg(0)
            cells = _range_cells(raw_args[1].strip())
            match_type = int(_anum(2, 1.0))

            lookup_str = _to_str(lookup_val).lower()
            try:
                lookup_num = float(lookup_val) if not isinstance(lookup_val, str) else float(str(lookup_val))
            except (ValueError, TypeError):
                lookup_num = None

            def _cell_matches_exact(cv: str) -> bool:
                if cv.strip().lower() == lookup_str:
                    return True
                if lookup_num is not None and _is_numeric(cv) and float(cv) == lookup_num:
                    return True
                return False

            if match_type == 0:  # exact
                for i, (rr, cc) in enumerate(cells):
                    if _cell_matches_exact(resolve_raw(rr, cc)):
                        return float(i + 1)
                raise InvalidRefError("MATCH: value not found (#N/A)")
            elif match_type == 1:  # largest value <= lookup_val (ascending sorted)
                result: float | None = None
                for i, (rr, cc) in enumerate(cells):
                    cv = resolve_raw(rr, cc)
                    try:
                        if lookup_num is not None and float(cv) <= lookup_num:
                            result = float(i + 1)
                        elif lookup_num is None and cv.strip().lower() <= lookup_str:
                            result = float(i + 1)
                    except (ValueError, TypeError):
                        if cv.strip().lower() <= lookup_str:
                            result = float(i + 1)
                if result is None:
                    raise InvalidRefError("MATCH: value not found (#N/A)")
                return result
            else:  # match_type == -1: smallest value >= lookup_val (descending sorted)
                for i, (rr, cc) in enumerate(cells):
                    cv = resolve_raw(rr, cc)
                    try:
                        if lookup_num is not None and float(cv) >= lookup_num:
                            return float(i + 1)
                        elif lookup_num is None and cv.strip().lower() >= lookup_str:
                            return float(i + 1)
                    except (ValueError, TypeError):
                        if cv.strip().lower() >= lookup_str:
                            return float(i + 1)
                raise InvalidRefError("MATCH: value not found (#N/A)")

        if name == 'INDEX':
            # INDEX(array_range, row_num, [col_num])
            # row_num and col_num are 1-based; 0 defaults to first row/col
            if len(raw_args) < 2:
                raise FormulaSyntaxError("INDEX: requires at least 2 arguments")
            cells = _range_cells(raw_args[0].strip())
            row_num_raw = int(_anum(1))
            col_num_raw = int(_anum(2, 1.0))
            row_num = max(0, row_num_raw - 1)  # 1-based → 0-based, 0 → 0
            col_num = max(0, col_num_raw - 1)

            rows_map2: dict[int, list[int]] = {}
            for rr, cc in cells:
                rows_map2.setdefault(rr, []).append(cc)
            sorted_rows2 = sorted(rows_map2)

            if row_num < 0 or row_num >= len(sorted_rows2):
                raise InvalidRefError("INDEX: row_num out of range")
            rr = sorted_rows2[row_num]
            sorted_cols2 = sorted(rows_map2[rr])
            if col_num < 0 or col_num >= len(sorted_cols2):
                raise InvalidRefError("INDEX: col_num out of range")
            raw = resolve_raw(rr, sorted_cols2[col_num])
            try:
                return float(raw) if raw.strip() else 0.0
            except ValueError:
                return raw

        # ── Conditional aggregates ─────────────────────────────────────────

        if name == 'SUMIF':
            # SUMIF(range, criteria, [sum_range])
            if len(raw_args) < 2:
                raise FormulaSyntaxError("SUMIF: requires at least 2 arguments")
            crit_cells = _range_cells(raw_args[0].strip())
            criteria = _arg(1)
            sum_cells = _range_cells(raw_args[2].strip()) if len(raw_args) > 2 else crit_cells
            total = 0.0
            for i, (rr, cc) in enumerate(crit_cells):
                if _matches_criteria(resolve_raw(rr, cc), criteria):
                    if i < len(sum_cells):
                        sr, sc = sum_cells[i]
                        total += resolve_num(sr, sc)
            return total

        if name == 'SUMIFS':
            # SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2, ...])
            if len(raw_args) < 3 or len(raw_args) % 2 == 0:
                raise FormulaSyntaxError("SUMIFS: requires sum_range + pairs of (range, criteria)")
            sum_cells = _range_cells(raw_args[0].strip())
            criterion_pairs: list[tuple[list, object]] = []
            i = 1
            while i + 1 < len(raw_args):
                cr_cells = _range_cells(raw_args[i].strip())
                cr_val = _arg(i + 1)
                criterion_pairs.append((cr_cells, cr_val))
                i += 2
            total = 0.0
            for idx, (sr, sc) in enumerate(sum_cells):
                if all(
                    idx < len(cr_cells) and _matches_criteria(resolve_raw(cr_cells[idx][0], cr_cells[idx][1]), cr_val)
                    for cr_cells, cr_val in criterion_pairs
                ):
                    total += resolve_num(sr, sc)
            return total

        if name == 'COUNTIF':
            # COUNTIF(range, criteria)
            if len(raw_args) < 2:
                raise FormulaSyntaxError("COUNTIF: requires 2 arguments")
            crit_cells = _range_cells(raw_args[0].strip())
            criteria = _arg(1)
            return float(sum(
                1 for rr, cc in crit_cells
                if _matches_criteria(resolve_raw(rr, cc), criteria)
            ))

        if name == 'COUNTIFS':
            # COUNTIFS(range1, criteria1, [range2, criteria2, ...])
            if len(raw_args) < 2 or len(raw_args) % 2 != 0:
                raise FormulaSyntaxError("COUNTIFS: requires pairs of (range, criteria)")
            criterion_pairs2: list[tuple[list, object]] = []
            i = 0
            while i + 1 < len(raw_args):
                cr_cells = _range_cells(raw_args[i].strip())
                cr_val = _arg(i + 1)
                criterion_pairs2.append((cr_cells, cr_val))
                i += 2
            if not criterion_pairs2:
                return 0.0
            ref_len = len(criterion_pairs2[0][0])
            return float(sum(
                1 for idx in range(ref_len)
                if all(
                    idx < len(cr_cells) and _matches_criteria(resolve_raw(cr_cells[idx][0], cr_cells[idx][1]), cr_val)
                    for cr_cells, cr_val in criterion_pairs2
                )
            ))

        if name == 'AVERAGEIF':
            # AVERAGEIF(range, criteria, [average_range])
            if len(raw_args) < 2:
                raise FormulaSyntaxError("AVERAGEIF: requires at least 2 arguments")
            crit_cells = _range_cells(raw_args[0].strip())
            criteria = _arg(1)
            avg_cells = _range_cells(raw_args[2].strip()) if len(raw_args) > 2 else crit_cells
            vals = [
                resolve_num(avg_cells[i][0], avg_cells[i][1])
                for i, (rr, cc) in enumerate(crit_cells)
                if _matches_criteria(resolve_raw(rr, cc), criteria) and i < len(avg_cells)
            ]
            if not vals:
                raise DivisionByZeroError("AVERAGEIF: no matching cells")
            return sum(vals) / len(vals)

        # ── Multi-condition logic ──────────────────────────────────────────

        if name == 'IFS':
            # IFS(condition1, value1, condition2, value2, ...)
            if len(raw_args) < 2 or len(raw_args) % 2 != 0:
                raise FormulaSyntaxError("IFS: requires pairs of (condition, value)")
            for i in range(0, len(raw_args), 2):
                cond = _to_num(_arg(i), 'IFS')
                if cond != 0:
                    return _arg(i + 1)
            raise InvalidRefError("IFS: no condition matched (#N/A)")

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
