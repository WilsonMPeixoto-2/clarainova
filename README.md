# Central de Inteligência SEI!RIO

Sistema de chat RAG (Retrieval-Augmented Generation) independente, especializado em fornecer assistência sobre o Sistema Eletrônico de Informações (SEI) e procedimentos de prestação de contas do SDP.

## 🚀 Características

- **Chat RAG com Gemini 3 Pro**: Respostas baseadas em inteligência artificial com fontes verificáveis
- **Busca Web Integrada**: Complementa respostas com informações de fontes governamentais externas
- **Base de Conhecimento**: Sistema indexado com 5 PDFs de documentação oficial do SEI
- **Interface Pública**: Acesso sem necessidade de login ou autenticação
- **Histórico de Conversas**: Mantém contexto das conversas para melhor experiência

## 📋 Pré-requisitos

- Node.js 18+ ou npm
- MySQL 8+ ou MariaDB
- Chave de API do Google Gemini (Google AI Studio)

## 🔧 Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/WilsonMPeixoto-2/central-inteligencia-sei.git
   cd central-inteligencia-sei
   ```

2. **Instale as dependências**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure as variáveis de ambiente**
   
   Copie o arquivo de exemplo e configure suas variáveis:
   ```bash
   cp .env.example .env
   ```
   
   Edite o arquivo `.env` e configure:
   - `DATABASE_URL`: String de conexão com o MySQL
   - `GOOGLE_GENERATIVE_AI_API_KEY`: Sua chave de API do Google Gemini
   - `JWT_SECRET`: Uma string secreta aleatória para sessões
   - `PORT`: Porta do servidor (padrão: 3000)

4. **Configure o banco de dados**
   ```bash
   npm run db:push
   ```

5. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

O aplicativo estará disponível em `http://localhost:3000`

## 🏗️ Build para Produção

```bash
npm run build
npm start
```

## 🌐 Deploy no Vercel

1. **Instale o Vercel CLI (opcional)**
   ```bash
   npm i -g vercel
   ```

2. **Configure as variáveis de ambiente no Vercel**
   - Acesse o dashboard do Vercel
   - Adicione as mesmas variáveis do arquivo `.env` na seção de Environment Variables

3. **Deploy**
   ```bash
   vercel --prod
   ```

Ou simplesmente conecte o repositório GitHub ao Vercel para deploy automático.

## 📚 Base de Conhecimento

Os documentos indexados incluem:

1. **Manual do Usuário SEI 4.0** - Guia completo de operações no sistema
2. **Cartilha do Usuário SEI** - Orientações práticas
3. **Manual de Prestação de Contas SDP** - Procedimentos para prestação de contas
4. **Guia Orientador SDP** - Circular E/SUBG/CPGOF Nº 06/2024
5. **Documentação adicional do SEI**

Para adicionar novos documentos à base de conhecimento:

1. Adicione os arquivos PDF na pasta `knowledge-base/`
2. Reinicie o servidor para reindexação automática

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Compila o projeto para produção
- `npm start` - Inicia o servidor em modo produção
- `npm run check` - Verifica tipos TypeScript
- `npm run format` - Formata o código com Prettier
- `npm test` - Executa testes
- `npm run db:push` - Sincroniza schema do banco de dados

## 📁 Estrutura do Projeto

```
.
├── client/              # Frontend React
│   ├── src/
│   │   ├── pages/      # Páginas da aplicação
│   │   ├── components/ # Componentes React
│   │   └── lib/        # Utilitários e configurações
├── server/             # Backend Node.js
│   ├── _core/         # Funcionalidades core do servidor
│   ├── routers.ts     # Rotas tRPC
│   ├── rag.ts         # Sistema RAG
│   └── db.ts          # Camada de banco de dados
├── shared/            # Código compartilhado
├── knowledge-base/    # PDFs da base de conhecimento
├── drizzle/          # Schemas e migrations do banco
└── dist/             # Build de produção (gerado)
```

## 🔒 Segurança

- ⚠️ **Importante**: Não commite o arquivo `.env` com credenciais reais
- Use sempre variáveis de ambiente para informações sensíveis
- O `JWT_SECRET` deve ser uma string aleatória forte em produção

## 📝 Notas de Desenvolvimento

Este projeto foi adaptado para funcionar independentemente do sistema Manus, mantendo apenas as funcionalidades essenciais:

- ✅ Removido sistema de autenticação OAuth
- ✅ Removida integração com Google Maps
- ✅ Removido vite-plugin-manus-runtime
- ✅ Simplificado para acesso público
- ✅ Mantido sistema RAG completo
- ✅ Mantida busca web integrada

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 👥 Autores

- 4ª CRE - Coordenadoria Regional de Educação

## 📞 Suporte

Para questões e suporte, abra uma issue no repositório GitHub.

---

**Aviso**: Este é um projeto em desenvolvimento, em fase de validação e aprimoramento. Não constitui canal oficial do Município do Rio de Janeiro ou do sistema SEI!RIO.
