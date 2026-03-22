import { parseDSL } from './parser';
import { verifyAction } from './verifier';

export class DSLVerifier {
  dsl: any;
  
  constructor(dslText: string) {
    this.dsl = parseDSL(dslText);
  }
  
  verifyAction(currentState: Record<string, any>, actionName: string) {
    return verifyAction(this.dsl, currentState, actionName);
  }
}

// Equivalent to if __name__ == "__main__":
if (import.meta.env?.MODE === 'test') {
  const dsl_input = `state_schema:
  workflow_status: String
  hotel_booked: Boolean

invariants:
  - NEVER: workflow_status == "Committed" AND hotel_booked == False

action Commit_Booking:
  requires:
    - workflow_status == "Pending"
    - hotel_booked == True
  mutates:
    - workflow_status = "Committed"`;

  const verifier = new DSLVerifier(dsl_input);
  const current_state = {"workflow_status": "Pending", "hotel_booked": false};
  
  console.log("Initial state:", current_state);
  console.log("Attempting action: Commit_Booking");
  
  try {
      const new_state = verifier.verifyAction(current_state, "Commit_Booking");
      console.log("Success! New state:", new_state);
  } catch (e) {
      console.error(e);
  }
}
