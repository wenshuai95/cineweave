#!/usr/bin/env node
import { main } from '../cli/zaomeng-cli.mjs';

try {
  const code = await main(process.argv.slice(2));
  process.exit(code ?? 0);
} catch (error) {
  process.stderr.write(`zaomeng: ${error.message || String(error)}\n`);
  process.exit(1);
}
