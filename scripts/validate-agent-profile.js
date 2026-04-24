#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const profilePath = path.resolve(process.cwd(), 'runtime/agent_orchestrator/project_profile.json');
const schemaPath = path.resolve(process.cwd(), 'docs/agent-orchestrator/project_profile.schema.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const profile = loadJson(profilePath);
  const schema = loadJson(schemaPath);
  delete schema.$schema;
  delete schema.$id;

  const ajv = new Ajv({ allErrors: true, strict: false, schemaId: 'auto' });
  const validate = ajv.compile(schema);
  const ok = validate(profile);

  if (!ok) {
    console.error('PROFILE_SCHEMA_INVALID');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }

  console.log('PROFILE_SCHEMA_VALID');
}

main();
