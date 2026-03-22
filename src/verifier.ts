export class PreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreconditionError';
  }
}

export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
  }
}

export function evaluateCondition(condition: string, state: Record<string, any>) {
  const pyCond = condition
    .replace(/\bAND\b/g, '&&')
    .replace(/\bOR\b/g, '||')
    .replace(/\bNOT\b/g, '!')
    .replace(/==/g, '===');
  
  const keys = Object.keys(state);
  const values = Object.values(state);
  try {
    const func = new Function(...keys, `return ${pyCond};`);
    return func(...values);
  } catch (e: any) {
    throw new Error(`Error evaluating condition '${condition}': ${e.message}`);
  }
}

export function applyMutation(mutation: string, state: Record<string, any>) {
  if (!mutation.includes('=')) return;
  const parts = mutation.split('=');
  const v = parts[0].trim();
  const expr = parts.slice(1).join('=').trim();
  
  const keys = Object.keys(state);
  const values = Object.values(state);
  try {
    const func = new Function(...keys, `return ${expr};`);
    state[v] = func(...values);
  } catch (e: any) {
    state[v] = expr.replace(/^"|"$/g, '');
  }
}

export function verifyAction(dsl: any, currentState: Record<string, any>, actionName: string) {
  if (!dsl.actions[actionName]) {
    throw new Error(`Action ${actionName} not found`);
  }
  const action = dsl.actions[actionName];

  for (const req of action.requires) {
    if (!evaluateCondition(req, currentState)) {
      throw new PreconditionError(`Precondition failed: ${req}`);
    }
  }

  const nextState = { ...currentState };
  for (const mut of action.mutates) {
    applyMutation(mut, nextState);
  }

  for (const inv of dsl.invariants) {
    if (inv.type === 'NEVER') {
      if (evaluateCondition(inv.condition, nextState)) {
        const errorTrace = {
          error: "InvariantViolationError",
          invariant: `NEVER ${inv.condition}`,
          state: nextState
        };
        throw new InvariantViolationError(JSON.stringify(errorTrace, null, 2));
      }
    } else if (inv.type === 'ALWAYS') {
      if (!evaluateCondition(inv.condition, nextState)) {
        const errorTrace = {
          error: "InvariantViolationError",
          invariant: `ALWAYS ${inv.condition}`,
          state: nextState
        };
        throw new InvariantViolationError(JSON.stringify(errorTrace, null, 2));
      }
    }
  }

  return nextState;
}
