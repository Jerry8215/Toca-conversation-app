# Toca: demonstração

Protótipo funcional da atualização de usuários e segurança: cadastro com Google, avatar de animalzinho, perfil com apelido e sexo obrigatório, Karma que recompensa conversa (e não volume), troca por presentes raros aos 5.000 pontos, e moderação protegida no servidor.

A interface segue o design enviado (`design.png`).

## Como rodar

Requer **Node.js 22.13 ou mais novo**. Não há dependências para instalar.

```bash
cd demo
npm start            # http://localhost:3000
npm run reset        # apaga o banco e recria os dados de exemplo
```

O banco SQLite é criado em `demo/data/toca.db` na primeira execução, com os usuários e as mensagens da tela do design.

## Roteiro de teste (5 minutos)

| Passo | O que fazer | O que observar |
|---|---|---|
| 1 | Abra `http://localhost:3000` (ou qualquer caminho, como `/admin`) | Sem sessão, o link geral sempre abre a **tela de cadastro** |
| 2 | "Continuar com o Google" → "Usar outra conta" → `novo@gmail.com` | Conta criada com **avatar aleatório** e **nome temporário** (ex.: "Raposa 3202") |
| 3 | Tente entrar sem marcar o sexo | Bloqueado. **Masculino/Feminino é obrigatório**, e por padrão fica visível só para o próprio usuário |
| 4 | No chat, envie `kkkk`, depois uma frase de verdade | `kkkk` → **0 Karma** (curta). A frase → **+2**. Repetir a frase → 0 (repetida) |
| 5 | Digite `/#/admin` na barra | O servidor responde **403** e registra a tentativa no log de moderação |
| 6 | Saia e entre como **Mimi** (4.996 Karma). Envie uma frase, depois entre como **Thor** e reaja a ela | Mimi passa de 5.000 → o botão dourado **"Trocar 5.000 Karma"** é liberado |
| 7 | Como Mimi, troque pela "Raposa da Luz" | O presente numerado (Nº 2 de 100) aparece em destaque na **vitrine do perfil**, separado dos presentes da loja |
| 8 | Entre como **Luna** (moderadora) → Administração | Mesmo sendo moderadora, é preciso digitar a **senha de moderação**: `toca-moderacao-2026` |
| 9 | No painel: aba Registro, Sinais, remova uma mensagem | Toda ação (e toda tentativa negada) fica registrada com quem, o quê, o alvo, o IP e o horário. O Karma da mensagem removida é estornado |

## Como cada requisito foi resolvido

### 1. Segurança do moderador
- O link geral é uma SPA: sem sessão válida, qualquer rota cai em `#/entrar`.
- **O papel vem do banco a cada requisição** (`loadSession` em `server.js`). O navegador nunca informa quem é moderador.
- **Todas as rotas `/api/mod/*` passam por `requireModerator()`**: sem papel `moderator` → 403 + registro + sinal "Tentou moderar".
- **Senha de moderação (step-up)**: além do papel, o moderador confirma uma senha que libera o painel por 15 min, com limite de 5 tentativas a cada 15 min e comparação em tempo constante.
- Moderador não pode banir outro moderador nem a si mesmo. Promover alguém a moderador só pelo terminal do servidor: `npm run promote -- email@gmail.com`.
- Sessão por cookie `HttpOnly` + `SameSite`, token guardado como hash SHA-256, proteção CSRF por cabeçalho, CSP restritiva.

### 2. Cadastro com Google
- Com `GOOGLE_CLIENT_ID` definido, usa o **Google Identity Services** real: o servidor valida o ID token (audiência, emissor, expiração e e-mail verificado).
- Sem a variável, a demo mostra um seletor de conta simulado, para poder testar sem configurar nada.

```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com MOD_PIN=uma-senha-forte npm start
```

### 3. Avatares e perfil
- Avatar sorteado entre 12 animaizinhos (`lib/avatars.js`) e nome temporário único ("Ursinho 4821").
- Apelido: 3 a 20 caracteres, **único** (sem diferenciar maiúsculas nem acentos), com lista de termos proibidos (inclui "admin" e "moderador", contra falsificação), uma troca a cada 24h.
- Sexo obrigatório (M/F), com a opção de deixar visível ou não no perfil público.

### 4. Karma
Regras em `lib/karma.js` e `lib/config.js`:

| Origem | Pontos |
|---|---|
| Mensagem com conteúdo (≥ 10 letras, ≥ 2 palavras) | +2, no máximo 1 a cada 30 s |
| Outra pessoa reagiu | +3 (1 vez por pessoa, até 10 por mensagem) |
| Outra pessoa respondeu | +5 |
| Mensagem curta, só emoji, "kkkk", repetida (similaridade ≥ 80%) | 0 |
| Teto diário | 150 |

Cada ponto fica no livro-razão (`karma_ledger`) com a origem. Os sinais automáticos para a moderação são: rajada de mensagens vazias ou repetidas, mesma pessoa reagindo sempre ao mesmo autor, 3 ou mais contas criadas do mesmo IP em 24h, e tentativas de acessar a moderação.

### 5. Presentes raros
- O botão só é liberado com saldo ≥ 5.000. A troca é uma **transação atômica**: debita o saldo, baixa o estoque, gera o número de série e grava o registro.
- Os presentes raros têm estoque limitado e numeração ("Nº 2 de 100"), um de cada por pessoa, e aparecem na **vitrine do perfil**, separados dos presentes pagos da loja.
- O painel mostra **quantos usuários chegaram aos 5.000 e em quantos dias, em média**, para ajustar a pontuação.

## Publicar no Railway

1. New Project → Deploy from GitHub repo → escolha este repositório. O Railway detecta o Node e roda `npm start`.
2. Variables: `MOD_PIN` = uma senha forte (opcional: `GOOGLE_CLIENT_ID`).
3. Anexe um **Volume** ao serviço (qualquer caminho, ex.: `/data`). O servidor usa `RAILWAY_VOLUME_MOUNT_PATH` automaticamente, e os dados sobrevivem a novos deploys.
4. Settings → Networking → **Generate Domain**.

## Estrutura

```
demo/
  server.js          API HTTP, sessões, rotas de moderação
  lib/schema.sql     esquema SQL (portável para MySQL/PostgreSQL)
  lib/db.js          conexão + dados de exemplo
  lib/karma.js       motor de Karma e sinais antiabuso
  lib/text.js        normalização, similaridade, validação de apelido
  lib/config.js      todos os limites ajustáveis
  public/            front-end (HTML/CSS/JS puro)
```

> A demo usa Node.js para rodar sem instalar nada. A lógica (esquema SQL, regras de Karma e o portão de moderação) é independente de linguagem e passa direto para PHP + MySQL no aplicativo existente.
