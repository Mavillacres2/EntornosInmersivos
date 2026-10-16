import { ANALYSIS_CONFIG } from '../analysis/config/AnalysisConfig';
/** Server-verified access; no password/token is stored in browser storage. */
export class SpecialistAccess {
    static async request(path: string, body?: unknown): Promise<{
        authorized: boolean;
    }> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        try {
            const response = await fetch(`${ANALYSIS_CONFIG.apiBaseUrl}/auth/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error ?? 'No se pudo comprobar el acceso.');
            return result;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    static lock(): Promise<{
        authorized: boolean;
    }> { return this.request('lock', {}); }
    static gate(onAuthorized: () => HTMLElement): HTMLElement {
        const wrapper = document.createElement('section');
        const renderLogin = () => {
            wrapper.replaceChildren();
            const form = document.createElement('form');
            form.className = 'specialistLogin';
            form.innerHTML = '<h2>Acceso del especialista</h2><p>Ingrese su contraseña para consultar los indicadores de evaluación.</p><label>Contraseña<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button type="submit">Ver indicadores de evaluación</button><p role="status"></p>';
            form.addEventListener('submit', event => { event.preventDefault(); const input = form.querySelector('input')!, button = form.querySelector('button')!; button.disabled = true; void this.request('login', { password: input.value }).then(() => renderContent()).catch(error => { form.querySelector('[role=status]')!.textContent = error instanceof Error ? error.message : 'No se pudo verificar el acceso.'; }).finally(() => { input.value = ''; button.disabled = false; }); });
            wrapper.append(form);
        };
        const renderContent = () => { wrapper.replaceChildren(); const logout = document.createElement('button'); logout.className = 'secondaryAction'; logout.textContent = 'Bloquear acceso'; logout.addEventListener('click', () => { logout.disabled = true; void this.lock().then(renderLogin).catch(() => { logout.disabled = false; logout.textContent = 'No se pudo bloquear. Reintentar'; }); }); wrapper.append(logout, onAuthorized()); };
        renderLogin();
        void this.request('session').then(result => { if (result.authorized && wrapper.isConnected)
            renderContent(); }).catch(() => { });
        return wrapper;
    }
}
