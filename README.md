# 🍅 Helenodoro

Pomodoro de estudos feito para imersão: blocos de foco no tamanho que você quiser, tela limpa só com o cronômetro, tags **🖥️ Videoaula** e **📝 Questões**, e um relatório do dia que só aparece quando o último bloco termina.

Funciona no celular (instala na tela inicial) e no computador. Sem login, sem servidor: os dados ficam no seu aparelho.

## Funcionalidades

| | |
|---|---|
| ⏱️ **Timer flexível** | Plano do dia com nº de blocos, minutos de foco e de intervalo (atalhos 25–60 min). Iniciar, pausar, zerar. |
| 🔔 **Bip na hora exata** | Sons diferentes para fim de bloco, fim de intervalo e fim do dia. Toca mesmo com a aba em segundo plano. |
| 🖤 **Modo foco** | Ao iniciar, só o cronômetro na tela, tela cheia e tela sempre acesa. Toque para ver os controles. |
| 📱 **Giro de tela** | Virou o celular de lado: cronômetro gigante em tela cheia, nada mais. |
| 🔕 **Notificações** | O app não envia nenhuma e guia para ligar o Foco/Não Perturbe. Na versão Android nativa, liga sozinho. |
| 🏷️ **Tags** | Videoaula (teoria) ou Questões (prática) em cada bloco; o tempo vai para a tag escolhida. |
| 📋 **Relatório do dia** | Trancado durante blocos e intervalos. Abre ao fim do último bloco: horas líquidas, planejado × feito, % por tag. |
| 📊 **Semana** | Barras por dia (seg–dom), total, média, dias estudados e divisão por tag. Toque num dia para ver o relatório dele. |

## Estrutura

```
helenodoro/
├── index.html
├── styles.css
├── manifest.webmanifest      (PWA: nome, ícone, cores)
├── sw.js                     (funciona offline)
├── tomato.svg, icon-*.png, apple-touch-icon.png   (ícone de tomate)
├── app.js                    (telas e eventos)
├── storage.js                (salvar no aparelho)
├── timer.js, day.js, stats.js   (regras de negócio puras, sem tela)
├── sound.js, focus.js        (som, tela cheia, Não Perturbe)
├── core.test.js              (testes das regras)
├── ARQUITETURA.md            (decisões e como cada requisito foi feito)
├── NATIVO.md                 (Android com Não Perturbe automático)
└── package.json
```

Tudo numa pasta só, de propósito: dá para subir pelo site do GitHub de qualquer jeito (arrastando ou escolhendo os arquivos) e o GitHub Pages publica direto da branch `main`.

## Rodar no computador

Precisa só do Python 3 (já vem no Mac) para servir os arquivos:

```bash
npm start
```

Abra http://localhost:8080. Para testar no celular na mesma rede Wi‑Fi, use o IP do computador (ex. `http://192.168.0.10:8080`).

## Testes

```bash
npm test
```

Testa o timer (pausa não conta), a regra do relatório (trancado em blocos e intervalos, libera no último bloco), as tags e o dashboard da semana.

## Publicar no GitHub

### 1. Criar o repositório

Em https://github.com/new crie um repositório chamado `helenodoro`, **público** (o Pages grátis exige) e sem README.

### 2. Subir os arquivos

Na página do repositório novo, clique em **uploading an existing file**. Selecione tudo que está dentro da pasta `helenodoro` no Finder (Cmd+A) e arraste para a página. Pastas vão junto. Clique em **Commit changes**.

> O `.nojekyll` é um arquivo oculto e o Finder não arrasta. Não faz falta: o app funciona sem ele.

Quem preferir terminal:

```bash
git remote add origin https://github.com/SEU-USUARIO/helenodoro.git
```

```bash
git push -u origin main
```

### 3. Ligar o GitHub Pages

No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.

Em 1–2 minutos o app fica em:

```
https://SEU-USUARIO.github.io/helenodoro/
```

### 4. Instalar no celular

- **iPhone (Safari):** abrir o link → Compartilhar → **Adicionar à Tela de Início**.
- **Android (Chrome):** abrir o link → menu ⋮ → **Instalar app**.

### Fluxo de trabalho sugerido

- `main` = versão no ar. Mudanças grandes em outra branch (`git switch -c nova-funcao`) e Pull Request.
- Mensagens de commit curtas no imperativo: "Adiciona intervalo longo", "Corrige bip no iPhone".
- Versões com tag: `git tag v1.0.0 && git push --tags`.
- Para atualizar: suba os arquivos alterados do mesmo jeito (upload) ou com `git push`. O Pages republica sozinho.
- Ao mudar arquivos do app, aumente `CACHE` em `sw.js` (`helenodoro-v2`…) para os celulares pegarem a versão nova.

## Limites conhecidos

- **Notificações:** sites/PWAs não podem silenciar o sistema. Ver [NATIVO.md](NATIVO.md) para o Android nativo.
- **iPhone com tela bloqueada:** o iOS pausa o áudio de apps web. Mantenha a tela acesa (o app já pede isso) ou o bip toca ao desbloquear.
- **Tela cheia no iPhone:** o Safari não deixa sites entrarem em tela cheia; instalado na tela inicial, o app já abre sem barras.
- Os dados ficam só no aparelho/navegador onde você usa. Use "Exportar dados" em Ajustes como backup.
