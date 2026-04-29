FROM nginx:alpine

COPY . /usr/share/nginx/html/

# Railway 会自动注入 PORT 环境变量
# nginx 默认监听 80，但如果 Railway 注入不同端口会失败
# 使用 envsubst 模板方式
