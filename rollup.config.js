import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'build/index.cjs',
      format: 'cjs'
    },
  ],
  plugins: [nodeResolve()]
};
