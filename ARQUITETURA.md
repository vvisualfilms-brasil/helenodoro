# Arquitetura do Helenodoro

## Escolha da tecnologia

**PWA (Progressive Web App) em JavaScript puro, sem etapa de build.**

- Funciona no celular (instala na tela inicial no iPhone e no Android) e no computador.
- Hospedagem grátis e automática no GitHub Pages.
- Zero dependências: não há `node_modules`, nada para quebrar com atualização.
- Se um dia precisar de recursos que só app nativo tem (ligar o Não Perturbe sozinho no Android), o mesmo código entra no **Capacitor** sem reescrever. Ver [NATIVO.md](NATIVO.md).

## Camadas

```
src/
├── core/        regras puras, sem tela (testadas com node --test)
│   ├── timer.js   máquina de estados do cronômetro (foco, intervalo, pausa)
│   ├── day.js     plano do dia, tags, regra do relatório, relatório diário
│   └── stats.js   datas locais, semana seg–dom, dashboard semanal
├── platform/    tudo que depende do aparelho
│   ├── sound.js   bip agendado com Web Audio
│   └── focus.js   tela cheia, tela acesa (Wake Lock), Não Perturbe, orientação
├── storage.js   salva tudo no localStorage do aparelho
└── app.js       telas e eventos (único arquivo que mexe no HTML)
```

A regra é: **`core/` nunca importa nada de tela**. Assim as regras de negócio podem ser testadas e reaproveitadas num app nativo.

## Como cada requisito foi resolvido

### 1. Timer flexível e bip
- O plano do dia define `blocos`, `minutos de foco` e `minutos de intervalo` (atalhos de 25 a 60 min, ou qualquer valor).
- O timer guarda **a hora de término** (`endAt`), não conta segundos. Se o celular congelar a aba, quando voltar o tempo está certo.
- O bip é **agendado no relógio de áudio** no momento em que o bloco começa. Por isso toca na hora exata mesmo com a aba em segundo plano. Pausar cancela o agendamento; continuar agenda de novo.
- Três sons diferentes: fim de bloco, fim de intervalo e fim do último bloco.

### 2. Modo foco imersivo e giro de tela
- Ao iniciar o bloco: tela preta só com o cronômetro, abas escondidas, tela cheia (Android/computador) e tela sempre acesa (Wake Lock).
- Tocar na tela mostra Pausar/Zerar por 3,5 s e some de novo.
- **Paisagem:** uma regra de CSS (`orientation: landscape` + `pointer: coarse`) esconde tudo menos o cronômetro gigante, tanto no foco quanto no intervalo. O `pointer: coarse` evita que o computador (sempre "paisagem") caia nesse modo.

### 3. Bloqueio de notificações
Limite da plataforma: **nenhum site ou PWA pode silenciar notificações do sistema**, nem no iPhone nem no Android. O app faz o que é possível:
- não emite nenhuma notificação própria;
- mostra um lembrete antes do bloco e um guia passo a passo (Foco do iPhone, Não Perturbe do Android, Foco do Mac/Windows);
- já tem o gancho `dnd.enable()/disable()` em `platform/focus.js`. Se o app rodar dentro do Capacitor com o plugin `HelenodoroDnd`, liga e desliga o Não Perturbe sozinho (Android). No iPhone, a Apple não deixa nenhum app ligar o Foco.

### 4. Tags Videoaula / Questões
- Escolhidas antes do bloco (ou durante o intervalo, para o próximo). A escolha fica salva para o bloco seguinte.
- Cada sessão gravada tem `{ tag, seconds, completed, endedAt }`. O tempo vai direto para a tag.

### 5. Relatório só no fim do dia
Função `canShowDailyReport(day, fase, hoje)` em `src/core/day.js`:
- **falso** durante qualquer bloco ou intervalo;
- **verdadeiro** só quando o dia está encerrado: o último bloco planejado terminou, o usuário tocou em "Encerrar o dia agora", ou o dia já passou.

O relatório mostra horas líquidas (só tempo de foco, pausas não contam), blocos feitos/planejados, % do planejado, divisão Videoaula × Questões e a checklist bloco a bloco.

No dashboard semanal, o dia de hoje aparece trancado (🔒) até ser encerrado, para não antecipar o relatório.

## Dados

Tudo em `localStorage` na chave `helenodoro:v1`:

```json
{
  "settings": { "defaultPlan": { "blocks": 4, "focusMin": 50, "breakMin": 10 }, "volume": 0.8, "fullscreen": true },
  "days": {
    "2026-11-02": {
      "date": "2026-11-02",
      "plan": { "blocks": 4, "focusMin": 50, "breakMin": 10 },
      "sessions": [{ "tag": "video", "seconds": 3000, "completed": true, "endedAt": 1762090000000 }],
      "closedAt": null
    }
  },
  "active": { "date": "2026-11-02", "tag": "questoes", "timer": { "phase": "break", "running": true, "durationMs": 600000, "remainingMs": 600000, "endAt": 1762090600000 } }
}
```

Nada sai do aparelho. Em Ajustes há "Exportar dados (JSON)" como backup.

## Próximos passos sugeridos
- Sincronizar entre aparelhos (login + banco, ex. Supabase/Firebase).
- Intervalo longo a cada N blocos.
- Metas semanais de horas por tag.
- Empacotar com Capacitor para Android (Não Perturbe automático) e publicar na Play Store.
