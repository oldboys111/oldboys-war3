FROM caddy:alpine

COPY war3-match-system/public /usr/share/caddy

EXPOSE 3000

CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":3000"]
