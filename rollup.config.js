// rollup.config.js

import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json'; // Импортируем плагин JSON

export default {
    input: 'src/index.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'cjs', // CommonJS подходит для Node.js окружения
        sourcemap: true,
    },
    plugins: [
        json(), // Добавляем плагин JSON сюда
        typescript(),
        resolve({
            preferBuiltins: false, // Убедитесь, что node_modules ищутся правильно
        }),
        commonjs(),
    ],
};