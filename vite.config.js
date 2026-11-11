import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api/generation':'http://127.0.0.1:5198'}},build:{target:'es2022',rollupOptions:{input:{main:'index.html',pipeline:'pipeline.html',canvas2:'canvas2.html'},output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/controls/TransformControls.js']}}}}});
