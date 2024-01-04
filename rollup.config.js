import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'build/index.js',
      format: 'cjs'
    },
    {
      file: 'build/index.min.js',
      format: 'iife',
      name: 'version',
      plugins: [nodePolyfills(), terser()]
    }
  ],
  plugins: [nodeResolve()]
};
