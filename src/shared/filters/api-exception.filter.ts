import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ErrorResponse;
  json(body: unknown): void;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<ErrorResponse>();
    response.setHeader('Cache-Control', 'no-store');
    let status = 500;
    let body: unknown = { error: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.' } };
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const original = exception.getResponse();
      body = typeof original === 'object' && original !== null && 'error' in original && typeof original.error === 'object'
        ? original : { error: { code: status === 404 ? 'NOT_FOUND' : 'INVALID_REQUEST', message: status === 404 ? 'Ruta inexistente.' : 'Solicitud invalida.' } };
    } else {
      const code = exception instanceof QueryFailedError ? (exception.driverError as { code?: string }).code
        : (exception && typeof exception === 'object' && 'code' in exception ? String(exception.code) : '');
      if (code && (/^08/.test(code) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300', '57014'].includes(code))) {
        status = 503;
        body = { error: { code: 'DATA_UNAVAILABLE', message: 'No se pudo consultar el servicio.' } };
      }
    }
    response.status(status).json(body);
  }
}
