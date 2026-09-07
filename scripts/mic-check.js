(async () => {
  const lines = [];
  const add = (label, value) => lines.push(label + ': ' + value);

  const frame = document.querySelector('iframe.pipeelo-frame');
  const panelOrigin = frame ? new URL(frame.src).origin : 'https://widget.pipeelo.com';

  add('página', location.origin + location.pathname);
  add('contexto seguro (https)', window.isSecureContext);
  add('página dentro de outro iframe', window.parent !== window);

  let header = null;
  try {
    const res = await fetch(location.href, { cache: 'no-store' });
    header = res.headers.get('permissions-policy') || res.headers.get('feature-policy');
  } catch (err) {
    header = 'ILEGÍVEL:' + err.name;
  }
  add('Permissions-Policy do site', header || 'nenhum (ok)');

  const policy = document.featurePolicy;
  add(
    'microfone na página',
    policy ? policy.allowsFeature('microphone') : 'API indisponível (Safari/Firefox)'
  );
  add(
    'iframe do chat',
    frame
      ? 'allow="' + (frame.getAttribute('allow') || '') + '"'
      : 'ainda não criado — abra o chat e rode de novo'
  );

  try {
    add('permissão do navegador', (await navigator.permissions.query({ name: 'microphone' })).state);
  } catch (err) {
    add('permissão do navegador', 'não consultável (' + err.name + ')');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    add('getUserMedia na página', 'ok');
  } catch (err) {
    add('getUserMedia na página', err.name + ' — ' + err.message);
  }

  const declared = /microphone\s*=\s*(\*|\([^)]*\))/i.exec(header || '');
  const allowlist = declared ? declared[1].toLowerCase() : null;
  const delegates =
    !allowlist || allowlist === '*' || allowlist.indexOf(panelOrigin.toLowerCase()) !== -1;

  const verdict = !window.isSecureContext
    ? 'O site não está em HTTPS — nenhum navegador entrega microfone aqui.'
    : !delegates
      ? 'O CABEÇALHO DO SITE bloqueia o microfone do chat. Troque por: Permissions-Policy: microphone=(self "' +
        panelOrigin +
        '")'
      : policy && !policy.allowsFeature('microphone')
        ? 'Algo acima desta página bloqueia o microfone (cabeçalho ou iframe externo sem allow="microphone").'
        : frame && (frame.getAttribute('allow') || '').indexOf('microphone') === -1
          ? 'O loader do chat está velho (iframe sem allow="microphone") — limpe o cache/CDN do site.'
          : window.parent !== window
            ? 'A página está dentro de outro iframe: esse iframe externo também precisa de allow="microphone".'
            : 'Nada bloqueia pelo site — se o chat falhar, é permissão do navegador/sistema ou navegador embutido de app.';

  const out = 'PIPEELO — DIAGNÓSTICO DO MICROFONE\n\n' + lines.join('\n') + '\n\n=> ' + verdict;
  console.log('%c' + out, 'font-family:monospace');
  alert(out);
})();
