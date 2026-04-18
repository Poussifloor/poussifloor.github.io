---
layout: page
title: //
---
<style>
  .page-link {
  display: block;
  font-family: 'VT323', 'Courier New', monospace;
  color: #ffe066;
  font-size: 20px;
  line-height: 1.1;
  letter-spacing: 0;
  margin: 0 0 1.5rem 0;
  text-shadow: 0 0 6px rgba(255,224,102,0.35);
}
</style>



{% assign sorted_pages = site.pages | sort: "path" %}
{% for page in sorted_pages %}
  {% if page.path contains '.md' or page.path contains '.html' %}
    {% unless page.path contains '_' or page.path == 'index.md' or page.path == '404.html' %}
<span class="page-link">{{ page.path | split: '.' | first | split: '/index' | first }}</span>
    {% endunless %}
  {% endif %}
{% endfor %}