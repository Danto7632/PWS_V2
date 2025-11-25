import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SimulationsService } from './simulations.service';
import { ScenarioRequestDto } from './dto/scenario-request.dto';
import { MessageRequestDto } from './dto/message-request.dto';

@ApiTags('Guest Simulations')
@Controller('api/guest/simulations')
export class GuestSimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post('scenario')
  @ApiOperation({ summary: '게스트 세션용 최초 고객 시나리오 생성' })
  generateScenario(@Body() body: ScenarioRequestDto) {
    return this.simulationsService.generateScenario(
      body.conversationId,
      body.providerConfig,
    );
  }

  @Post('customer/respond')
  @ApiOperation({ summary: '게스트 세션 - 고객 역할로 AI 직원 응답 받기' })
  respondAsCustomer(@Body() body: MessageRequestDto) {
    return this.simulationsService.customerRespond(
      body.conversationId,
      body.message,
      body.providerConfig,
    );
  }

  @Post('employee/respond')
  @ApiOperation({ summary: '게스트 세션 - 직원 역할 응답 평가' })
  respondAsEmployee(@Body() body: MessageRequestDto) {
    return this.simulationsService.employeeRespond(
      body.conversationId,
      body.message,
      body.providerConfig,
    );
  }
}
