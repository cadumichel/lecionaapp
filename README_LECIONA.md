# Leciona - Gestão Escolar 📚

Sistema completo de gestão para professores, com recursos para organização de aulas, turmas, avaliações e sincronização em nuvem.

## 🚀 Versão 3.0.0 - Melhorias Implementadas

### ✨ Novas Funcionalidades

- **Sincronização Completa com Google Drive**: Implementação OAuth 2.0 com autenticação segura, backup e restauração de dados
- **Error Boundary**: Tratamento robusto de erros com interface amigável
- **Lazy Loading**: Carregamento otimizado de componentes para melhor performance
- **Service Worker Melhorado**: Estratégias de cache inteligentes para melhor funcionamento offline
- **Responsividade Aprimorada**: Layout adaptativo com melhor densidade de informação em mobile

### 🔧 Melhorias Técnicas

- Hooks customizados (`useGoogleDrive`, `useResponsive`)
- Componentização melhorada com `GoogleDriveSync`
- Otimizações de performance com React.lazy e Suspense
- Acessibilidade melhorada (remoção de restrição de zoom)

## 📋 Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Conta Google para sincronização em nuvem (opcional)

## 🔑 Configuração do Google Drive API

Para habilitar a sincronização com Google Drive:

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google Drive
4. Vá em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth"
5. Configure a tela de consentimento OAuth
6. Adicione os domínios autorizados:
   - `http://localhost:5173` (desenvolvimento)
   - Seu domínio de produção
7. Após criar, copie o **Client ID** e **API Key**
8. Cole as credenciais no arquivo `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=sua-api-key-aqui
```

## 🛠️ Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/leciona.git
cd leciona

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Edite o .env.local com suas credenciais do Google

# Inicie o servidor de desenvolvimento
npm run dev
```

## 📦 Build para Produção

```bash
# Gerar build otimizado
npm run build

# Preview do build
npm run preview
```

## 🎨 Funcionalidades

### Gestão de Escolas
- Cadastro de múltiplas escolas
- Definição de turnos e horários
- Gestão de disciplinas e turmas

### Diário de Classe
- Registro de conteúdos ministrados
- Acompanhamento de tarefas
- Anotações por aula

### Avaliações
- Calendário de provas e trabalhos
- Vinculação com turmas específicas
- Notificações de datas importantes

### Agenda
- Visualização de eventos escolares
- Feriados e recessos
- Calendário acadêmico personalizável

### Lembretes
- Sistema de lembretes com categorias
- Notificações programadas
- Vinculação com escolas/turmas/alunos

### Sincronização em Nuvem
- Backup automático no Google Drive
- Restauração de dados entre dispositivos
- Dados armazenados de forma segura

### Personalização
- 9 temas de cores
- Modo escuro
- Citações motivacionais diárias

## 🏗️ Estrutura do Projeto

```
leciona/
├── components/          # Componentes React
│   ├── ErrorBoundary.tsx
│   ├── GoogleDriveSync.tsx
│   ├── Dashboard.tsx
│   ├── LessonLogger.tsx
│   └── ...
├── hooks/              # Hooks customizados
│   ├── useGoogleDrive.ts
│   └── useResponsive.ts
├── config/             # Configurações
│   └── google.ts
├── types.ts            # Definições TypeScript
├── utils.ts            # Funções utilitárias
├── constants.ts        # Constantes
├── App.tsx             # Componente principal
├── index.tsx           # Entry point
└── service-worker.js   # Service Worker PWA
```

## 📱 PWA (Progressive Web App)

O Leciona pode ser instalado como aplicativo no seu dispositivo:

**Android:**
1. Abra o app no Chrome
2. Toque no menu (⋮)
3. Selecione "Adicionar à tela inicial"

**iOS:**
1. Abra o app no Safari
2. Toque no ícone de compartilhar
3. Selecione "Adicionar à Tela de Início"

**Desktop:**
1. Acesse o app no Chrome
2. Clique no ícone de instalação na barra de endereço
3. Confirme a instalação

## 🐛 Tratamento de Erros

O aplicativo agora possui Error Boundary que captura erros inesperados e exibe uma interface amigável, permitindo:
- Recarregar a página
- Tentar novamente a operação
- Ver detalhes do erro (em desenvolvimento)

## 🔒 Segurança e Privacidade

- Dados armazenados localmente no navegador (localStorage)
- Sincronização opcional com Google Drive usando OAuth 2.0
- Nenhum dado é enviado para servidores externos sem consentimento
- Credenciais API nunca são hardcoded no código

## 🚧 Roadmap

- [ ] Gráficos e estatísticas avançadas
- [ ] Export para PDF com relatórios customizados
- [ ] Sistema de notificações push
- [ ] Modo offline robusto com sincronização em background
- [ ] Integração com Google Calendar
- [ ] Temas customizáveis pelo usuário

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 👨‍💻 Autor

**Cadu Michel**

Design & Desenvolvimento

---

**Versão**: 3.0.0  
**Última atualização**: Janeiro 2026
