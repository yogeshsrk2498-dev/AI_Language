import json

def parseDSL(text: str):
    lines = text.split('\n')
    dsl = {'state_schema': {}, 'invariants': [], 'actions': {}}
    current_section = ''
    current_action = ''
    sub_section = ''

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
            current_action = line[7:].replace(':', '').strip()
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
