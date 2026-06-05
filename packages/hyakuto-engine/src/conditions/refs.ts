import { parseCondition } from './parser';

// Parses (throws on malformed) and collects referenced vars + flags
export function collectConditionRefs(condition: string): { vars: string[]; flags: string[] } {
  const vars: string[] = [];
  const flags: string[] = [];
  const walk = (e: any): void => {
    switch (e.kind) {
      case 'comparison': vars.push(e.left); break;
      case 'flag': flags.push(e.flag); break;
      case 'not': walk(e.expr); break;
      case 'and':
      case 'or': walk(e.left); walk(e.right); break;
    }
  };
  walk(parseCondition(condition));
  return { vars, flags };
}
