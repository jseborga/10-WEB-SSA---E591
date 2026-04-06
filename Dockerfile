FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY main.js /usr/share/nginx/html/main.js
COPY hero-architecture.svg /usr/share/nginx/html/hero-architecture.svg
COPY media /usr/share/nginx/html/media

EXPOSE 80
