import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from './errors.js';
import type { AppConfig } from '../config/env.js';
const cookieName = 'neuroexplora_specialist';
const ttlMs = 15 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function passwordHash(password: string, salt = randomBytes(24).toString('hex')): Promise<string> {
    return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(`scrypt$${salt}$${key.toString('hex')}`)));
}
export class SpecialistAuth {
    private readonly tokens = new Map<string, number>();
    private readonly attempts = new Map<string, {
        count: number;
        until: number;
    }>();
    constructor(private readonly config: AppConfig) { }
    private token(request: Request): string {
        return request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? '';
    }
    authorized(request: Request): boolean {
        const key = digest(this.token(request)), expires = this.tokens.get(key);
        if (!expires || expires < Date.now()) {
            this.tokens.delete(key);
            return false;
        }
        return true;
    }
    require = (request: Request, response: Response, next: NextFunction): void => {
        response.setHeader('Cache-Control', 'no-store');
        if (!this.authorized(request)) {
            next(new ApiError(401, 'Se requiere acceso del especialista.'));
            return;
        }
        next();
    };
    async login(request: Request, response: Response): Promise<void> {
        const stored = this.config.specialistPasswordHash;
        if (!stored || !/^scrypt\$[a-f0-9]{48}\$[a-f0-9]{128}$/.test(stored))
            throw new ApiError(503, 'El acceso del especialista todavía no está configurado en el servidor.');
        const address = request.ip ?? 'unknown', now = Date.now();
        const attempt = this.attempts.get(address);
        if (attempt && attempt.until > now && attempt.count >= 5)
            throw new ApiError(429, 'Demasiados intentos. Espere un minuto.');
        const next = attempt && attempt.until > now ? { count: attempt.count + 1, until: attempt.until } : { count: 1, until: now + 60000 };
        if (this.attempts.size > 1000)
            this.attempts.delete(this.attempts.keys().next().value!);
        this.attempts.set(address, next);
        const { password } = z.object({ password: z.string().min(1).max(256) }).strict().parse(request.body);
        const calculated = await passwordHash(password, stored.split('$')[1]);
        if (!timingSafeEqual(Buffer.from(calculated), Buffer.from(stored)))
            throw new ApiError(401, 'No se pudo verificar el acceso.');
        this.attempts.delete(address);
        this.tokens.delete(digest(this.token(request)));
        for (const [key, expiry] of this.tokens)
            if (expiry < now)
                this.tokens.delete(key);
        if (this.tokens.size >= 1000)
            throw new ApiError(503, 'No se puede abrir otra sesión de acceso.');
        const token = randomBytes(32).toString('hex');
        this.tokens.set(digest(token), now + ttlMs);
        response.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict', secure: this.config.production, path: '/api', maxAge: ttlMs });
        response.setHeader('Cache-Control', 'no-store');
        response.json({ authorized: true });
    }
    lock(request: Request, response: Response): void {
        this.tokens.delete(digest(this.token(request)));
        response.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: this.config.production, path: '/api' });
        response.setHeader('Cache-Control', 'no-store');
        response.json({ authorized: false });
    }
}
