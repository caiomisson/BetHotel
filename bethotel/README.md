# 🏨 BetHotel — MVP (Etapa 1)

Web app gamificado para registrar apostas e dividir contas entre amigos, com estética de hotel isométrico em pixel art (arte original). Quem atrasa pagamento ganha teias de aranha no quarto; quem paga ganha Moedas do Hotel para decorar.

**Stack 100% gratuita:** Next.js 15 (App Router) + TypeScript + Tailwind · Supabase Free (Postgres, Auth, Realtime, Storage, pg_cron) · Vercel Hobby · GitHub.

---

## 1. Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

## 2. Configurando o Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com) (plano Free).
2. **Database → Extensions:** ative `pg_cron` e `pg_net` (o script também tenta ativá-las).
3. **SQL Editor:** cole e rode o arquivo `supabase/migrations/0001_bethotel_schema.sql` depois o `0002_catalogo_reformas.sql` depois o `0003_quartos_ranking_categorias.sql` e por último o `0004_apostas_eventos_conquistas.sql` (nessa ordem).
   Ele cria tabelas, RLS, funções, bucket `proofs` (4 MB, privado), Realtime, jobs do pg_cron e a loja inicial.
4. **Segredos para apagar comprovantes vencidos** (SQL Editor, troque os valores):
   ```sql
   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'project_url');
   select vault.create_secret('sb_secret_SUA_CHAVE_SECRETA', 'service_role_key');
   ```
   A service role key fica só dentro do banco (Vault) — nunca no front-end nem na Vercel.
5. **Authentication → URL Configuration:** adicione `http://localhost:3000/auth/callback` e `https://SEU-APP.vercel.app/auth/callback` em *Redirect URLs*.
   (Opcional em desenvolvimento: desligue *Confirm email* para entrar direto após o cadastro.)
6. **Project Settings → API:** copie a URL e a anon/publishable key para o `.env.local`.

## 3. Deploy na Vercel

1. Suba o repositório no GitHub.
2. Na Vercel: *Add New → Project* → importe o repo.
3. Em *Environment Variables*, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Nenhum cron da Vercel é necessário: tudo agendado roda no pg_cron do Supabase.

---

## 4. Regras de negócio implementadas

| Regra | Onde |
|---|---|
| Cadastro cria perfil + quarto **Kitnet (6×6)** com 0 moedas | trigger `handle_new_user` |
| Pix e WhatsApp visíveis só para quem divide aposta/conta | privilégios de coluna + `get_contact_info` |
| Aposta 1v1 ou grupo, valor em R$ ou prenda, testemunha opcional | `create_bet_expense` |
| Com testemunha, **só ela** declara o vencedor; sem testemunha, o criador | `declare_winner` |
| Dívida vence **48h** depois de nascer | `refresh_cleanliness` |
| Limpeza: −20 pontos a cada 24h de atraso (5 níveis visuais) | pg_cron a cada hora + após cada confirmação |
| Comprovante opcional, até 4 MB, apagado após **90 dias** | bucket `proofs` + `purge_expired_proofs` (pg_cron diário) |
| Validação dupla: devedor marca pago → credor confirma ou recusa | `mark_paid` / `confirm_payment` / `reject_payment` |
| Moedas: **1 por R$1** (prenda = 10), teto **500/semana** (seg–dom, horário de Brasília) | `confirm_payment` |
| Loja e roupas premium validadas no banco | `buy_item`, trigger `profiles_before_update` |
| Feed automático e chat com menções em tempo real | `lobby_events`, `chat_messages` + Supabase Realtime |
| Cobrança Expressa via `wa.me` com mensagem pronta | `src/lib/whatsapp.ts` |
| Pix direto para a chave do credor (BR Code EMV estático + Copia e Cola) | `src/lib/pix.ts` — o app nunca custodia dinheiro |

### Extensões ao schema original (aprovadas ou necessárias)

- `bet_participants` — quem deve quanto a quem (necessária para grupo e divisão de contas).
- `lobby_events` — feed de avisos automáticos separado do chat.
- Colunas extras: `rooms.room_type`, `bets_expenses.prize_text`.

---

## 4.1 Atualização 0002 — Kitnet humilde, reformas e catálogo novo

