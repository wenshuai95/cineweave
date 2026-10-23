// Runs the ai-adapter test with process.platform forced to 'win32' (see
// simulate-win32.mjs), covering the Windows-only branches on any host OS.
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const sim=pathToFileURL(resolve(import.meta.dirname,'simulate-win32.mjs')).href;
const env={...process.env,JINGCHANG_TEST_SERVER:'1',NODE_OPTIONS:(process.env.NODE_OPTIONS?process.env.NODE_OPTIONS+' ':'')+'--import '+sim};
const tests=spawn(process.execPath,['--test','tests/ai-server.test.mjs'],{cwd:resolve(import.meta.dirname,'..'),env,stdio:'inherit',windowsHide:true});
tests.on('exit',c=>process.exit(Number.isInteger(c)?c:1));
