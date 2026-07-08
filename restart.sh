git pull

npm run build

pm2 restart stock || pm2 start npm --name stock -- start -- -p 8888
