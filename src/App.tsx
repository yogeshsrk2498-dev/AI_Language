import React, { useState } from 'react';
import { Play, Code, FileJson, AlertCircle, CheckCircle2, Terminal, FileCode2 } from 'lucide-react';
import { DSLVerifier } from './vm';
import { PreconditionError, InvariantViolationError } from './verifier';

const DEFAULT_DSL = `state_schema:
  workflow_status: String
  hotel_booked: Boolean

invariants:
  - NEVER: workflow_status == "Committed" AND hotel_booked == False

action Commit_Booking:
  requires:
    - workflow_status == "Pending"
    - hotel_booked == True
  mutates:
    - workflow_status = "Committed"

action Faulty_Commit:
  requires:
    - workflow_status == "Pending"
  mutates:
    - workflow_status = "Committed"
`;

const DEFAULT_STATE = `{
  "workflow_status": "Pending",
  "hotel_booked": false
}`;

const PYTHON_CODE = `import json

class PreconditionError(Exception):
    pass

class InvariantViolationError(Exception):
    pass

class DSLVerifier:
    def __init__(self, dsl_text):
        self.dsl = self.parse_dsl(dsl_text)
        
    def parse_dsl(self, text):
        lines = text.strip().split('\\n')
        dsl = {'state_schema': {}, 'invariants': [], 'actions': {}}
        current_section = None
        current_action = None
        
        for line in lines:
            line = line.split('#')[0].rstrip()
            if not line:
                continue
                
            stripped = line.strip()
            indent = len(line) - len(line.lstrip())
            
            if line.startswith('state_schema:'):
                current_section = 'state_schema'
            elif line.startswith('invariants:'):
                current_section = 'invariants'
            elif line.startswith('action '):
                current_section = 'action'
                current_action = line[7:].strip(':')
                dsl['actions'][current_action] = {'requires': [], 'mutates': []}
            elif current_section == 'state_schema' and indent > 0:
                parts = stripped.split(':')
                if len(parts) == 2:
                    dsl['state_schema'][parts[0].strip()] = parts[1].strip()
            elif current_section == 'invariants' and indent > 0:
                if stripped.startswith('- NEVER:'):
                    dsl['invariants'].append({'type': 'NEVER', 'condition': stripped[8:].strip()})
                elif stripped.startswith('- ALWAYS:'):
                    dsl['invariants'].append({'type': 'ALWAYS', 'condition': stripped[9:].strip()})
            elif current_section == 'action' and indent > 0:
                if stripped == 'requires:':
                    sub_section = 'requires'
                elif stripped == 'mutates:':
                    sub_section = 'mutates'
                elif stripped.startswith('- '):
                    dsl['actions'][current_action][sub_section].append(stripped[2:].strip())
                    
        return dsl

    def evaluate_condition(self, condition, state):
        py_cond = condition.replace(' AND ', ' and ').replace(' OR ', ' or ').replace('NOT ', 'not ')
        try:
            return eval(py_cond, {}, state)
        except Exception as e:
            raise ValueError(f"Error evaluating condition '{condition}': {e}")

    def apply_mutation(self, mutation, state):
        if '=' not in mutation:
            return
        var, expr = [p.strip() for p in mutation.split('=', 1)]
        try:
            state[var] = eval(expr, {}, state)
        except Exception as e:
            raise ValueError(f"Error applying mutation '{mutation}': {e}")

    def verify_action(self, current_state, action_name):
        if action_name not in self.dsl['actions']:
            raise ValueError(f"Action {action_name} not found")
            
        action = self.dsl['actions'][action_name]
        
        # 1. Evaluate requires
        for req in action['requires']:
            if not self.evaluate_condition(req, current_state):
                raise PreconditionError(f"Precondition failed: {req}")
                
        # 2. Apply mutates
        next_state = current_state.copy()
        for mut in action['mutates']:
            self.apply_mutation(mut, next_state)
            
        # 3. Evaluate invariants
        for inv in self.dsl['invariants']:
            if inv['type'] == 'NEVER':
                if self.evaluate_condition(inv['condition'], next_state):
                    error_trace = {
                        "error": "InvariantViolationError",
                        "invariant": f"NEVER {inv['condition']}",
                        "state": next_state
                    }
                    raise InvariantViolationError(json.dumps(error_trace, indent=2))
            elif inv['type'] == 'ALWAYS':
                if not self.evaluate_condition(inv['condition'], next_state):
                    error_trace = {
                        "error": "InvariantViolationError",
                        "invariant": f"ALWAYS {inv['condition']}",
                        "state": next_state
                    }
                    raise InvariantViolationError(json.dumps(error_trace, indent=2))
                    
        return next_state

if __name__ == "__main__":
    dsl_input = """state_schema:
  workflow_status: String
  hotel_booked: Boolean

invariants:
  - NEVER: workflow_status == "Committed" AND hotel_booked == False

action Commit_Booking:
  requires:
    - workflow_status == "Pending"
    - hotel_booked == True
  mutates:
    - workflow_status = "Committed"
"""

    verifier = DSLVerifier(dsl_input)
    current_state = {"workflow_status": "Pending", "hotel_booked": False}
    
    print("Initial state:", current_state)
    print("Attempting action: Commit_Booking")
    
    try:
        new_state = verifier.verify_action(current_state, "Commit_Booking")
        print("Success! New state:", new_state)
    except PreconditionError as e:
        print(f"PreconditionError: {e}")
    except InvariantViolationError as e:
        print(f"InvariantViolationError:\\n{e}")
    except Exception as e:
        print(f"Error: {e}")
        
    print("\\n--- Forcing Invariant Violation ---")
    try:
        bad_state = {"workflow_status": "Committed", "hotel_booked": False}
        print("Evaluating state:", bad_state)
        for inv in verifier.dsl['invariants']:
            if inv['type'] == 'NEVER' and verifier.evaluate_condition(inv['condition'], bad_state):
                error_trace = {
                    "error": "InvariantViolationError",
                    "invariant": f"NEVER {inv['condition']}",
                    "state": bad_state
                }
                raise InvariantViolationError(json.dumps(error_trace, indent=2))
    except InvariantViolationError as e:
        print(f"InvariantViolationError:\\n{e}")
`;

