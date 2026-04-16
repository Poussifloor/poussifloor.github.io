---
layout: page
title: Divers
permalink: /divers/
---

<p>Trucs divers.</p>




{% for page in site.pages %}
  {% if page.path contains '.md' or page.path contains '.html' or page.path contains 'divers'%}
    {% unless page.path contains '_' %}
- `{{ page.path | split: '.' | first }}`
    {% endunless %}
  {% endif %}
{% endfor %}

<div> -----------------------------------</div>

{% for page in site.pages %}
  {% if page.path contains '.md' or page.path contains '.html' or page.path contains 'divers'%}
    {% unless page.path contains '_' %}
- [{{  page.path | split: '.' | first }}]({{ page.url }})
    {% endunless %}
  {% endif %}
{% endfor %}
