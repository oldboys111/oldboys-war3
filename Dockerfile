FROM alpine:latest

RUN apk add --no-cache caddy

COPY war3-match-system/public /public

EXPOSE 3000

CMD ["caddy", "file-server", "--root", "/public", "--listen", ":3000"]
