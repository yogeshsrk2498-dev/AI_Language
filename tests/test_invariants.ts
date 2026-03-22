import { verifyAction, PreconditionError, InvariantViolationError } from '../src/verifier';

function runTests() {
  console.log('Running test_invariants.ts...');
  
  const dsl = {
    state_schema: { balance: 'Number' },
    invariants: [
      { type: 'NEVER', condition: 'balance < 0' }
    ],
    actions: {
      Withdraw: {
        requires: ['balance >= 50'],
        mutates: ['balance = balance - 100']
      }
    }
  };

  // Test 1: PreconditionError
  try {
    verifyAction(dsl, { balance: 30 }, 'Withdraw');
    throw new Error('Expected PreconditionError but no error was thrown');
  } catch (e: any) {
    if (e instanceof PreconditionError) {
      console.log('✅ PreconditionError correctly raised for failed precondition');
    } else {
      throw new Error(`Expected PreconditionError, got ${e.name}`);
    }
  }

  // Test 2: InvariantViolationError
  try {
    // Precondition passes (balance >= 50), but mutation (balance - 100) results in -50
    // This violates the NEVER: balance < 0 invariant
    verifyAction(dsl, { balance: 50 }, 'Withdraw');
    throw new Error('Expected InvariantViolationError but no error was thrown');
  } catch (e: any) {
    if (e instanceof InvariantViolationError) {
      console.log('✅ InvariantViolationError correctly raised for NEVER invariant');
    } else {
      throw new Error(`Expected InvariantViolationError, got ${e.name}`);
    }
  }
  
  console.log('✅ test_invariants.ts passed!');
}

runTests();
