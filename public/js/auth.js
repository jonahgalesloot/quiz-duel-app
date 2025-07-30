// auth.js

const recaptchaWidgets = [];
const socket = io();

// 1) Request site‑key from server on load
socket.on('captchaKey', key => initRecaptchas(key));
window.onload = () => socket.emit('requestCaptchaKey');

// 2) Render every .g-recaptcha on page
function initRecaptchas(key) {
  document.querySelectorAll('.g-recaptcha').forEach((el, i) => {
    recaptchaWidgets[i] = grecaptcha.render(el, {
      sitekey: key,
      callback: () => validateForm(el.closest('form').id)
    });
  });
  setupForms();
}

// 3) Enable/disable submit based on inputs + recaptcha
function validateForm(formId) {
  const form = document.getElementById(formId);
  const filled = [...form.querySelectorAll('input[required]')]
    .every(i => i.value.trim());
  const response = grecaptcha.getResponse(recaptchaWidgets[ formId==='loginForm'?0:1 ]);
  form.querySelector('button').disabled = !(filled && response);
}

// 4) Initial form setup
function setupForms() {
  ['loginForm','signupForm'].forEach(id => {
    const form = document.getElementById(id);
    form.querySelector('button').disabled = true;
    form.addEventListener('submit', e => handleSubmit(e, id));
  });
}

// 5) Handle submit to /login or /signup
async function handleSubmit(e, formId) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  data.recaptchaToken = grecaptcha.getResponse(recaptchaWidgets[ formId==='loginForm'?0:1 ]);

  const endpoint = formId === 'loginForm' ? '/login' : '/signup';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (res.ok) {
    // On login → go to dashboard, on signup → go to login
    window.location = endpoint === '/login' ? '/dashboard' : '/login';
  } else {
    const err = await res.json();
    alert(err.message);
    form.reset();
    grecaptcha.reset(recaptchaWidgets[ formId==='loginForm'?0:1 ]);
  }
}
