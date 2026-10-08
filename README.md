# Voilà chef — site

Site statique trilingue (JA / EN / FR) de Voilà chef, chefs privés à Kyoto. Hébergé sur Vercel.

## Structure

```
content/      site.json (config) + ja.json / en.json / fr.json (tous les textes)
templates/    base.html, index.html, demande.html, legal.html (Jinja2)
tools/        build.py — génère les pages, sitemap.xml, robots.txt (+ images avec --images)
source/img/   photos originales haute définition (ne pas servir telles quelles)
assets/       css/style.css · js/main.js · img/ (générées : 800 / 1400 / 2000 px, WebP + JPEG)
api/          demande.js — fonction Vercel : formulaire → e-mail via Resend
ja/ en/ fr/   pages générées (ne pas éditer à la main — modifier content/ puis rebuild)
vercel.json   URLs propres, redirection / → langue du navigateur (fr / en / sinon ja), cache, headers
```

URLs : `/ja` `/ja/request` `/ja/legal` · `/en` `/en/request` `/en/legal` · `/fr` `/fr/demande` `/fr/mentions-legales`

## Modifier le site

1. Éditer `content/<lang>.json` (textes) ou `templates/` (structure) ou `assets/css/style.css` (style).
2. `pip install jinja2 pillow` (une fois) puis `python tools/build.py`.
3. Nouvelles photos : déposer dans `source/img/`, ajuster le dictionnaire `IMAGES` dans `tools/build.py`, puis `python tools/build.py --images`.
4. Commit + push → Vercel déploie.

## Formulaire de demande

`assets/js/main.js` envoie le formulaire en JSON à `/api/demande`. Sans configuration, l'API répond 503 et la page propose un lien `mailto:` pré-rempli — le site fonctionne donc dès le premier déploiement.

Pour l'envoi automatique : créer un compte [Resend](https://resend.com) (gratuit), puis dans Vercel → Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | clé API Resend |
| `DEMANDE_TO` | `contact-voilaJP@proton.me` (défaut) |
| `RESEND_FROM` | `Voilà chef <contact@votre-domaine>` une fois le domaine vérifié dans Resend ; en attendant `Voilà chef <onboarding@resend.dev>` (défaut, envoi limité à l'adresse du compte Resend) |

Redéployer après l'ajout des variables. Le client reçoit un accusé de réception dans sa langue.

## À compléter avant mise en ligne publique

- `content/site.json` → `base_url` (domaine définitif), `school_url` (URL du site Voilà les enfants), `ga_id` (GA4, facultatif).
- Pages légales : remplacer les blocs `[À COMPLÉTER]` / `[TO COMPLETE]` / `[要記入]` dans `content/*.json` (section `legal`).
- Photos : les images actuelles sont illustratives ; remplacer 1:1 dans `source/img/` par les vraies photos, puis `--images`.
