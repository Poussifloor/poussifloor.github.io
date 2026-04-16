(function () {
  const input = document.getElementById('answer');
  const btn = document.getElementById('answerBtn');
  if (!input || !btn) return;

  const routes = {
    cv: '/cv/',
    lecture: '/lecture/',
    divers: '/divers/'
  };

  function submit() {
    //const key = input.value.trim().toLowerCase();
    //const target = routes[key];
    const key = '/'+input.value.trim().toLowerCase();
    const target = key;
    if (target) {
      window.location.href = target;
    }
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
})();