export default function App() {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [stateStr, setStateStr] = useState(DEFAULT_STATE);
  const [actionToRun, setActionToRun] = useState('Commit_Booking');
  const [output, setOutput] = useState<{ type: 'success' | 'error' | 'info', message: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'python'>('simulator');

  const handleRun = () => {
    setOutput([]);
    const logs: { type: 'success' | 'error' | 'info', message: string }[] = [];
    const log = (type: 'success' | 'error' | 'info', message: string) => {
      logs.push({ type, message });
    };

    try {
      log('info', `Parsing DSL...`);
      const verifier = new DSLVerifier(dsl);
      
      log('info', `Parsing initial state...`);
      const initialState = JSON.parse(stateStr);
      
      log('info', `Evaluating action: ${actionToRun}`);
      const nextState = verifier.verifyAction(initialState, actionToRun);
      
      log('success', `Action successful! Next state:\n${JSON.stringify(nextState, null, 2)}`);
    } catch (err: any) {
      if (err.name === 'PreconditionError') {
        log('error', `PreconditionError: ${err.message}`);
      } else if (err.name === 'InvariantViolationError') {
        log('error', `InvariantViolationError:\n${err.message}`);
      } else {
        log('error', `Error: ${err.message}`);
      }
    }
    setOutput(logs);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Formal Specification Runtime</h1>
            <p className="text-xs text-zinc-500">TLA+ inspired DSL Simulator</p>
          </div>
        </div>
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'simulator' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'python' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Python Source
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 h-[calc(100vh-73px)]">
        {activeTab === 'simulator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6 h-full">
              {/* DSL Editor */}
              <div className="flex-1 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">DSL Definition</h2>
                </div>
                <textarea
                  value={dsl}
                  onChange={(e) => setDsl(e.target.value)}
                  className="flex-1 w-full bg-transparent p-4 text-sm font-mono text-zinc-300 focus:outline-none resize-none"
                  spellCheck={false}
                />
              </div>

              {/* State Editor */}
              <div className="h-48 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
                  <Code className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Initial State (JSON)</h2>
                </div>
                <textarea
                  value={stateStr}
                  onChange={(e) => setStateStr(e.target.value)}
                  className="flex-1 w-full bg-transparent p-4 text-sm font-mono text-zinc-300 focus:outline-none resize-none"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Right Column: Execution & Output */}
            <div className="flex flex-col h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Execution</span>
                  <select
                    value={actionToRun}
                    onChange={(e) => setActionToRun(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Commit_Booking">Commit_Booking</option>
                    <option value="Faulty_Commit">Faulty_Commit</option>
                  </select>
                </div>
                <button
                  onClick={handleRun}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Run Action
                </button>
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-sm">
                {output.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-600">
                    Click "Run Action" to execute the DSL
                  </div>
                ) : (
                  <div className="space-y-3">
                    {output.map((log, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-md border ${
                          log.type === 'error'
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : log.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {log.type === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                          {log.type === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {log.message}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <h2 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Python Implementation</h2>
              <button
                onClick={() => navigator.clipboard.writeText(PYTHON_CODE)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Copy Code
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono text-zinc-300">
                <code>{PYTHON_CODE}</code>
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
