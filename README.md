# RodaPay V9.4 — código completo + Admin online (preparado, ainda não publicado)

**Novidade:** foi adicionada uma versão independente do painel administrativo em `admin/online/`. O acesso online usa **seu e-mail e senha já existentes no Firebase**; o acesso às operações é liberado **somente ao UID do proprietário** configurado como secret na Cloudflare. O painel local anterior continua como contingência. O aplicativo dos motoristas e o banco de dados **não foram modificados nesta entrega**.

**Publicação do Admin:** leia `admin/online/README-PUBLICACAO.md`. Precisa configurar 2 secrets (`ADMIN_UID` e `FIREBASE_SERVICE_ACCOUNT`) e implantar um segundo Worker com `wrangler.admin.jsonc`. **Nenhuma credencial está embutida no projeto.**

**Publicação do App:** `npm run build:public` e `npx wrangler deploy --config wrangler.jsonc` para o Worker existente `rodapay-app`. **Não substitua o Worker dos motoristas pelo Admin.**

**Testes:** `npm run check` e `npm test`. Estes são testes locais; não substituem homologação no Firebase de produção.

---

## Histórico e documentação V9.3 (antes do Admin online)

Os parágrafos abaixo descrevem a versão anterior, quando **apenas** o Admin local existia. O novo procedimento de acesso online está no guia acima.

# RodaPay — V9.3 | atualização de navegação e publicação

## O que foi corrigido

- A causa da tela preta foi encontrada: o botão central **Corrida** não tem `data-view`, mas recebia o mesmo listener das abas da navegação. Agora só abas com tela real podem ativar `showView`; a volta do modal restaura a tela anterior e a posição de rolagem.
- As escolhas no cadastro rápido exibem **somente os logotipos** de Uber, 99 Pop, InDriver e Particular; os aplicativos personalizados usam seu nome.
- As quatro origens padrão continuam disponíveis para lançar corridas, mas em **Ajustes → Origens** há switches para escolher até 5 origens exibidas nos gráficos. A seleção é salva no Firestore.
- O indicador da jornada usa a altura efetiva da navegação inferior, em vez de altura fixa, com folga e espaço para conteúdo.
- Elementos de **criar conta de teste local** e avisos técnicos foram retirados do login. O cadastro público permanece fechado; usuários são provisionados pelo administrador VORA.
- Corridas, despesas, metas e registros anteriores são mantidos, sem migração ou exclusão automática.

## Publicar sem usar terminal no computador do motorista

O app é estático e utiliza **Firebase Auth/Firestore**. Depois de publicado na Cloudflare, o motorista acessa normalmente pelo link HTTPS, sem instalar Node, executar comandos ou abrir terminais.

Fornecemos **um ZIP GitHub/Cloudflare contendo somente o app público**, separado deste código-fonte privado. Para o endereço já existente `rodapay-app.andreirodriguesbispo.workers.dev`, a opção indicada é conectar um repositório contendo apenas `public/` + `wrangler.jsonc` a esse Worker via **Workers & Pages → Worker → Settings → Builds → Connect to Git**. Revise o nome e o destino antes de aprovar qualquer deploy. O comando de deploy é `npx wrangler deploy`, executado pelo próprio Cloudflare Builds; o usuário final não precisa de terminal.

A administração **não é parte do site público** e requer um serviço local autorizado. No computador da VORA, abrir `INICIAR-ADMIN-PRODUCAO.cmd` inicia o painel; isso não afeta a disponibilidade do app público hospedado. Para usar o admin remotamente sem computador ligado, seria necessário criar uma API administrativa com autenticação forte e hospedagem própria (não incluída).

**Segurança:** antes de publicar as novas regras do Firestore em produção, execute a suíte `npm run test:rules` com os emuladores e confirme isolamento, suspensão e reativação. A suíte JavaScript e a validação estática não substituem testes reais em iPhone/Android com autenticação Firebase. As 19 vulnerabilidades moderadas identificadas anteriormente na cadeia de ferramentas locais ainda exigem revisão; não rode `npm audit fix --force` sem validar versões. Termos e Política de Privacidade exigem revisão jurídica das informações do operador antes da venda.

