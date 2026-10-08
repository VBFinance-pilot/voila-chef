// Vercel serverless function — receives the enquiry form and e-mails it via Resend.
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   required — https://resend.com (free tier)
//   DEMANDE_TO       recipient (default: contact-voilaJP@proton.me)
//   RESEND_FROM      sender; must be a verified domain in Resend, or "Voilà chef <onboarding@resend.dev>" for testing
// Without RESEND_API_KEY the function returns 503 and the page falls back to a mailto: link.

const TO_DEFAULT = 'contact-voilaJP@proton.me';
const FROM_DEFAULT = 'Voilà chef <onboarding@resend.dev>';

const LABELS = {
  occasion: 'Occasion', formule: 'Formule', date: 'Date', time: 'Heure', guests: 'Convives', place: 'Lieu',
  table: 'Table', budget: 'Budget', name: 'Nom', language: 'Langue', email: 'E-mail', phone: 'Téléphone',
  message: 'Message', lang: 'Langue du site'
};

const ACK = {
  ja: { subject: 'Voilà chef — お問い合わせを受け付けました', body: 'お問い合わせありがとうございます。48時間以内に、最初のご提案をお送りします。\n\nVoilà chef — Kyoto' },
  en: { subject: 'Voilà chef — your enquiry has arrived', body: 'Thank you for your enquiry. We come back to you within 48 hours with a first proposal.\n\nVoilà chef — Kyoto' },
  fr: { subject: 'Voilà chef — votre demande est bien arrivée', body: 'Merci pour votre demande. Nous revenons vers vous sous 48 heures avec une première proposition.\n\nVoilà chef — Kyoto' }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function send(key, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'not_configured' });

  let data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  data = data || {};
  if (data.website) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const name = String(data.name || '').trim().slice(0, 200);
  const email = String(data.email || '').trim().slice(0, 200);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const rows = Object.keys(LABELS)
    .filter((k) => data[k])
    .map((k) => `<tr><td style="padding:6px 16px 6px 0;color:#8B8273;white-space:nowrap">${esc(LABELS[k])}</td><td style="padding:6px 0">${esc(String(data[k]).slice(0, 2000)).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
  const text = Object.keys(LABELS).filter((k) => data[k]).map((k) => `${LABELS[k]}: ${String(data[k]).slice(0, 2000)}`).join('\n');

  const to = process.env.DEMANDE_TO || TO_DEFAULT;
  const from = process.env.RESEND_FROM || FROM_DEFAULT;
  const lang = ACK[data.lang] ? data.lang : 'ja';

  try {
    await send(key, {
      from, to: [to], reply_to: email,
      subject: `Demande Voilà chef — ${name} · ${data.occasion || ''} · ${data.date || ''}`.trim(),
      text,
      html: `<div style="font-family:Georgia,serif;color:#141311"><h2 style="font-weight:300">Nouvelle demande — Voilà chef</h2><table style="font-family:system-ui,sans-serif;font-size:14px;border-collapse:collapse">${rows}</table></div>`
    });
    // Acknowledgement to the client (best effort)
    try {
      await send(key, { from, to: [email], subject: ACK[lang].subject, text: ACK[lang].body });
    } catch (e) { console.warn('ack failed', e.message); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
}