| O que mudou | Onde |
|---|---|
| Quarto novo vem com cama, cadeira, tapete pequeno e planta já posicionados | `starter_furniture()` + `handle_new_user` |
| Parede descascada e lâmpada velha piscando até reformar | `rooms.decor`, `RoomWalls.tsx`, `RoomLight.tsx` |
| Reformas: Pintura Simples (5), Texturizada (10), LED (10) — compra uma vez, troca cor/textura à vontade | `buy_item`, `set_decor` |
| Loja em 5 seções com 21 itens | `shop_items.section` |
| Móveis grandes (sofá, estante, mesa 2×1; tapete 2×2) com botão girar | `move_furniture(uid, x, y, rot)` + `furniture_tiles` |
| Óculos de sol, boné com cor, cabelos estilizados (moicano, cacheado, topete) | `Avatar.tsx`, trigger `profiles_before_update` |
| Estante de Troféus (100) também abre o Dashboard; quadro de cortiça fixo continua na parede | `sprites.tsx` (`opensStats`) |
| Itens antigos (Sofá Clássico, TV de Tubo, Fliperama, Jaqueta) apagados, inclusive dos inventários | migração 0002 |

## 4.2 Atualização 0003 — layout dos mockups

| O que mudou | Onde |
|---|---|
| 5 abas: Meu Quarto, Loja do Hotel, Diretório, Apostas & Despesas, Central de Avisos | `TopBar.tsx`, rotas em `src/app/(hotel)` |
| Kitnet 4x4 inicial; Studio 6x6 (50) e Loft 8x8 (150) em Meu Quarto → Inventário | `upgrade_room`, `room_size` |
| +10 Hotel Coins por quitação confirmada, teto 100/semana (validação dupla mantida) | `confirm_payment` |
| Categorias Aposta 1v1, Bolão, Racha, Viagem | `bets_expenses.category` |
| Número do quarto e frase no perfil | `profiles.room_number`, `profiles.bio` |
| Status online/ausente/offline | `PresenceProvider.tsx` (Supabase Realtime Presence) |
| Ranking por vitórias e aviso de Top 3 | `get_ranking`, `declare_winner` |
| Aviso de baratas/dedetização, moedas recebidas | `refresh_cleanliness`, `confirm_payment` |
| Comprovante em PNG, JPG, WEBP ou PDF (até 4 MB) | bucket `proofs` |
| Animações | Framer Motion |

## 4.3 Atualização 0004 — Apostas com aceite, Eventos e Conquistas

| O que mudou | Onde |
|---|---|
| Novo registro com só duas opções: Aposta e Evento | `CreateBetModal.tsx` |
| Aposta: aguardando aceite → ativa quando 100% aceitam; quem recusa sai | `create_bet`, `respond_bet` |
| Criador define vencedor(es) ou empate; perdedores pagam, vencedores dividem | `declare_result`, `declare_draw` |
| Cancelar de comum acordo (antes do aceite, o criador retira) | `cancel_bet` |
| Evento estilo Splitwise: nome obrigatório, convite, sub-despesas, balanço, encerrar gera cobranças | `create_event`, `respond_event`, `add_event_expense`, `close_event`, `EventPage.tsx` |
| Tipo do evento detectado pelo nome (viagem, churrasco, festa, réveillon, carnaval) | `detect_event_kind` |
| Cobranças unificadas (apostas + eventos), mesma validação dupla e +10 moedas | tabela `debts` |
| 11 conquistas que creditam itens no inventário | `achievements`, `check_achievements`, `AchievementsPanel.tsx` |
| Itens de parede e em cima de mesas | `move_furniture`, `prizeSprites.tsx`, `IsoRoom.tsx` |
| Biotipo do avatar: Normal ou Gordo | `Avatar.tsx`, `AvatarEditor.tsx` |
| Despesas antigas (racha/viagem) viraram Eventos encerrados, sem perder cobranças | migração 0004 |

## 5. Estrutura

```
supabase/migrations/0001_bethotel_schema.sql   DDL completo, RLS, RPCs, storage, cron, seed
src/
  middleware.ts                    renova sessão e protege rotas
  lib/supabase/{client,server,middleware}.ts
  lib/iso.ts                       matemática isométrica + pathfinding BFS
  lib/pix.ts · lib/whatsapp.ts · lib/types.ts · lib/constants.ts
  app/(auth)/login · cadastro      autenticação
  app/(hotel)/                     layout com TopBar + Central de Avisos
    page.tsx                       meu quarto
    quarto/[nick]                  visitar amigo
    apostas · diretorio · perfil
  components/room/                 IsoRoom, Avatar, sprites, DirtOverlay, StatsModal, RoomView
  components/lobby/                LobbyPanel (feed + chat), MentionInput (@)
  components/bets/                 CreateBetModal, BetsBoard, BetCard, PixPaymentModal
  components/shop/ShopModal.tsx
  components/profile/              AvatarEditor, ProfileForm
```

## 6. Próximas etapas sugeridas

- Aceite da aposta/conta pelo participante antes de a dívida começar a contar.
- Presença em tempo real (ver amigos andando no mesmo quarto via Realtime Presence).
- Quartos maiores desbloqueáveis com moedas.
- Notificações push/e-mail para menções e dívidas perto de vencer.
- Gerar tipos com `supabase gen types typescript` para tipar as queries ponta a ponta.
