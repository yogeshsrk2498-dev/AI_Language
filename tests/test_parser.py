import unittest
import os
import sys

# Add src to path so we can import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.parser import parseDSL

class TestParser(unittest.TestCase):
    def test_parse_travel_booking(self):
        sample_path = os.path.join(os.path.dirname(__file__), '..', 'samples', 'travel_booking.yaml')
        with open(sample_path, 'r') as f:
            dsl_text = f.read()
            
        parsed = parseDSL(dsl_text)
        
        # Check state schema
        self.assertIn('workflow_status', parsed['state_schema'])
        self.assertEqual(parsed['state_schema']['workflow_status'], 'String')
        
        # Check invariants
        self.assertEqual(len(parsed['invariants']), 1)
        self.assertEqual(parsed['invariants'][0]['type'], 'NEVER')
        
        # Check actions
        self.assertIn('Commit_Booking', parsed['actions'])
        action = parsed['actions']['Commit_Booking']
        self.assertEqual(len(action['requires']), 2)
        self.assertEqual(len(action['mutates']), 1)

if __name__ == '__main__':
    unittest.main()
