// signup.js
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
  const form = document.getElementById('signupForm');
  form.querySelector('button').disabled = true;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.recaptchaToken = grecaptcha.getResponse(widgetId);

    const res = await fetch('/signup', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (res.ok) {
      window.location = '/login';
    } else {
      const err = await res.json();
      alert(err.message);
      form.reset();
      grecaptcha.reset(widgetId);
    }
  });

  // enable/disable on input
  form.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', validate)
  );
}

function validate(){
  const form = document.getElementById('signupForm');
  const filled = [...form.querySelectorAll('input[required]')]
    .every(i => i.value.trim());
  // Password policy: at least 8 chars, 1 letter, 1 number
  const pw = form.querySelector('input[name="password"]').value;
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const ok = filled && grecaptcha.getResponse(widgetId).length>0 && pwOk;
  form.querySelector('button').disabled = !ok;
}
