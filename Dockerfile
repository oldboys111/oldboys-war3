FROM caddy:2-alpine

# 创建工作目录
WORKDIR /usr/share/caddy

# 复制所有文件
COPY . /usr/share/caddy/

EXPOSE 3000

CMD ["caddy", "file-server", "--root", "/usr/share/caddy", "--listen", ":3000"]
