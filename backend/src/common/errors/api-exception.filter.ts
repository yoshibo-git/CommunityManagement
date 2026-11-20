import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ServerResponse } from 'node:http';

const errors: Record<number, [string, string]> = {
  400: ['VALIDATION_FAILED', 'Dữ liệu không hợp lệ.'],
  401: ['AUTH_REQUIRED', 'Bạn cần đăng nhập.'],
  403: ['FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'],
  404: ['RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên.'],
  405: ['METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.'],
  409: ['STATE_CONFLICT', 'Dữ liệu đã thay đổi hoặc bị trùng lặp.'],
  413: ['PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Định dạng dữ liệu không được hỗ trợ.'],
  422: ['PROOF_INVALID', 'Thông tin xác minh không hợp lệ.'],
  429: ['RATE_LIMITED', 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'],
  503: ['DEPENDENCY_UNAVAILABLE', 'Dịch vụ tạm thời không khả dụng.'],
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  constructor(private readonly adapter: HttpServer) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<ServerResponse>();
    if (this.adapter.isHeadersSent(response)) {
      this.adapter.end(response);
      return;
    }
    const requestId = String(response.getHeader('X-Request-ID') ?? randomUUID());
    response.setHeader('X-Request-ID', requestId);
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    let [code, message] = errors[status] ?? ['INTERNAL_SERVER_ERROR', 'Đã xảy ra lỗi hệ thống.'];
    let details: unknown;
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body &&
          typeof body.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(body.code)) {
        code = body.code;
        if (status < 500) {
          if ('message' in body && typeof body.message === 'string') message = body.message;
          if ('details' in body) details = body.details;
        }
      }
    }
    if (status >= 500) this.logger.error(JSON.stringify({ requestId, status, code }));
    this.adapter.reply(response, { code, message, requestId, ...(details === undefined ? {} : { details }) }, status);
  }
}
