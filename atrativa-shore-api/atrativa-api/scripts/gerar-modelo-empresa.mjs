import { readFileSync, writeFileSync } from 'node:fs';

const [origem, destino = 'src/tenancy/modelo/estrutura-empresa.ts'] = process.argv.slice(2);
if (!origem) {
  console.error('Uso: node scripts/gerar-modelo-empresa.mjs <dump-mysql8.sql> [destino.ts]');
  process.exit(1);
}

const TABELAS_COM_DADOS_BASE = new Set(['cad_plano_de_contas', 'eti_config', 'eti_config_campo']);
const texto = readFileSync(origem, 'latin1').replace(/\r\n/g, '\n');

const tabelas = [];
for (const bloco of texto.matchAll(/^CREATE TABLE (\w+) \([\s\S]*?^\) ENGINE=\w+[^;]*;/gm)) {
  tabelas.push({ nome: bloco[1], sql: bloco[0].replace(/;$/, '') });
}

const dados = [];
for (const linha of texto.matchAll(/^INSERT INTO (\w+) VALUES [\s\S]*?\);$/gm)) {
  if (TABELAS_COM_DADOS_BASE.has(linha[1])) dados.push(linha[0].replace(/;$/, ''));
}
const perfil = texto.match(/^INSERT INTO cad_login_perfil VALUES \((1,'[^']*','[^']*')\)/m);
if (perfil) dados.push(`INSERT INTO cad_login_perfil VALUES (${perfil[1]})`);

if (tabelas.length === 0) {
  console.error('Nenhum CREATE TABLE encontrado no arquivo');
  process.exit(1);
}

const saida = `export const TABELAS_EMPRESA: string[] = ${JSON.stringify(tabelas.map((t) => t.sql), null, 2)};

export const DADOS_BASE_EMPRESA: string[] = ${JSON.stringify(dados, null, 2)};
`;
writeFileSync(destino, saida, 'utf8');
console.log(`${tabelas.length} tabelas e ${dados.length} inserções base → ${destino}`);
console.log(tabelas.map((t) => t.nome).join(', '));
