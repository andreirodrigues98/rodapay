# RodaPay Admin — acesso online com e-mail e senha

Este é o **Admin online**; o painel `admin/server.mjs` continua existindo apenas como ferramenta **local de contingência**. O app dos motoristas permanece no Worker `rodapay-app` e **não recebe nenhuma alteração** para ativar o Admin.

## O que foi implementado

- Tela de login com **e-mail e senha já cadastrados no Firebase Authentication**; não cria nem altera a senha do proprietário.
- API própria no Worker `rodapay-admin`; valida a assinatura, emissor, público e expiração do ID Token Firebase; confere o `ADMIN_UID` no servidor e verifica se a conta está ativa/não revogada.
- Ações administrativas por Google OAuth de conta de serviço **somente no Worker**, nunca no navegador.
- Criação de motorista, envio de e-mail de redefinição de senha, listagem, preparação de conta, suspensão, reativação e leitura de auditoria.
- Não permite suspender a própria conta administradora. A atualização do campo `active` nunca substitui os demais campos do motorista.
- Código fonte e assets administrativos separados: Worker publica somente `admin/online/public` (HTML + JS). O app público publica somente `dist-public`.

## 1. Preparação sem afetar clientes existentes

1. Mantenha o Worker `rodapay-app` existente em produção. **Não substitua o deploy dele pelo Admin**.
2. No Firebase Console → **Authentication → Users**, encontre **sua conta existente** e copie exatamente o campo **User UID**. Não precisa cadastrar outro e-mail ou senha.
3. No Google Cloud Console, selecione o projeto **rodapay-c5490** e crie uma conta de serviço **exclusiva para o Admin**, com apenas as permissões necessárias para gerenciar usuários do Firebase Authentication e ler/escrever os documentos Firestore. Em geral são os papéis **Firebase Authentication Admin** e **Cloud Datastore User**. Revise permissões no IAM antes da liberação.
4. Crie uma chave JSON dessa conta de serviço **apenas se não houver um método mais seguro disponível na sua infraestrutura**. Ela é um segredo sensível. Nunca adicione esse JSON ao projeto, ao ZIP, ao GitHub ou a mensagens. Copie-o somente para o secret do Worker e guarde-o de forma segura fora do código.

## 2. Publicação separada na Cloudflare

Crie um Worker **novo** `rodapay-admin`. No Cloudflare Dashboard → Worker `rodapay-admin` → **Settings → Variables and Secrets**, configure:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `ADMIN_UID` | User UID da sua conta existente no Firebase Authentication |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | Conteúdo JSON **completo** da conta de serviço Google, nunca um caminho de arquivo |

`FIREBASE_PROJECT_ID` já está definido no `wrangler.admin.jsonc` como `rodapay-c5490` (identificador público).

Para publicar pelo GitHub, conecte o mesmo repositório a um **segundo Worker** e use:

- **Root directory:** `/`
- **Build command:** `None` (não precisa compilar o app dos motoristas para o Admin)
- **Deploy command:** `npx wrangler deploy --config wrangler.admin.jsonc`
- **Branch:** `main`

Para publicar diretamente pelo computador autorizado, execute `npm run deploy:admin` na raiz do projeto após configurar os secrets no dashboard (e autenticar o Wrangler na Cloudflare). O usuário administrador **nunca precisa executar código para entrar no painel depois de publicado**.

O endereço previsto será `https://rodapay-admin.<SEU-SUBDOMINIO>.workers.dev` (o link só existe após criar o Worker). A Cloudflare pode pedir confirmação de configurações extras conforme o plano.

## 3. Teste antes do uso real

1. Abra o endereço do Worker Admin em HTTPS; deve aparecer a tela de **e-mail e senha**.
2. Entre com o mesmo login do Firebase Authentication já autorizado como `ADMIN_UID`.
3. Confira a lista, sem suspender contas reais no teste inicial.
4. Em janela privativa, confirme que sem login não há acesso às APIs; uma conta de motorista comum deve receber **Acesso negado**.
5. Faça operações de criação, suspensão e reativação primeiro em **conta de teste controlada**, sempre verificando que o histórico e as metas continuam preservados.
6. Valide o aplicativo dos motoristas em `https://rodapay-app.andreirodriguesbispo.workers.dev` separadamente.

Para conferir o código sem acessar produção: `npm test` (inclui testes isolados da API do Admin e do app). **Os testes automatizados usam dados fictícios e não autenticam contra seu Firebase real.** A publicação online ainda precisa de configuração do serviço e verificação real.

## Notas de segurança

- O login é sem **código temporário**, mas o Firebase pode aplicar mecanismos próprios contra abuso ou recuperação de senha.
- As credenciais de serviço ficam em **secrets** do Worker, não no JavaScript do navegador e não neste ZIP.
- A checagem de permissão é feita novamente em **cada requisição da API**, não somente quando carrega a página.
- Se o repositório estiver público, o código-fonte do Admin poderá ser lido. **Não há chaves privadas nele**, mas recomenda-se repositório privado.
- O uso de uma chave JSON de service account exige política de armazenamento, rotação e IAM restrito. Não considerar produção homologada sem teste real.
