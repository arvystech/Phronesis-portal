import { resultsAPI, records, valueOf } from './api.js';

const form = document.getElementById('teacherLoginForm');
const classSelect = document.getElementById('teacherClass');
const passwordInput = document.getElementById('teacherPassword');
const message = document.getElementById('loginMessage');
const submitButton = form.querySelector('button[type="submit"]');

initialize();

async function initialize() {
  try {
    const response = await resultsAPI.listClasses();
    const classes = records(response, ['classes', 'items']);
    classSelect.replaceChildren(new Option('Select a class', ''));
    classes.forEach((item) => {
      const id = valueOf(item, 'classId', 'class_id', 'id');
      const name = valueOf(item, 'className', 'class_name', 'name');
      if (id !== '' && name) classSelect.add(new Option(name, String(id)));
    });
    classSelect.disabled = classes.length === 0;
    if (!classes.length) showMessage('No classes are available for result entry.', true);
  } catch (error) {
    classSelect.disabled = true;
    showMessage(error.message || 'Could not load classes. Please try again.', true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  showMessage('Signing in...', false);
  try {
    await resultsAPI.login(classSelect.value, passwordInput.value);
    window.location.replace('/results/dashboard');
  } catch (error) {
    showMessage(error.message || 'The password does not match the selected class.', true);
    passwordInput.focus();
  } finally {
    submitButton.disabled = false;
  }
});

function showMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
  message.classList.toggle('is-success', !isError);
}
