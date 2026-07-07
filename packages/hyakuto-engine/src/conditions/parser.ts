import type { GameState } from '../state/game-state';
import { type TimeBand, isTimeBand, bandOf } from './time';
import { type MCGender, isMCGender } from '../state/mc';

/** Non-GameState inputs to condition evaluation. Carries the clock so a `time:`
 *  predicate is deterministic and a trusted-time source can be injected later
 *  (absent → the real local clock), and whether MC participates in THIS playback
 *  (absent → true). MC-presence is deliberately context, not a flag: flags are
 *  durable save state, while the same chat can be watched without MC today and
 *  replayed with MC tomorrow (the missed-chat modes). */
export type RuntimeContext = { now?: number; mcPresent?: boolean };

type Comparison = '>' | '>=' | '<' | '<=' | '==' | '!=';

interface ComparisonExpr {
  kind: 'comparison';
  left: string;
  op: Comparison;
  right: number;
}

interface FlagExpr {
  kind: 'flag';
  flag: string;
}

interface CompletedExpr {
  kind: 'completed';
  key: string;
}

interface TimeExpr {
  kind: 'time';
  band: TimeBand;
}

interface GenderExpr {
  kind: 'gender';
  value: MCGender;
}

/** `choice:<choiceId>==<optionId>` — true iff MC picked exactly that option.
 *  Unanswered is simply false (a normal runtime state, not an error); dangling
 *  ids are a *content* bug and are caught by @hyakuto/content validation. */
interface ChoiceExpr {
  kind: 'choice';
  choiceId: string;
  optionId: string;
}

/** `mc:present` / `mc:absent` — whether MC participates in this playback
 *  (authored in the CMS as "if with MC"). Context, like `time:` — a missed-chat
 *  free watch plays with MC absent; normal play and paid participation with MC
 *  present (the default). */
interface McExpr {
  kind: 'mc';
  present: boolean;
}

interface NotExpr {
  kind: 'not';
  expr: Expr;
}

interface AndExpr {
  kind: 'and';
  left: Expr;
  right: Expr;
}

interface OrExpr {
  kind: 'or';
  left: Expr;
  right: Expr;
}

type Expr =
  | ComparisonExpr
  | FlagExpr
  | CompletedExpr
  | TimeExpr
  | GenderExpr
  | ChoiceExpr
  | McExpr
  | NotExpr
  | AndExpr
  | OrExpr;

// ─── TOKENIZER ───────────────────────────────────────────

type Token =
  | { type: 'ident'; value: string }
  | { type: 'number'; value: number }
  | { type: 'op'; value: Comparison }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'not' }
  | { type: 'flag'; value: string }
  | { type: 'completed'; value: string }
  | { type: 'time'; band: TimeBand }
  | { type: 'gender'; value: MCGender }
  | { type: 'choice'; choiceId: string; optionId: string }
  | { type: 'mc'; present: boolean }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    // Skip whitespace
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }

    // Parentheses
    if (s[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (s[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue; }

    // Comparison operators (must check two-char before one-char)
    if (s[i] === '>' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
    if (s[i] === '<' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
    if (s[i] === '!' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue; }
    if (s[i] === '=' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue; }
    if (s[i] === '>') { tokens.push({ type: 'op', value: '>' }); i++; continue; }
    if (s[i] === '<') { tokens.push({ type: 'op', value: '<' }); i++; continue; }

    // Numbers (including negative)
    if (s[i] === '-' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9') {
      let num = '-';
      i++;
      while (i < s.length && s[i] >= '0' && s[i] <= '9') { num += s[i]; i++; }
      tokens.push({ type: 'number', value: parseInt(num, 10) });
      continue;
    }

    if (s[i] >= '0' && s[i] <= '9') {
      let num = '';
      while (i < s.length && s[i] >= '0' && s[i] <= '9') { num += s[i]; i++; }
      tokens.push({ type: 'number', value: parseInt(num, 10) });
      continue;
    }

    // Identifiers, keywords, flags
    if (/[a-zA-Z_]/.test(s[i])) {
      let word = '';
      while (i < s.length && /[a-zA-Z0-9_:]/.test(s[i])) { word += s[i]; i++; }

      if (word === 'AND') { tokens.push({ type: 'and' }); continue; }
      if (word === 'OR') { tokens.push({ type: 'or' }); continue; }
      if (word === 'NOT') { tokens.push({ type: 'not' }); continue; }
      if (word.startsWith('flag:')) {
        tokens.push({ type: 'flag', value: word.slice(5) });
        continue;
      }
      if (word.startsWith('completed:')) {
        tokens.push({ type: 'completed', value: word.slice(10) });
        continue;
      }
      if (word.startsWith('time:')) {
        const band = word.slice(5);
        if (!isTimeBand(band)) {
          throw new Error(`Unknown time band "${band}" in condition: "${input}"`);
        }
        tokens.push({ type: 'time', band });
        continue;
      }
      if (word.startsWith('gender:')) {
        const value = word.slice(7);
        if (!isMCGender(value)) {
          throw new Error(`Unknown gender "${value}" in condition: "${input}"`);
        }
        tokens.push({ type: 'gender', value });
        continue;
      }
      if (word.startsWith('mc:')) {
        const value = word.slice(3);
        if (value !== 'present' && value !== 'absent') {
          throw new Error(`Unknown mc predicate "${value}" (expected present|absent) in condition: "${input}"`);
        }
        tokens.push({ type: 'mc', present: value === 'present' });
        continue;
      }
      if (word.startsWith('choice:')) {
        // The whole predicate is one token: `choice:<choiceId>==<optionId>`.
        // Consumed here (not via the generic comparison) because the right-hand
        // side is an id, and the comparison path only accepts numbers.
        const choiceId = word.slice(7);
        if (!choiceId) throw new Error(`Missing choice id after "choice:" in condition: "${input}"`);
        if (!(s[i] === '=' && s[i + 1] === '=')) {
          throw new Error(`Expected "==" after "choice:${choiceId}" in condition: "${input}"`);
        }
        i += 2;
        let optionId = '';
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i]!)) { optionId += s[i]; i++; }
        if (!optionId) throw new Error(`Missing option id after "choice:${choiceId}==" in condition: "${input}"`);
        tokens.push({ type: 'choice', choiceId, optionId });
        continue;
      }
      tokens.push({ type: 'ident', value: word });
      continue;
    }

    throw new Error(`Unexpected character "${s[i]}" at position ${i} in condition: "${input}"`);
  }

  return tokens;
}