---

## Recuperação isolada do backup (nova rotina de homologação)

Existe agora o comando `admin/restore-emulator.mjs`. **A gravação só é autorizada nos emuladores Auth/Firestore locais e no projeto separado `demo-rodapay-recovery`.** Nunca restaura sobre dados de produção, nem sobre um emulador que já contenha usuários ou documentos. Não insira o arquivo de backup real no repositório nem em mensagens.

1. Guarde a cópia criptografada e sua senha; instale dependências com `npm install`. Em um terminal exclusivo, execute `npm run emulators:recovery` (não confunda com os emuladores normais `demo-rodapay`). Aguarde Auth 9099 e Firestore 8080.
2. Em outro terminal PowerShell, na pasta `RODAPAY`, configure `$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'` e `$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'`. **Não** defina `RODAPAY_ADMIN_MODE=production` nem `RODAPAY_ADMIN_PROJECT=rodapay-c5490`.
3. Informe a senha sem mostrá-la no console: `$segredo=Read-Host 'Senha do backup' -AsSecureString`; `$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($segredo)`; `$env:RODAPAY_BACKUP_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)`; `[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)`.
4. Informe o caminho do seu arquivo à operação local: `npm run restore:inspect -- "C:\caminho\backup.rodapay-backup"`. Esse comando só lê e valida, sem acessar o Firebase.
5. Para **restaurar somente no emulador isolado e vazio**, use `npm run restore:emulator -- "C:\caminho\backup.rodapay-backup" RESTORE-EMULATOR-ONLY`. Depois execute `npm run restore:check -- "C:\caminho\backup.rodapay-backup"` para conferir contagens e conteúdo dos documentos.
6. Limpe as variáveis de ambiente no PowerShell: `Remove-Item Env:RODAPAY_BACKUP_PASSWORD,Env:FIREBASE_AUTH_EMULATOR_HOST,Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue`. Pare os emuladores quando terminar.

Contas de Authentication são recriadas **desativadas e com senhas novas aleatórias**: o backup V9 preserva identidade e dados, mas não contém senhas nem hashes utilizáveis dos usuários. A restauração em produção não está implementada e **não deve ser simulada por este script**. Uma eventual recuperação real exigirá procedimento próprio para credenciais, revisão da integridade de campos e homologação. O código foi testado com payloads sintéticos; é necessária a execução real nos emuladores com o seu backup para homologar o fluxo.

# RodaPay — implantação e operação (versão 9)

Aplicativo de controle financeiro para motoristas; projeto HTML/CSS/JS, Firebase Authentication e Cloud Firestore. Preserva os lançamentos existentes, a lógica de metas, os registros de jornada, foto de perfil e o cadastro rápido de corridas. Administração separada do site público.

**Estado:** código preparado para implantação e piloto controlado. **Não está publicado nem homologado em produção por esta entrega.** Antes de oferecer a clientes pagantes, execute as etapas de segurança e os testes listados abaixo.

## 1. O que é publicado e o que permanece privado

- `dist-public/`: **somente** site, CSS/JS, imagens e páginas de Termos de Uso e Privacidade. Pode ser enviado ao Cloudflare Pages.
- `admin/`: painel e servidor local da VORA. Nunca hospede esse diretório no Cloudflare Pages ou abra a porta 5601 na internet.
- `firestore.rules`: regras de proteção dos dados de cada motorista. Antes de atualizar a produção, faça backup e teste em ambiente de homologação.
- `scripts/build-public.mjs`: separa os arquivos que podem ir à internet.
- `backups/`: exportações criptografadas locais (não versionar nem distribuir).

## 2. Publicar gratuitamente o aplicativo no Cloudflare Pages

