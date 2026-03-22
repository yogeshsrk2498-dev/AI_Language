export function parseDSL(text: string) {
  const lines = text.split('\n');
  const dsl: any = { state_schema: {}, invariants: [], actions: {} };
  let currentSection = '';
  let currentAction = '';
  let subSection = '';

  for (let line of lines) {
    line = line.split('#')[0].trimEnd();
    if (!line) continue;

    const stripped = line.trim();
    const indent = line.length - line.trimStart().length;

    if (line.startsWith('state_schema:')) {
      currentSection = 'state_schema';
    } else if (line.startsWith('invariants:')) {
      currentSection = 'invariants';
    } else if (line.startsWith('action ')) {
      currentSection = 'action';
      currentAction = line.substring(7).replace(':', '').trim();
      dsl.actions[currentAction] = { requires: [], mutates: [] };
    } else if (currentSection === 'state_schema' && indent > 0) {
      const parts = stripped.split(':');
      if (parts.length === 2) {
        dsl.state_schema[parts[0].trim()] = parts[1].trim();
      }
    } else if (currentSection === 'invariants' && indent > 0) {
      if (stripped.startsWith('- NEVER:')) {
        dsl.invariants.push({ type: 'NEVER', condition: stripped.substring(8).trim() });
      } else if (stripped.startsWith('- ALWAYS:')) {
        dsl.invariants.push({ type: 'ALWAYS', condition: stripped.substring(9).trim() });
      }
    } else if (currentSection === 'action' && indent > 0) {
      if (stripped === 'requires:') {
        subSection = 'requires';
      } else if (stripped === 'mutates:') {
        subSection = 'mutates';
      } else if (stripped.startsWith('- ')) {
        dsl.actions[currentAction][subSection].push(stripped.substring(2).trim());
      }
    }
  }
  return dsl;
}
