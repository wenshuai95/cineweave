import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,symlink,cp,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const work=resolve(root,'../../work/release-'+version),output=resolve(root,'..');
const app='造梦工坊.app';
const source=join(work,'packaged','造梦工坊-darwin-arm64',app);
const stage=join(work,'dmg-source'),mount=join(work,'dmg-mount');
await access(source);
await rm(stage,{recursive:true,force:true});
await mkdir(stage,{recursive:true});await mkdir(mount,{recursive:true});
// macOS cp preserves framework symlinks and the signed bundle structure.
execFileSync('/bin/cp',['-R',source,join(stage,app)],{stdio:'inherit'});
await symlink('/Applications',join(stage,'Applications'));
await cp(join(root,'desktop/安装与使用说明.txt'),join(stage,'安装与使用说明.txt'));
const dmg=join(output,`造梦工坊-v${version}-AppleSilicon.dmg`);
execFileSync('hdiutil',['create','-srcfolder',stage,'-volname',`造梦工坊 ${version}`,'-format','UDZO','-ov',dmg],{stdio:'inherit'});
execFileSync('hdiutil',['verify',dmg],{stdio:'inherit'});
let mounted=false;
try{
 execFileSync('hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,dmg],{stdio:'inherit'});mounted=true;
 await access(join(mount,app));await access(join(mount,'Applications'));
 execFileSync('codesign',['--verify','--deep','--strict',join(mount,app)],{stdio:'inherit'});
 const actual=JSON.parse(await readFile(join(mount,app,'Contents/Resources/app/package.json'),'utf8')).version;
 if(actual!==version)throw Error('镜像内版本不一致');
}finally{if(mounted)execFileSync('hdiutil',['detach',mount],{stdio:'inherit'});}
const hash=execFileSync('shasum',['-a','256',dmg],{encoding:'utf8'}).trim().split(/\s+/)[0];
await writeFile(dmg+'.sha256',`${hash}  ${dmg.split('/').at(-1)}\n`);
await cp(join(root,'desktop/安装与使用说明.txt'),join(output,`造梦工坊-v${version}-安装说明.txt`));
console.log('DMG 已验证：'+dmg+'\nSHA-256: '+hash);
