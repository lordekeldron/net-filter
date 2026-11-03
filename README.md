# Net Filter

**Filtro de Internet para bloquear conteúdo adulto.**

Extensão de navegador moderna (Manifest V3) que bloqueia sites adultos, força SafeSearch e permite personalização da lista de bloqueio.

## Funcionalidades

- Bloqueio de milhares de domínios adultos conhecidos
- Lista personalizável (adicione ou remova sites)
- SafeSearch forçado no Google, Bing, DuckDuckGo e Yahoo
- Página de bloqueio personalizada
- Proteção opcional com senha (dificulta desativação impulsiva)
- Interface em português
- 100% local — sem envio de dados para servidores

## Instalação (modo desenvolvedor)

### Chrome / Edge / Brave

1. Abra `chrome://extensions` (ou `edge://extensions`)
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta deste repositório

### Firefox

1. Abra `about:debugging#/runtime/this-firefox`
2. Clique em **Carregar extensão temporária**
3. Selecione o arquivo `manifest.json`

## Como usar

1. Clique no ícone da extensão
2. Ative/desative o filtro
3. Adicione sites personalizados na lista
4. (Opcional) Defina uma senha nas configurações para proteger o filtro

## Estrutura do projeto

```
net-filter/
├── manifest.json
├── background.js          # Service worker + regras de bloqueio
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── blocked/
│   └── blocked.html       # Página exibida quando o site é bloqueado
├── rules/
│   └── adult-domains.json # Lista base de domínios
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Aviso importante

Nenhum filtro é 100% perfeito. Novos sites aparecem constantemente. A lista de bloqueio deve ser atualizada periodicamente. Esta ferramenta é um auxílio, não uma solução absoluta.

## Licença

MIT
