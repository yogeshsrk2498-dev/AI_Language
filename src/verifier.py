import json

class PreconditionError(Exception):
    pass

class InvariantViolationError(Exception):
    pass

def evaluateCondition(condition: str, state: dict):
    # Convert DSL condition to Python syntax
    py_cond = condition.replace(' AND ', ' and ').replace(' OR ', ' or ').replace(' NOT ', ' not ')
    try:
        return eval(py_cond, {}, state)
    except Exception as e:
        raise Exception(f"Error evaluating condition '{condition}': {str(e)}")

def applyMutation(mutation: str, state: dict):
    if '=' not in mutation:
        return
    parts = mutation.split('=')
    v = parts[0].strip()
    expr = '='.join(parts[1:]).strip()
    
    try:
        state[v] = eval(expr, {}, state)
    except Exception:
        # Fallback for simple string assignment
        state[v] = expr.strip('"').strip("'")

def verifyAction(dsl: dict, current_state: dict, action_name: str):
    if action_name not in dsl['actions']:
        raise Exception(f"Action {action_name} not found")
    
    action = dsl['actions'][action_name]

    # 1. Evaluate requires
    for req in action['requires']:
        if not evaluateCondition(req, current_state):
            raise PreconditionError(f"Precondition failed: {req}")

    # 2. Apply mutates
    next_state = current_state.copy()
    for mut in action['mutates']:
        applyMutation(mut, next_state)

    # 3. Evaluate invariants
    for inv in dsl['invariants']:
        if inv['type'] == 'NEVER':
            if evaluateCondition(inv['condition'], next_state):
                error_trace = {
                    "error": "InvariantViolationError",
                    "invariant": f"NEVER {inv['condition']}",
                    "state": next_state
                }
                raise InvariantViolationError(json.dumps(error_trace, indent=2))
        elif inv['type'] == 'ALWAYS':
            if not evaluateCondition(inv['condition'], next_state):
                error_trace = {
                    "error": "InvariantViolationError",
                    "invariant": f"ALWAYS {inv['condition']}",
                    "state": next_state
                }
                raise InvariantViolationError(json.dumps(error_trace, indent=2))

    return next_state