1. Faça cadastro em https://dash.cloudflare.com/ (plano Free).
2. No Windows, instale **Node.js LTS**, abra a pasta `RODAPAY` no VS Code e execute `npm run build:public`.
3. Abra Cloudflare → **Workers & Pages** → **Create application** → **Pages** → **Upload assets / Direct Upload** (o nome pode variar na interface).
4. Defina o nome `rodapay-app` (ou outro disponível). Faça upload **da pasta `dist-public`**, não da pasta inteira RODAPAY. Também pode enviar o ZIP público separado fornecido na entrega.
5. Faça o deploy. Você receberá um endereço gratuito semelhante a `https://rodapay-app.pages.dev` (nome final atribuído pelo Cloudflare).
6. Abra o endereço e confirme login, Termos de Uso e Política de Privacidade. A hospedagem estática do Cloudflare Pages pode ser usada no plano Free dentro das cotas; domínio próprio normalmente exige registrar/comprar domínio.
7. Para atualizar, gere `dist-public` novamente e publique nova versão no mesmo projeto. A integração direta por upload não vira integração Git automaticamente.

**IMPORTANTE:** Pages é apenas hospedagem dos arquivos visuais; autenticação e dados usam o projeto Firebase **rodapay-c5490**. Não hospede `admin/`, `firestore.rules`, credenciais, scripts locais ou ZIP de backup no Pages.

Guia oficial: https://developers.cloudflare.com/pages/get-started/direct-upload/

## 3. Configurar o Firebase real — indispensável

1. Entre em https://console.firebase.google.com e abra o projeto já usado pelo RodaPay, **rodapay-c5490**. Verifique se os dados de produção realmente pertencem a esse projeto.
2. Em **Authentication → Sign-in method**, mantenha habilitado **E-mail/Senha**. Verifique a política de senhas. Não habilite cadastro aberto no site do motorista.
3. Em **Authentication → Settings → Authorized domains**, adicione o domínio `rodapay-app.pages.dev` que o Cloudflare atribuiu (ou seu domínio real). Para este fluxo, use o endereço final, sem `https://`.
4. Em **Authentication → Templates**, revise o nome do aplicativo e as mensagens de recuperação de senha. O template padrão do Firebase pode mostrar o domínio técnico do projeto: personalização completa de domínio/remetente não é garantida gratuitamente.
5. **Antes de alterar as regras do Firestore, salve um backup e teste as regras com pelo menos duas contas no emulador.** A versão nova requer que as contas tenham documento `users/{uid}` provisionado pela VORA e, para usar os dados, aceitem a versão vigente dos documentos.
6. Depois da homologação, atualize **Firestore Database → Rules** com o conteúdo validado de `firestore.rules` e publique. **Não execute o deploy dessas regras sem revisar o efeito em usuários antigos e confirmar a compatibilidade dos registros existentes.**
7. Teste duas contas distintas: cada usuário deve enxergar e modificar somente os próprios lançamentos. Suspenda uma conta no admin e verifique se não consegue mais ler ou gravar dados.

O navegador deve usar autenticação Firebase, **nunca** credenciais de administrador. A API Key do aplicativo web é pública por projeto; credenciais IAM e chaves privadas são secretas e não devem aparecer em JavaScript público.

## 4. Administrar contas reais pela VORA — sem Cloudflare para o admin

A arquitetura inicial mais segura e econômica mantém o **admin no computador autorizado da VORA**, enquanto o aplicativo dos motoristas roda na Cloudflare. Isso não exige VPS, Cloud Run, Tunnel ou pagamento mensal de hospedagem de backend.

**Pré-requisitos:** Node.js LTS; Google Cloud CLI (`gcloud`) instalado; login na conta Google com permissões IAM suficientes no projeto do Firebase (ao menos gestão dos usuários do Firebase Authentication e acesso de leitura/gravação ao Firestore). Não compartilhe essa conta e proteja o computador com senha, atualização e bloqueio de tela.

No PowerShell, na pasta `RODAPAY`:

```powershell
npm install
gcloud auth login
gcloud config set project rodapay-c5490
gcloud auth application-default login
```

