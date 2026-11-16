export function createPrivacyFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'professionalFooter';
  footer.innerHTML = `<div><strong>NeuroExplora</strong><span>Entornos inmersivos · Apoyo a la evaluación cognitiva</span><small>Proyecto académico · ${new Date().getFullYear()}</small></div><nav aria-label="Información del proyecto"><button type="button" data-policy="privacy">Privacidad</button><button type="button" data-policy="terms">Condiciones de uso</button></nav>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'policyDialog';
  dialog.setAttribute('aria-labelledby', 'policyTitle');
  footer.append(dialog);
  footer.querySelectorAll<HTMLButtonElement>('[data-policy]').forEach(button => {
    button.addEventListener('click', () => {
      const privacy = button.dataset.policy === 'privacy';
      dialog.innerHTML = `<form method="dialog"><button class="policyClose" aria-label="Cerrar información">Cerrar ×</button></form><p class="specialistEyebrow">Transparencia · Versión de prototipo</p><h2 id="policyTitle">${privacy ? 'Aviso de privacidad' : 'Condiciones de uso'}</h2>${privacy ? `
        <h3>Qué información utiliza</h3><p>La sesión se identifica mediante un código, sin solicitar nombres en el aplicativo. Se registran respuestas, tiempos, errores, eventos de la actividad e indicadores derivados de orientación y movimiento. Un código no convierte los datos en anónimos si existe información que permita asociarlo a una persona.</p>
        <h3>Cámara y finalidad</h3><p>El video se procesa en el navegador para obtener indicadores durante las actividades. La aplicación no envía ni almacena fotografías o video en su API. Los indicadores y resultados se envían al servidor configurado para la revisión del especialista. Los modelos de visión pueden descargarse desde servicios externos.</p>
        <h3>Participación de menores</h3><p>La persona responsable de la evaluación debe informar previamente al representante legal y gestionar la autorización que corresponda. También debe explicar la actividad al niño de forma comprensible. El permiso de cámara del navegador no sustituye el consentimiento informado.</p>
        <h3>Acceso y derechos</h3><p>Las consultas de resultados requieren acceso de especialista. Solicite a la institución responsable información sobre acceso, rectificación, eliminación y demás derechos aplicables, así como el procedimiento para retirar el consentimiento cuando sea la base del tratamiento.</p>
        <h3>Información del responsable</h3><p id="policyResponsibility"></p><p>Antes de utilizar el prototipo con participantes reales, el responsable debe completar el aviso institucional: identidad y contacto, base del tratamiento, conservación, destinatarios y canal para ejercer derechos. Esta versión informa sobre el funcionamiento del prototipo y no reemplaza ese documento.</p>` : `
        <h3>Alcance</h3><p>NeuroExplora es un prototipo académico para obtener indicadores durante actividades cognitivas. Sus resultados no constituyen un diagnóstico de TDAH ni reemplazan una evaluación profesional.</p>
        <h3>Uso acompañado</h3><p>El especialista prepara la sesión, revisa las autorizaciones aplicables y comprueba cámaras, iluminación y comodidad. El niño elige una aventura y practica antes de la actividad. Puede solicitar ayuda o detener su participación.</p>
        <h3>Interpretación y cuidado de la información</h3><p>Las mediciones dependen de la visibilidad, el equipo y la calidad de captura. Los datos ausentes no equivalen a ausencia de movimiento. Utilice códigos de participante, proteja sus credenciales y comparta los resultados únicamente con personas autorizadas.</p>
        <h3>Interrupciones</h3><p>Si se pierde la conexión, algunos datos pueden quedar temporalmente pendientes en memoria. No cierre ni recargue la página hasta revisar el estado de guardado. Ante un fallo de captura, el especialista debe valorar si es necesario repetir la sesión.</p>`}<p class="policyVersion">Actualizado: 16 de noviembre de 2026 · <a href="https://www.spdp.gob.ec/marco-normativo/" target="_blank" rel="noopener noreferrer">Marco normativo de protección de datos en Ecuador</a></p>`;
      const responsibility = dialog.querySelector('#policyResponsibility');
      if (responsibility) {
        const owner = import.meta.env.VITE_PRIVACY_CONTROLLER;
        const contact = import.meta.env.VITE_PRIVACY_CONTACT;
        const retention = import.meta.env.VITE_PRIVACY_RETENTION;
        responsibility.textContent = owner && contact && retention
          ? `Responsable: ${owner}. Contacto: ${contact}. Conservación: ${retention}.`
          : 'Responsable, contacto y plazo de conservación: pendientes de definición institucional.';
      }
      dialog.showModal();
    });
  });
  return footer;
}
