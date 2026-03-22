import unittest
import os
import sys

# Add src to path so we can import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.verifier import verifyAction, PreconditionError, InvariantViolationError

class TestInvariants(unittest.TestCase):
    def setUp(self):
        self.dsl = {
            'state_schema': {'balance': 'Number'},
            'invariants': [
                {'type': 'NEVER', 'condition': 'balance < 0'}
            ],
            'actions': {
                'Withdraw': {
                    'requires': ['balance >= 50'],
                    'mutates': ['balance = balance - 100']
                }
            }
        }

    def test_precondition_error(self):
        # Initial balance is 30, which fails the 'balance >= 50' requirement
        current_state = {'balance': 30}
        
        with self.assertRaises(PreconditionError) as context:
            verifyAction(self.dsl, current_state, 'Withdraw')
            
        self.assertIn('Precondition failed', str(context.exception))

    def test_invariant_violation_error(self):
        # Initial balance is 50, passes precondition.
        # Mutation subtracts 100, balance becomes -50.
        # Violates 'NEVER: balance < 0'
        current_state = {'balance': 50}
        
        with self.assertRaises(InvariantViolationError) as context:
            verifyAction(self.dsl, current_state, 'Withdraw')
            
        self.assertIn('InvariantViolationError', str(context.exception))
        self.assertIn('NEVER balance < 0', str(context.exception))

if __name__ == '__main__':
    unittest.main()
