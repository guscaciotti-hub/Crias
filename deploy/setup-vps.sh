#!/bin/bash
set -e

echo "======================================"
echo "  AtendêAI — Setup VPS Hostinger"
echo "======================================"

# 1. Atualiza o sistema
echo "[1/8] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Instala Node.js 20 LTS
echo "[2/8] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1
echo "Node: $(node -v) | npm: $(npm -v)"

# 3. Instala pnpm
echo "[3/8] Instalando pnpm..."
npm install -g pnpm pm2 > /dev/null 2>&1
echo "pnpm: $(pnpm -v) | pm2: $(pm2 -v)"

# 4. Cria pastas persistentes
echo "[4/8] Criando pastas de dados..."
mkdir -p /root/atendeai/data/sessions
mkdir -p /root/atendeai/app

# 5. Clona o repositório
echo "[5/8] Clonando repositório..."
cd /root/atendeai
if [ -d "app/.git" ]; then
  echo "  Repositório já existe, atualizando..."
  cd app
  git fetch origin
  git checkout claude/peaceful-darwin-RUNJD
  git pull origin claude/peaceful-darwin-RUNJD
else
  git clone -b claude/peaceful-darwin-RUNJD https://github.com/guscaciotti-hub/express-js-on-vercel.git app
  cd app
fi

# 6. Cria arquivo de variáveis de ambiente
echo "[6/8] Configurando variáveis de ambiente..."
cat > /root/atendeai/app/server/.env << 'ENVEOF'
NODE_ENV=production
PORT=3001
DB_PATH=/root/atendeai/data/atendeai.db
SESSIONS_DIR=/root/atendeai/data/sessions
ADMIN_EMAIL=guscaciotti@gmail.com
OPENAI_API_KEY=
ENVEOF
echo "  ⚠️  Edite /root/atendeai/app/server/.env para adicionar OPENAI_API_KEY se quiser IA"

# 7. Instala dependências e faz build
echo "[7/8] Instalando dependências e compilando..."
cd /root/atendeai/app
pnpm install --frozen-lockfile
pnpm run build

# 8. Configura PM2
echo "[8/8] Iniciando com PM2..."
pm2 delete atendeai 2>/dev/null || true
pm2 start server/dist/server/index.js --name atendeai
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "======================================"
echo "  ✅ Deploy concluído!"
echo "======================================"
echo ""
echo "  Sistema rodando em: http://2.25.145.193:3001"
echo ""
echo "  Comandos úteis:"
echo "  pm2 logs atendeai     → ver logs"
echo "  pm2 restart atendeai  → reiniciar"
echo "  pm2 status            → ver status"
echo ""