Depois, execute `INICIAR-ADMIN-PRODUCAO.cmd`, leia o aviso e informe a confirmação solicitada. O terminal mostrará um código temporário para a sessão. Abra **http://127.0.0.1:5601** apenas no próprio computador. Entre com esse código.

**No painel, você poderá:** criar uma conta de motorista, copiar o link individual para definir senha, listar contas, buscar por e-mail, suspender/reativar, preparar conta antiga sem documento `users/{uid}` e consultar o histórico de alterações. O admin provisiona o documento do usuário; não envia automaticamente os convites por e-mail, portanto copie e envie o link **em canal privado e seguro**. Se o link expirar ou a geração falhar, o usuário pode usar **Esqueci minha senha** no aplicativo hospedado.

**Primeiro acesso do motorista:** abrir o convite → definir senha → abrir o link Cloudflare → entrar → ler os Termos de Uso e a Política de Privacidade → marcar a confirmação → usar a conta. O aceite é registrado no documento privado da conta com a versão dos documentos. Um novo aceite será exigido se a versão mudar.

**Usuários antigos:** se já existe documento privado em `users/{uid}`, o acesso pode continuar após aceitar os documentos. Contas que existam somente no Authentication precisam ser preparadas pelo botão **Preparar acesso**; isso não apaga dados anteriores.

**Cloudflare Tunnel?** Tecnicamente pode conectar um painel local à internet, mas não use nesta versão. Ele exige autenticação remota robusta (Cloudflare Access, validação de tokens no servidor, auditoria, disponibilidade e proteção adicional). Não basta cadastrar um domínio ou criar um Tunnel público para um servidor com privilégios administrativos. Manter o admin local é a opção de custo zero recomendada agora.

## 5. Backup criptografado de produção

A ferramenta `admin/backup.mjs` exporta as contas e coleções cadastradas e criptografa o conteúdo local com AES-256-GCM. Requer as mesmas credenciais IAM de produção e uma senha longa que **não** fica no projeto. O arquivo é salvo em `backups/`.

No **PowerShell**, com as credenciais prontas e após confirmar que está no projeto correto:

```powershell
$env:RODAPAY_ADMIN_MODE = 'production'
$env:RODAPAY_ADMIN_PROJECT = 'rodapay-c5490'
$env:RODAPAY_ADMIN_CONFIRM = 'CONFIRMO-PRODUCAO-RODAPAY'
$senha = Read-Host 'Senha exclusiva do backup (20+ caracteres)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha)
try {
  $env:RODAPAY_BACKUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  npm run backup:production
} finally {
  Remove-Item Env:RODAPAY_BACKUP_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
```

Em outro momento, para conferir um arquivo salvo:

```powershell
$senha = Read-Host 'Senha do backup' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha)
try {
  $env:RODAPAY_BACKUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node admin/backup.mjs verify 'backups/NOME-DO-ARQUIVO.rodapay-backup'
} finally {
  Remove-Item Env:RODAPAY_BACKUP_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
```

Guarde o backup e a senha em lugares diferentes e protegidos. **Isso não substitui um teste real de restauração**, ainda necessário antes de cobrar clientes. O programa não faz restauração automática nem roda em agendamento. Atenção à LGPD e à segurança desses arquivos.

## 6. Documentos jurídicos e atendimento

O aplicativo inclui `termos.html` e `privacidade.html`, apresentados antes do uso e também no login/Configurações. Textos em português simples e comunicação pelo WhatsApp comercial da VORA. Foram escritos como **minutas operacionais**; verifique antes de publicá-los:

- Nome civil ou razão social de quem efetivamente comercializará o serviço, qualificação/identificação aplicável e canal formal de privacidade. Atualmente os textos usam o nome comercial **VORA Labs**, sem inventar CNPJ ou natureza jurídica.
- Serviço vendido, preço real, cobrança, política de cancelamento, suporte, retenção e exclusão de dados, eventuais terceiros e prazos de atendimento.
- Revisão jurídica adequada à LGPD, ao Código de Defesa do Consumidor e ao modelo comercial efetivo.

