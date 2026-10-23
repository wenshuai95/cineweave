// Forces process.platform==='win32' in every node process under NODE_OPTIONS,
// so the Windows-only branches (CLI default path, JS-CLI spawn, fixture pick)
// execute on a POSIX host. os.tmpdir() branches on the platform flag, so pin
// TEMP/TMP to the real temp dir before the override.
import os from 'node:os';
const realTmp=os.tmpdir();
process.env.TEMP=process.env.TMP=realTmp;
Object.defineProperty(process,'platform',{value:'win32'});
