---
layout: page
title: /
---


{% assign sorted_pages = site.pages | sort: "path" %}
{% for page in sorted_pages %}
  {% if page.path contains '.md' or page.path contains '.html' %}
    {% unless page.path contains '_' or page.path == 'index.md'%}
- `{{ page.path | split: '.' | first | split: '/index' | first }}`
    {% endunless %}
  {% endif %}
{% endfor %}