Mudanças de texto devem acompanhar a atualização de `LEGAL_VERSION` em `legal-policy.mjs` **e** da regra correspondente em `firestore.rules`, com nova homologação antes de publicar. Evite marcar aceite em nome do usuário.

## 7. Testes e publicação controlada

```powershell
npm test
npm run check
npm run build:public
```

**Testes automáticos deste pacote:** 23 verificações de cálculo, horas, validação administrativa, páginas legais e publicação pública, além da sintaxe JavaScript. São testes de código e estrutura; não substituem teste de verdade com Firebase.

**Roteiro manual obrigatório:** acesso do motorista no domínio final; convite real; redefinir e trocar senha; aceite; foto; cadastro rápido de corrida com gorjeta; edição/exclusão; metas; horas e cronômetro (pausar/reabrir); relatórios PDF; duas contas isoladas; bloqueio/reativação; conexão ruim; iPhone Safari e Android Chrome; exportação e restauração de backup. Conferir o console do navegador e erros de interface. Repetir com registros antigos representativos.

## 8. Custos iniciais

- **Cloudflare Pages:** hospedagem de arquivos estáticos disponível no plano Free, com limites publicados; subdomínio `pages.dev` gratuito. Domínio personalizado, se comprado, tem custo externo.
- **Firebase:** Spark pode atender inicialmente com Authentication (e-mail/senha) e cotas gratuitas de Firestore. **Não há uso ilimitado**: a plataforma impõe quotas de leituras/gravações/armazenamento e pode exigir Blaze/infraestrutura paga ao crescer.
- **Admin VORA:** neste modelo funciona localmente sem hospedagem de servidor. Ele só fica disponível enquanto o programa estiver aberto no computador autorizado; isso não afeta o uso do aplicativo público já publicado.

Veja: https://firebase.google.com/pricing/ e https://developers.cloudflare.com/pages/platform/limits/

## 9. Notas gerais do projeto (prioridades reais)

**O que está bem encaminhado:** cadastros de corridas individuais, metas, jornada manual/cronômetro, histórico agrupado, perfil e senha; tema visual premium, separação de contas por UID, painel administrativo local e pacote público separado dos arquivos privilegiados.

**Pendências prioritárias antes de comercializar:**

1. Auditoria do Firebase em produção: testar todas as regras com duas contas; suspender/reativar usuário; impedir auto-provisionamento por contas não liberadas; revisar integridade de documentos legados.
2. Backup + restauração testada, rotina regular de cópias seguras e procedimento de recuperação de incidentes.
3. Resolver limites estruturais: coleção inteira em tempo real pode elevar leituras e custo com centenas/milhares de corridas; mover comprovantes/imagens de Base64 no Firestore para armazenamento adequado quando a escala exigir; verificar limites de documento.
4. Revisar cálculos monetários de ponta a ponta e casos de falhas/repetição, cronômetro entre dispositivos, reconciliação de lançamentos e consistência do PDF.
5. Validar documentos legais com identificação real do operador, regras de cobrança/cancelamento, tratamento de dados e processos de atendimento.
6. Testar em aparelhos físicos e na URL real, monitorar erros, dimensionar custos e formalizar operação de suporte antes de faturar assinaturas.

**Conclusão:** base preparada para **piloto controlado após configurar a conta real e passar nos testes**, não software homologado para venda em massa. A VORA não deve prometer 100% de disponibilidade, ausência de custos ou adequação jurídica automática.

## V9.2 — ajustes de estabilidade e responsividade (13/11/2026)

