import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export interface RespostaErro {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

interface ErroDriverMysql {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

const NOMES_STATUS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/** Erros do MySQL que têm causa conhecida e mensagem útil para o cliente. */
function traduzirErroMysql(erro: ErroDriverMysql): { status: number; mensagem: string } | null {
  switch (erro.code) {
    case 'ER_DUP_ENTRY':
      return { status: HttpStatus.CONFLICT, mensagem: 'Já existe um registro com estes dados' };
    case 'ER_DATA_TOO_LONG':
      return { status: HttpStatus.BAD_REQUEST, mensagem: 'Um dos campos excede o tamanho permitido pelo banco' };
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return { status: HttpStatus.BAD_REQUEST, mensagem: 'Um dos valores informados é inválido para o banco' };
    case 'ER_LOCK_WAIT_TIMEOUT':
    case 'ER_LOCK_DEADLOCK':
      return {
        status: HttpStatus.CONFLICT,
        mensagem: 'Outra operação está usando estes registros. Tente novamente.',
      };
    default:
      return null;
  }
}

/**
 * Filtro global: toda resposta de erro tem o mesmo formato
 * { statusCode, error, message, path, timestamp }.
 * Erros inesperados viram 500 sem expor detalhes internos (que vão para o log).
 */
@Catch()
export class ExcecoesFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excecoes');

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const resposta = contexto.getResponse<Response>();
    const requisicao = contexto.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensagem: string | string[] = 'Erro interno no servidor';

    if (excecao instanceof HttpException) {
      status = excecao.getStatus();
      const corpo = excecao.getResponse();
      if (typeof corpo === 'string') {
        mensagem = corpo;
      } else if (corpo && typeof corpo === 'object' && 'message' in corpo) {
        mensagem = (corpo as { message: string | string[] }).message;
      } else {
        mensagem = excecao.message;
      }
    } else if (excecao instanceof QueryFailedError) {
      const driver = excecao.driverError as ErroDriverMysql;
      const traduzido = traduzirErroMysql(driver);
      if (traduzido) {
        status = traduzido.status;
        mensagem = traduzido.mensagem;
        this.logger.warn(`${driver.code}: ${driver.sqlMessage ?? excecao.message}`);
      } else {
        if (driver.code === 'ER_BAD_FIELD_ERROR' || driver.code === 'ER_NO_SUCH_TABLE') {
          mensagem = 'Estrutura do banco desatualizada. Execute as migrations da API.';
        }
        this.logger.error(`${driver.code ?? 'SQL'}: ${driver.sqlMessage ?? excecao.message}`, excecao.stack);
      }
    } else if (this.ehErroDeConexao(excecao)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      mensagem = 'Banco de dados indisponível';
      this.logger.error('Falha de conexão com o banco de dados', (excecao as Error).stack);
    } else {
      this.logger.error(
        `Erro não tratado em ${requisicao.method} ${requisicao.url}`,
        excecao instanceof Error ? excecao.stack : String(excecao),
      );
    }

    const corpo: RespostaErro = {
      statusCode: status,
      error: NOMES_STATUS[status] ?? 'Error',
      message: mensagem,
      path: requisicao.originalUrl ?? requisicao.url,
      timestamp: new Date().toISOString(),
    };
    resposta.status(status).json(corpo);
  }

  private ehErroDeConexao(excecao: unknown): boolean {
    const codigo = (excecao as { code?: string } | null)?.code;
    return ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ER_ACCESS_DENIED_ERROR'].includes(
      codigo ?? '',
    );
  }
}
