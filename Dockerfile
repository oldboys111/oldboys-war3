FROM caddy:2-alpine

COPY index.html static-app.js styles.css app.js /usr/share/caddy/
COPY images/ /usr/share/caddy/images/
COPY data/ /usr/share/caddy/data/

EXPOSE 3000

CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":3000"]
