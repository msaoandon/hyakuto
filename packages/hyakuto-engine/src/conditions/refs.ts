import { parseCondition } from './parser';

/** A `choice:` reference: the choice + option ids a condition points at. */
export type ChoiceRef = { choiceId: string; optionId: string };

// Parses (throws on malformed) and collects referenced vars + flags + completed
// keys + choice/option ids
export function collectConditionRefs(
  condition: string,
): { vars: string[]; flags: string[]; completed: string[]; choices: ChoiceRef[] } {
  const vars: string[] = [];
  const flags: string[] = [];
  const completed: string[] = [];
  const choices: ChoiceRef[] = [];
  const walk = (e: any): void => {
    switch (e.kind) {
      case 'comparison': vars.push(e.left); break;
      case 'flag': flags.push(e.flag); break;
      case 'completed': completed.push(e.key); break;
      case 'choice': choices.push({ choiceId: e.choiceId, optionId: e.optionId }); break;
      // Context predicates reference a closed engine vocabulary (bands/genders),
      // validated at parse time — they contribute no axis/counter/flag refs.
      case 'time': break;
      case 'gender': break;
      case 'not': walk(e.expr); break;
      case 'and':
      case 'or': walk(e.left); walk(e.right); break;
    }
  };
  walk(parseCondition(condition));
  return { vars, flags, completed, choices };
}