- Fechamento do cadastro rápido: não bloqueia mais o `body` por `position: fixed`, eliminando uma causa de viewport vazio após fechar modais em celulares. O retorno à tela e a atualização dos indicadores são mantidos. O fluxo deve ser conferido nos navegadores reais antes da atualização pública.
- Gráficos de comparação Mensal e Anual: painéis em coluna única, com rolagem **dentro** do gráfico quando houver meses/semanas demais. Cards de Faturamento e Despesas dividem igualmente a largura, com Saldo abaixo.
- Aplicativos principais sempre disponíveis na nova corrida e no dashboard: Uber, 99 Pop, InDriver e Particular, com imagens da pasta `img`. Aplicativos personalizados continuam permitidos. Os quatro principais aparecem marcados como `Padrão` nos ajustes.
- Categorias de despesas: novas contas recebem as categorias sugeridas; contas antigas podem usar **Configurações → Categorias de saídas → Restaurar** para criar apenas as que estiverem faltando. O aplicativo não recria automaticamente categorias apagadas a cada login.
- Uber no modo escuro: ícones e gráfico usam contraste claro, em vez de preto sobre fundo preto. Os anéis sem dados usam cor neutra.
- Exclusão: o botão vermelho exposto pelo swipe agora recebe o clique real e abre uma confirmação. O histórico financeiro de registros antigos não é alterado quando uma categoria é removida.
- Jornada: o indicador tem dimensões compactas e posição coordenada com a navegação inferior.

### Verificações

Execute `npm test` (31 testes) e `npm run check`. Há também uma verificação **adicional**, que não executa por padrão, para testar leitura própria, isolamento, alterações indevidas e suspensão nas regras do Firestore. Ela deve ser executada somente com o emulador `demo-rodapay` ativo:

```powershell
# Terminal 1
npm run emulators

# Terminal 2 (ambiente local, não produção)
npm run test:rules
```

O teste de regras cria e remove dois usuários **fictícios** e documentos **fictícios** nos emuladores, sem acessar produção. Ele falha com segurança se houver variáveis indicando credenciais ou projeto de produção. **Não execute com o admin de produção aberto na mesma sessão de variáveis.**

**Publicação:** `npm run build:public` reconstrói `dist-public/` com esta versão. Publique somente o conteúdo gerado, nunca o ZIP completo (que contém `admin/`, `firestore.rules` e ferramentas privadas). Nenhuma regra ou documento de produção foi alterado pelo desenvolvimento desta V9.2. Antes de vender: audite as regras e dependências, teste autenticação, alterações e exclusões com emuladores e Safari/Chrome físicos, e valide a compatibilidade dos dados existentes.

**Contas criadas pelo Admin VORA:** recebem `seededDefaults: false`. No primeiro acesso autenticado, o RodaPay preenche as origens, formas de pagamento e categorias sugeridas que faltarem e marca `seededDefaults: true` somente após concluir. Contas antigas sem essa marcação não são reconfiguradas automaticamente. Isso evita reintroduzir categorias que o usuário já excluiu por escolha própria.


## Sessão do motorista — V9.4.5

- O Firebase mantém o login entre visitas no mesmo navegador/dispositivo.
- O RodaPay registra **somente a data/hora da última utilização por UID** no armazenamento local. Ao reabrir ou voltar ao aplicativo após **7 dias inteiros sem uso**, encerra a sessão e pede e-mail e senha novamente. Um novo acesso reinicia a contagem.
- Para usuários já conectados antes desta atualização, a contagem começa na primeira abertura com a V9.4.5.
- Se o motorista **mudar a própria senha** em Ajustes, o app encerra a sessão imediatamente. Alterações de senha feitas em outro dispositivo invalidam tokens de atualização do Firebase e são verificadas ao reabrir, voltar ao primeiro plano ou periodicamente (cerca de 5 minutos), quando houver internet.
- Não armazenamos senhas nem tokens de autenticação manualmente. O controle de 7 dias é por navegador; a segurança real das contas depende do Firebase Authentication e das regras publicadas do Firestore.
- O intervalo de datas de Movimentações usa texto abreviado `DD/MM/AAAA` com um `input type=date` real invisível e acessível para abrir o calendário nativo do iPhone. Em telas estreitas os campos ficam empilhados.
