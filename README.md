# AI-Native DSL Framework

A formal specification runtime designed for LLM agents. It parses a YAML-like Domain-Specific Language (DSL), simulates state transitions, and verifies system invariants to ensure autonomous agents do not violate strict safety rules.

## Project Structure

- `src/`: Contains the core runtime engine components (parser, verifier, and VM).
- `prompts/`: System prompts to guide autonomous agents in writing the DSL.
- `samples/`: Example workflows written in the new DSL (e.g., travel booking, bank transfers).
- `tests/`: Unit tests to ensure the verifier catches bad logic and invariant violations.

## DSL Grammar

The language consists of three main blocks:
- **state_schema**: Defines the variables and their types.
- **invariants**: Defines safety and liveness rules using keywords like `NEVER` and `ALWAYS`.
- **action**: Defines state transitions with strict `requires` (pre-conditions) and `mutates` (post-conditions) blocks. If a variable is not in mutates, it must remain unchanged.

## Setup Instructions

1. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the main application file (or execute the test suite to verify the engine):
   ```bash
   python -m unittest discover tests
   ```