// ─── PARSER (recursive descent) ──────────────────────────

class Parser {
  private pos = 0;

  constructor(private tokens: Token[], private raw: string) {}

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos} in condition: "${this.raw}"`);
    }
    return expr;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peek()?.type === 'or') {
      this.advance();
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peek()?.type === 'and') {
      this.advance();
      const right = this.parseNot();
      left = { kind: 'and', left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.peek()?.type === 'not') {
      this.advance();
      const expr = this.parseNot();
      return { kind: 'not', expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.peek();

    if (!token) {
      throw new Error(`Unexpected end of condition: "${this.raw}"`);
    }

    // Parenthesized expression
    if (token.type === 'lparen') {
      this.advance();
      const expr = this.parseOr();
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error(`Missing closing parenthesis in condition: "${this.raw}"`);
      }
      this.advance();
      return expr;
    }

    // Flag
    if (token.type === 'flag') {
      this.advance();
      return { kind: 'flag', flag: token.value };
    }

    // Completed-thread predicate
    if (token.type === 'completed') {
      this.advance();
      return { kind: 'completed', key: token.value };
    }

    // Time-of-day predicate (context, not GameState)
    if (token.type === 'time') {
      this.advance();
      return { kind: 'time', band: token.band };
    }

    // MC gender-for-address predicate
    if (token.type === 'gender') {
      this.advance();
      return { kind: 'gender', value: token.value };
    }

    // Recorded-choice predicate
    if (token.type === 'choice') {
      this.advance();
      return { kind: 'choice', choiceId: token.choiceId, optionId: token.optionId };
    }

    // MC-participation predicate (context)
    if (token.type === 'mc') {
      this.advance();
      return { kind: 'mc', present: token.present };
    }

    // Comparison: identifier op number
    if (token.type === 'ident') {
      this.advance();
      const op = this.peek();
      if (!op || op.type !== 'op') {
        throw new Error(`Expected comparison operator after "${token.value}" in condition: "${this.raw}"`);
      }
      this.advance();
      const num = this.peek();
      if (!num || num.type !== 'number') {
        throw new Error(`Expected number after operator in condition: "${this.raw}"`);
      }
      this.advance();
      return { kind: 'comparison', left: token.value, op: op.value, right: num.value };
    }

    throw new Error(`Unexpected token "${JSON.stringify(token)}" in condition: "${this.raw}"`);
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }
}

// ─── EVALUATOR ───────────────────────────────────────────

function evaluate(expr: Expr, state: GameState, ctx?: RuntimeContext): boolean {
  switch (expr.kind) {
    case 'comparison': {
      // Look up value in axes first, then counters
      const value = expr.left in state.axes
        ? state.axes[expr.left]
        : expr.left in state.counters
          ? state.counters[expr.left]
          : undefined;

      if (value === undefined) {
        throw new Error(`Unknown variable "${expr.left}" in condition. Not found in axes or counters.`);
      }

      switch (expr.op) {
        case '>': return value > expr.right;
        case '>=': return value >= expr.right;
        case '<': return value < expr.right;
        case '<=': return value <= expr.right;
        case '==': return value === expr.right;
        case '!=': return value !== expr.right;
      }
      break;
    }
    case 'flag':
      return state.flags.has(expr.flag);
    case 'completed':
      return expr.key in state.completed;
    case 'time':
      // Resolve the band at evaluation time against the injected clock (or the
      // real local clock when none is supplied) — never at parse/load time.
      return bandOf(ctx?.now ?? Date.now()) === expr.band;
    case 'gender':
      return (state.gender ?? 'unset') === expr.value;
    case 'choice':
      // Unanswered (or unrecorded legacy) choices evaluate false — gating waits
      // for the pick. Dangling ids are content bugs caught by validation.
      return state.choices[expr.choiceId] === expr.optionId;
    case 'mc':
      // Playback context, defaulting to present (normal play). A missed-chat
      // free watch evaluates with mcPresent=false.
      return (ctx?.mcPresent ?? true) === expr.present;
    case 'not':
      return !evaluate(expr.expr, state, ctx);
    case 'and':
      return evaluate(expr.left, state, ctx) && evaluate(expr.right, state, ctx);
    case 'or':
      return evaluate(expr.left, state, ctx) || evaluate(expr.right, state, ctx);
  }
}

// ─── PUBLIC API ──────────────────────────────────────────

export function parseCondition(condition: string): Expr {
  const tokens = tokenize(condition);
  const parser = new Parser(tokens, condition);
  return parser.parse();
}

export function evaluateCondition(
  condition: string,
  state: GameState,
  ctx?: RuntimeContext,
): boolean {
  const expr = parseCondition(condition);
  return evaluate(expr, state, ctx);
}