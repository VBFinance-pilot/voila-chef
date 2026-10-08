(function () {
  'use strict';

  // Mobile menu
  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.burger');
  if (nav && burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? burger.dataset.close : burger.dataset.open);
    });
    nav.querySelectorAll('.nav__menu a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Enquiry form: POST JSON to /api/demande, fall back to mailto
  var form = document.getElementById('demande-form');
  if (!form) return;
  var status = document.getElementById('form-status');
  var okBox = status.querySelector('.form__success');
  var errBox = status.querySelector('.form__error');
  var mailto = document.getElementById('form-mailto');
  var submit = form.querySelector('button[type="submit"]');
  var submitLabel = submit.textContent;

  function payload() {
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
    return data;
  }

  function mailtoHref(data) {
    var lines = [];
    Object.keys(data).forEach(function (k) {
      if (k === 'website' || k === 'lang' || !data[k]) return;
      lines.push(k + ': ' + data[k]);
    });
    return 'mailto:' + form.dataset.email +
      '?subject=' + encodeURIComponent(form.dataset.subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function show(box) {
    status.hidden = false;
    okBox.hidden = box !== okBox;
    errBox.hidden = box !== errBox;
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    var data = payload();
    if (data.website) return; // honeypot
    mailto.href = mailtoHref(data);
    form.classList.add('is-sending');
    submit.textContent = form.dataset.sending;

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) throw new Error('bad response');
      form.querySelectorAll('fieldset, .form__actions').forEach(function (el) { el.hidden = true; });
      show(okBox);
    }).catch(function () {
      show(errBox);
    }).finally(function () {
      form.classList.remove('is-sending');
      submit.textContent = submitLabel;
    });
  });
})();
