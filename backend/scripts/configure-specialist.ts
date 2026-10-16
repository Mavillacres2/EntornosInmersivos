import { emitKeypressEvents } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { passwordHash } from '../src/middleware/SpecialistAuth.js';
async function hidden(prompt: string): Promise<string> {
    if (!process.stdin.isTTY)
        throw new Error('Ejecute en una terminal interactiva. No pase contraseñas como argumentos.');
    process.stdout.write(prompt);
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolve, reject) => {
        let value = '';
        const finish = () => { process.stdin.off('keypress', read); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
        const read = (text: string, key: {
            name?: string;
            ctrl?: boolean;
        }) => {
            if (key.ctrl && key.name === 'c') {
                finish();
                reject(new Error('Cancelado'));
                return;
            }
            if (key.name === 'return') {
                finish();
                resolve(value);
                return;
            }
            if (key.name === 'backspace') {
                value = value.slice(0, -1);
                return;
            }
            if (!key.ctrl && text && !/[\x00-\x1f\x7f]/.test(text))
                value += text;
        };
        process.stdin.on('keypress', read);
    });
}
try {
    const first = await hidden('Nueva contraseña del especialista (mínimo 12 caracteres, entrada oculta): ');
    if (first.length < 12 || first.length > 256)
        throw new Error('Use entre 12 y 256 caracteres.');
    if (first !== await hidden('Repita la contraseña: '))
        throw new Error('Las contraseñas no coinciden.');
    const target = new URL('../specialist-credentials.json', import.meta.url);
    await writeFile(target, JSON.stringify({ passwordHash: await passwordHash(first) }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('Acceso configurado. Reinicie el backend. El archivo contiene solo el hash con salt y está excluido de Git.');
}
catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo configurar el acceso');
    process.exitCode = 1;
}
