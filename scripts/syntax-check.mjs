import fs from 'node:fs';
import path from 'node:path';
let ts;
try { ts = await import('typescript'); } catch { ts = await import('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)): [path.join(dir,x.name)]);}
let errors=0;
for(const file of walk('src')){
 if(!/\.(ts|tsx|mjs)$/.test(file))continue;
 const text=fs.readFileSync(file,'utf8');
 const result=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
 const issues=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 for(const x of issues){console.error(file,ts.flattenDiagnosticMessageText(x.messageText,' '));errors++;}
}
if(errors)process.exit(1);console.log('Syntax transpilation PASS');
