import { interpretarInstrucao, lerEventosSql, separarInstrucoes, type EventoSql } from './leitor-sql.js';

async function eventos(texto: string, tamanho = texto.length): Promise<EventoSql[]> {
  const partes: string[] = [];
  for (let i = 0; i < texto.length; i += tamanho) partes.push(texto.slice(i, i + tamanho));
  const lidos: EventoSql[] = [];
  for await (const evento of lerEventosSql(partes)) lidos.push(evento);
  return lidos;
}

const DUMP_ANTIGO = `-- MySQL dump 8.19
--
-- Host: localhost    Database: store4
---------------------------------------------------------
-- Server version	4.0.1-alpha-max

DROP TABLE IF EXISTS cad_login;
CREATE TABLE cad_login (
  id int(8) unsigned NOT NULL auto_increment,
  login varchar(15) default NULL,
  senha varchar(6) default NULL,
  id_perfil int(8) unsigned NOT NULL default '1',
  autoriza char(1) default NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY id (id),
  UNIQUE KEY in2 (login),
  KEY id_2 (id)
) TYPE=MyISAM;

/*!40000 ALTER TABLE cad_login DISABLE KEYS */;
LOCK TABLES cad_login WRITE;
INSERT INTO cad_login VALUES (1,'ADMIN','123456',1,'S'),(2,'O''BRIEN; DROP TABLE x','a\\'b\\\\c',2,NULL);
/*!40000 ALTER TABLE cad_login ENABLE KEYS */;
UNLOCK TABLES;
# comentario com ; ponto e virgula
INSERT INTO cad_empresa VALUES (1,'LOJA -- NAO E COMENTARIO','AVARÉ',001,-2.50,0x00FF,X'6162',NULL);
`;

describe('leitor de dumps SQL', () => {
  it('separa instruções ignorando comentários e ponto e vírgula dentro de textos', async () => {
    const instrucoes: string[] = [];
    for await (const i of separarInstrucoes([DUMP_ANTIGO])) instrucoes.push(i);
    expect(instrucoes.map((i) => i.split(/\s+/)[0])).toEqual(['DROP', 'CREATE', 'LOCK', 'INSERT', 'UNLOCK', 'INSERT']);
  });

  it('lê CREATE TABLE do MySQL 4 e INSERT sem lista de colunas, com escapes', async () => {
    const lidos = await eventos(DUMP_ANTIGO);
    expect(lidos[0]).toEqual({ tipo: 'criar', tabela: 'cad_login', colunas: ['id', 'login', 'senha', 'id_perfil', 'autoriza'] });
    expect(lidos[1]).toEqual({
      tipo: 'inserir',
      tabela: 'cad_login',
      colunas: null,
      linhas: [
        ['1', 'ADMIN', '123456', '1', 'S'],
        ['2', "O'BRIEN; DROP TABLE x", "a'b\\c", '2', null],
      ],
    });
    expect(lidos[2]).toEqual({
      tipo: 'inserir',
      tabela: 'cad_empresa',
      colunas: null,
      linhas: [['1', 'LOJA -- NAO E COMENTARIO', 'AVARÉ', '001', '-2.50', Buffer.from([0, 255]), Buffer.from('ab'), null]],
    });
  });

  it('dá o mesmo resultado com o arquivo lido em pedaços de qualquer tamanho', async () => {
    const inteiro = await eventos(DUMP_ANTIGO);
    for (const tamanho of [1, 2, 3, 7, 64]) expect(await eventos(DUMP_ANTIGO, tamanho)).toEqual(inteiro);
  });

  it('lê o formato do mysqldump atual com crases, banco qualificado e lista de colunas', () => {
    expect(
      interpretarInstrucao(
        'CREATE TABLE IF NOT EXISTS `mv_vendas` (\n  `id` int NOT NULL,\n  `key` varchar(3),\n  `vr_pix` decimal(10,2) DEFAULT NULL COMMENT \'Pix, (novo)\',\n  PRIMARY KEY (`id`),\n  KEY `ix` (`key`)\n) ENGINE=InnoDB',
      ),
    ).toEqual({ tipo: 'criar', tabela: 'mv_vendas', colunas: ['id', 'key', 'vr_pix'] });
    expect(interpretarInstrucao("REPLACE INTO `loja`.`cad_produtos` (`id`, `nome`) VALUES (1,_utf8mb4'Lençol'),(2,'x')")).toEqual({
      tipo: 'inserir',
      tabela: 'cad_produtos',
      colunas: ['id', 'nome'],
      linhas: [
        ['1', 'Lençol'],
        ['2', 'x'],
      ],
    });
  });

  it('ignora instruções que não são dados e não executa nada', () => {
    for (const instrucao of ['DROP DATABASE outra', 'USE outra', 'SET FOREIGN_KEY_CHECKS=0', 'UPDATE cad_login SET senha = 1', 'GRANT ALL ON *.* TO x']) {
      expect(interpretarInstrucao(instrucao)).toBeNull();
    }
  });

  it('recusa valores que não são literais', () => {
    expect(() => interpretarInstrucao('INSERT INTO t VALUES (1, SLEEP(10))')).toThrow(/Valor não reconhecido/);
    expect(() => interpretarInstrucao("INSERT INTO t VALUES (1, 'sem fim")).toThrow(/aspas/);
  });
});
