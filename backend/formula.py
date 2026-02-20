"""Formula engine for Excel Lite sheets.

Supports: =, +, -, *, /, parentheses, cell refs (A1), ranges (A1:B3),
SUM(range), AVERAGE(range), AVG(range), COUNT(range), MIN(range), MAX(range).

Error codes written to cells:
  #ERROR  — syntax error or unsupported formula
  #DIV/0  — division by zero
  #REF    — invalid or out-of-bounds cell reference
  #CYCLE  — circular dependency detected
"""

import re
from collections import deque


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


# ── Helpers ───────────────────────────────────────────────────────

_CELL_REF_RE = re.compile(r'^([A-Za-z]{1,3})(\d{1,7})$')
_FUNC_RE = re.compile(
    r'(SUM|AVG|AVERAGE|COUNT|MIN|MAX)\(\s*([A-Za-z]{1,3}\d{1,7})\s*:\s*([A-Za-z]{1,3}\d{1,7})\s*\)',
    re.IGNORECASE,
)
_BARE_REF_RE = re.compile(r'[A-Za-z]{1,3}\d{1,7}')

# Validation: everything allowed after stripping functions and refs
_VALID_ARITH_RE = re.compile(r'^[\d\.\+\-\*/\(\)\s]*$')


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


def format_result(value: float) -> str:
    """Format a numeric result for cell display."""
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

    # Check function calls — must be FUNC(REF:REF)
    def _check_func(m):
        try:
            parse_cell_ref(m.group(2))
            parse_cell_ref(m.group(3))
        except InvalidRefError:
            return None  # signal: don't replace, will fail later
        return "0"  # placeholder

    reduced = _FUNC_RE.sub(_check_func, body)
    if reduced is None:
        return "#REF"

    # If a function call wasn't matched (e.g. bad syntax like SUM(A1)),
    # detect leftover alpha-paren patterns that aren't cell refs
    if re.search(r'[A-Za-z]+\(', reduced):
        return "#ERROR"

    # Check bare cell references
    def _check_ref(m):
        try:
            parse_cell_ref(m.group(0))
        except InvalidRefError:
            return None
        return "0"

    reduced = _BARE_REF_RE.sub(_check_ref, reduced)
    if reduced is None:
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

    def parse(self) -> float:
        if not self.text:
            raise FormulaSyntaxError("Empty expression")
        result = self._expr()
        if self.pos != len(self.text):
            raise FormulaSyntaxError(f"Unexpected '{self.text[self.pos]}' at pos {self.pos}")
        return result


# ── Formula evaluation ────────────────────────────────────────────

def evaluate(formula: str, resolve_cell, has_content, *, num_rows: int = 0, num_cols: int = 0) -> float:
    """Evaluate a formula string (starting with =).

    resolve_cell(row, col) -> float
    has_content(row, col)  -> bool
    num_rows / num_cols    — sheet dimensions for bounds checking (0 = skip check)
    """
    expr = formula.lstrip('=').strip()
    if not expr:
        raise FormulaSyntaxError("Empty formula")

    def _bounds_check(r: int, c: int, ref_text: str):
        if num_rows and r >= num_rows:
            raise InvalidRefError(f"Row out of bounds: {ref_text}")
        if num_cols and c >= num_cols:
            raise InvalidRefError(f"Column out of bounds: {ref_text}")

    def _func_sub(m):
        name = m.group(1).upper()
        range_str = f"{m.group(2)}:{m.group(3)}"
        cells = expand_range(range_str)
        for r, c in cells:
            _bounds_check(r, c, range_str)
        if name == 'SUM':
            return str(sum(resolve_cell(r, c) for r, c in cells))
        if name in ('AVG', 'AVERAGE'):
            vals = [resolve_cell(r, c) for r, c in cells]
            if not vals:
                return '0'
            return str(sum(vals) / len(vals))
        if name == 'COUNT':
            return str(sum(1 for r, c in cells if has_content(r, c)))
        if name == 'MIN':
            vals = [resolve_cell(r, c) for r, c in cells]
            if not vals:
                return '0'
            return str(min(vals))
        if name == 'MAX':
            vals = [resolve_cell(r, c) for r, c in cells]
            if not vals:
                return '0'
            return str(max(vals))
        raise FormulaSyntaxError(f"Unknown function: {name}")

    expr = _FUNC_RE.sub(_func_sub, expr)

    # Detect leftover function-like patterns not matched by _FUNC_RE
    if re.search(r'[A-Za-z]+\(', expr):
        raise FormulaSyntaxError("Unsupported or malformed function")

    def _ref_sub(m):
        ref = m.group(0)
        r, c = parse_cell_ref(ref)
        _bounds_check(r, c, ref)
        return str(resolve_cell(r, c))

    expr = _BARE_REF_RE.sub(_ref_sub, expr)

    return _Parser(expr).parse()


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
    else:
        eval_order = graph.topo_sort_all()

    if not eval_order:
        return

    eval_set = set(eval_order)
    cache: dict[str, float] = {}
    errors: dict[str, str] = {}  # key -> error code

    def _has_content(r: int, c: int) -> bool:
        key = f"{r},{c}"
        if key in formulas:
            return True
        return 0 <= r < num_rows and 0 <= c < len(rows[r]) and bool(rows[r][c].strip())

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
            )
            cache[key] = val
            return val

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
            val = _resolve(r, c, frozenset())
            rows[r][c] = format_result(val)
        except FormulaError as e:
            rows[r][c] = e.code
            errors[key] = e.code
        except Exception:
            rows[r][c] = "#ERROR"
            errors[key] = "#ERROR"
