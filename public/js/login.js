// login.js
const socket = io();
let widgetId;

socket.on('captchaKey', key => {
  widgetId = grecaptcha.render(document.querySelector('.g-recaptcha'), {
    sitekey: key,
    callback: () => validate()
  });
  initForm();
});
window.onload = () => socket.emit('requestCaptchaKey');

function initForm(){
  const form = document.getElementById('loginForm');
  form.querySelector('button').disabled = true;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.recaptchaToken = grecaptcha.getResponse(widgetId);

    const res = await fetch('/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (res.ok) {
      window.location = '/dashboard';
    } else {
      const err = await res.json();
      alert(err.message);
      form.reset();
      grecaptcha.reset(widgetId);
    }
  });

  form.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', validate)
  );
}

function validate(){
  const form = document.getElementById('loginForm');
  const filled = [...form.querySelectorAll('input[required]')]
    .every(i => i.value.trim());
  const ok = filled && grecaptcha.getResponse(widgetId).length>0;
  form.querySelector('button').disabled = !ok;
}
