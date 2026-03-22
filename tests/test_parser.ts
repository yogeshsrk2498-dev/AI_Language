import { parseDSL } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

function runTests() {
  console.log('Running test_parser.ts...');
  
  const samplePath = path.join(process.cwd(), 'samples', 'travel_booking.yaml');
  const dslText = fs.readFileSync(samplePath, 'utf8');
  
  const parsed = parseDSL(dslText);
  
  // Basic assertions
  if (parsed.state_schema.workflow_status !== 'String') {
    throw new Error('Failed to parse state_schema correctly');
  }
  
  if (parsed.invariants.length !== 1 || parsed.invariants[0].type !== 'NEVER') {
    throw new Error('Failed to parse invariants correctly');
  }
  
  if (!parsed.actions['Commit_Booking']) {
    throw new Error('Failed to parse action Commit_Booking');
  }
  
  if (parsed.actions['Commit_Booking'].requires.length !== 2) {
    throw new Error('Failed to parse requires block correctly');
  }
  
  console.log('✅ test_parser.ts passed!');
}

runTests();
