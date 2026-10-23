import {defineConfig} from 'vite';
export default defineConfig({build:{target:'es2022',rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/controls/TransformControls.js']}}}}});
