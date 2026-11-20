import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'API Quản lý hoạt động cộng đồng đang hoạt động.',
      status: 'success',
    };
  }
}
