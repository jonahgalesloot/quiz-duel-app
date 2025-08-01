// public/js/play.js

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('saveSettings')
          .addEventListener('click', saveSettings);
});

async function loadSettings() {
  try {
    // 1) Fetch current user’s settings
    const res = await fetch('/play/settings', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to load settings');
    const { numShort, numLong, questionSets } = await res.json();

    // 2) Fetch all available question sets
    const setsRes = await fetch('/api/questionSets', {
      credentials: 'include'
    });
    if (!setsRes.ok) throw new Error('Failed to load question sets');
    const allSets = await setsRes.json(); // array of { _id, name, ... }

    // Populate numeric inputs
    document.getElementById('numShort').value = numShort;
    document.getElementById('numLong').value  = numLong;

    // Populate checkboxes for each set name
    const container = document.getElementById('setsCheckboxes');
    container.innerHTML = '';
    allSets.forEach(set => {
      const id = 'set-' + set._id;
      const wrapper = document.createElement('label');
      wrapper.className = 'set-item';
      wrapper.htmlFor = id;
      wrapper.innerHTML = `
        <input type="checkbox"
               id="${id}"
               name="questionSet"
               value="${set.name}"
               ${ questionSets.includes(set.name) ? 'checked' : '' } />
        ${set.name}
      `;
      container.appendChild(wrapper);
    });
  } catch (err) {
    console.error(err);
    alert('Error loading settings');
  }
}

async function saveSettings() {
  const numShort = +document.getElementById('numShort').value;
  const numLong  = +document.getElementById('numLong').value;
  const sets     = Array.from(
    document.querySelectorAll('#setsCheckboxes input:checked')
  ).map(cb => cb.value);

  const payload = { numShort, numLong, questionSets: sets };

  try {
    const res = await fetch('/play/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Save failed');
    alert('Settings saved!');
  } catch (err) {
    console.error(err);
    alert('Error saving settings');
  }
}
