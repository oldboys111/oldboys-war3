FROM caddy:2-alpine

WORKDIR /usr/share/caddy
COPY . /usr/share/caddy/

# Railway 会自动设置 PORT 环境变量
EXPOSE ${PORT:-80}

CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":${PORT:-80}"]
