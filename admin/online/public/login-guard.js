// Diagnóstico leve: impede que um erro de carregamento do Firebase pareça um botão quebrado.
(() => {
  const form = document.getElementById('loginForm');
  const feedback = document.getElementById('loginFeedback');
  if (!form || !feedback) return;
  let ready = false;
  window.addEventListener('rodapay-admin-ready', () => { ready = true; });
  form.addEventListener('submit', event => {
    if (ready) return;
    event.preventDefault();
    feedback.textContent = 'O login não carregou. Atualize a página com Ctrl + F5. Se continuar, verifique se o Firebase está acessível.';
    feedback.classList.add('error');
  });
})();
