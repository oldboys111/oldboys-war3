FROM caddy:alpine

COPY ./public /usr/share/caddy

EXPOSE 3000

CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":3000"]
