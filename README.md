# Jogo 2D com Socket.IO

Um jogo 2D em tempo real multiplayer usando Socket.IO, Express e Canvas HTML5.

## 🎮 Características

- **Jogo 2D em Canvas** - Gráficos renderizados em tempo real com 60 FPS
- **Sistema de Movimento** - Controle com setas ou WASD
- **Apontamento e Tiro** - Mire com o mouse e clique para atirar
- **Sistema de Dash** - Pressione espaço para dash rápido
- **Inimigos Dinâmicos** - Gerados e atualizados pelo servidor
- **Multiplayer em Tempo Real** - Sincronização entre jogadores via Socket.IO
- **Sistema de Pontuação** - Ganhe pontos acertando inimigos
- **HUD Completo** - Informações de vida, pontos, inimigos e FPS
- **Painel de Controle** - Conecte/desconecte e configure o servidor
- **Log em Tempo Real** - Visualize todas as ações e eventos

## 📋 Pré-requisitos

- Node.js (v14+)
- npm
- Navegador moderno (Chrome, Firefox, Edge, Safari)

## 🚀 Instalação e Execução

### 1. Instalar dependências

```bash
npm install
```

### 2. Iniciar o servidor

```bash
npm start
```

O servidor iniciará na porta 3000 por padrão. Você verá:

```
╔═══════════════════════════════════════╗
║     Servidor Socket.IO Iniciado       ║
╠═══════════════════════════════════════╣
║ Porta: 3000                           ║
║ URL: http://localhost:3000            ║
╠═══════════════════════════════════════╣
║ Abra o arquivo index.html no navegador║
║ e configure a URL do servidor acima   ║
╚═══════════════════════════════════════╝
```

### 3. Abrir o jogo

Abra `index.html` diretamente no navegador ou acesse:
```
http://localhost:3000
```

### 4. Conectar ao servidor

No painel de controle do jogo:
1. Verifique a URL: `http://localhost:3000` (ou sua URL de servidor)
2. Clique em **Conectar**
3. Aguarde a confirmação "Conectado!"

## 🎮 Controles

| Ação | Controle |
|------|----------|
| Mover | Setas ⬆️⬇️⬅️➡️ ou WASD |
| Mirar | Mouse |
| Atirar | Clique do mouse |
| Dash | Barra de espaço |
| Toque | Toca na tela em dispositivos móveis |

## 📡 Eventos Socket.IO

### Client → Server

- **playerMove** - Envia posição e ângulo do jogador
  ```json
  { "x": 300, "y": 200, "angle": 0.5, "score": 100 }
  ```

- **shoot** - Notifica disparo de bala
  ```json
  { "x": 300, "y": 200, "angle": 0.5 }
  ```

- **enemyHit** - Confirma inimigo acertado
  ```json
  { "enemyId": "abc123", "score": 10 }
  ```

- **hello** - Teste de conexão
  ```json
  { "msg": "Olá do navegador", "playerPos": {...}, "score": 0 }
  ```

### Server → Client

- **enemies** - Lista de inimigos para renderizar
  ```json
  {
    "enemies": [
      { "id": "...", "x": 100, "y": 150, "radius": 8, "health": 20, "maxHealth": 20 }
    ]
  }
  ```

- **players** - Lista de jogadores conectados
  ```json
  {
    "players": [
      { "id": "...", "name": "Jogador-abc", "x": 300, "y": 200, "score": 50 }
    ]
  }
  ```

- **hit** - Confirmação de acerto
  ```json
  { "points": 10 }
  ```

- **message** - Mensagem do servidor
  ```json
  { "msg": "Echo: ...", "timestamp": "..." }
  ```

- **playerShoot** - Notificação de tiro de outro jogador
  ```json
  { "playerId": "...", "x": 300, "y": 200, "angle": 0.5 }
  ```

## 🌍 Testando em Servidor Remoto

Se quiser conectar a um servidor remoto (ex: `infra3212.infrananuvem.com.br:3101`):

1. No painel de controle, altere a URL do servidor
2. Clique em **Conectar**
3. O jogo sincronizará com o servidor remoto

## 🔧 Configuração do Servidor

Edite `server.js` para customizar:

```javascript
// Porta padrão
const PORT = process.env.PORT || 3000;

// CORS
cors: {
  origin: "*",  // Mudar para domínios específicos em produção
  methods: ["GET", "POST"]
}

// Frequência de atualização (30 FPS)
setInterval(() => { ... }, 1000 / 30);

// Quantidade de inimigos
while (enemies.length < 3) { ... }  // Alterar número
```

## 📊 Estrutura de Arquivos

```
games/
├── index.html       # Jogo e cliente Socket.IO
├── server.js        # Servidor Express + Socket.IO
├── package.json     # Dependências npm
└── README.md        # Este arquivo
```

## 🐛 Troubleshooting

### "Não conecta ao servidor"
- Verifique se o servidor está rodando: `npm start`
- Confirme a URL no painel de controle
- Verifique a porta (padrão: 3000)
- Veja o console do navegador (F12) para erros

### "Inimigos não aparecem"
- Certifique-se de estar conectado (indicador verde)
- Aguarde alguns segundos para inimigos serem gerados
- Verifique se `enemies` está sendo recebido (log de mensagens)

### "Não consigo atirar"
- Verifique se está conectado ao servidor
- Clique no canvas para garantir foco
- O servidor deve estar em execução

### "FPS baixo"
- Feche outras abas/programas
- Reduza o número de inimigos em `server.js`
- Use um navegador moderno (Chrome recomendado)

## 🚀 Deployment

### Heroku

```bash
npm install -g heroku-cli
heroku login
heroku create seu-app-name
git push heroku main
```

### Outros servidores

1. Instale Node.js no servidor
2. Clone o repositório
3. Execute `npm install`
4. Inicie com `npm start`
5. Configure proxy reverso (nginx/Apache) se necessário

## 📝 Licença

MIT

## 💡 Próximas Melhorias

- [ ] Diferentes tipos de inimigos
- [ ] Power-ups
- [ ] Leaderboard global
- [ ] Chat multiplayer
- [ ] Diferentes mapas
- [ ] Efeitos de som
- [ ] Animações mais suaves
- [ ] Sistema de ranking

---

**Desenvolvido com ❤️ usando Socket.IO, Express e Canvas HTML5**
